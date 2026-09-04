/**
 * Local stdio MCP proxy — Claude Desktop → Worker MCP köprüsü
 *
 * Claude Desktop stdio server bekler; Worker'ımız Streamable HTTP. Bu proxy
 * ikisini birleştirir VE en önemlisi: upload_courses'u yerel işler — dosyayı
 * KULLANICININ MAKİNESİNDEN okur, Worker'a bayt olarak POST eder. Model
 * base64'e hiç dokunmaz (token israfı + bozma riski yok).
 *
 * Kullanım:
 *   node mcp-stdio-proxy.mjs [remote-url]
 *   default remote: http://localhost:8787/mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, InitializeRequestSchema, ResultSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const REMOTE_URL = process.argv[2] || 'http://localhost:8787/mcp';
const UPLOAD_URL = REMOTE_URL.replace(/\/mcp\/?$/, '') + '/api/upload';

// Cowork VM ↔ host dosya köprüsü: VM'de /mnt/user-data altına yazılan dosya
// host'ta coworkUserFilesPath altında görünür (yapılandırma: ~/.config/Claude).
const VM_FILES_PREFIX = '/mnt/user-data/';
const HOST_FILES_DIR = path.join(os.homedir(), 'Claude');

/** Yolu host'ta görünür hale getirir: /mnt/user-data/x → ~/Claude/x */
function resolveHostPath(p) {
  const expanded = p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
  if (expanded.startsWith(VM_FILES_PREFIX)) {
    return path.join(HOST_FILES_DIR, expanded.slice(VM_FILES_PREFIX.length));
  }
  return expanded;
}

const INSTRUCTIONS =
  'Marmara Üniversitesi ders programı yardımcısı. ' +
  'AKIŞ: upload_courses → (extract_courses / filter_courses) → add_to_eligible + tag_courses → add_to_draft → (check_conflicts) → (generate_schedule) → get_import_link. ' +
  'Tüm tool çağrıları upload_courses\'un döndürdüğü session_id kullanır. ' +
  'ÖNEMLİ — Excel yükleme TEK STANDART YOL (asla base64\'ü tool argümanı olarak verme, context\'i şişirir ve bozulur):\n' +
  '1) Shell\'de dosyayı base64\'e çevirip bir DOSYAYA yaz: base64 -w0 "/mnt/user-data/uploads/dersler.xlsx" > /mnt/user-data/dersler.b64\n' +
  '2) upload_courses\'a sadece o dosyanın yolunu ver: fileBase64Path: "/mnt/user-data/dersler.b64"\n' +
  'Proxy dosyayı diskten okuyup decode eder; base64 hiçbir zaman model context\'inden geçmez.\n' +
  'Alternatif: dosya yoluna doğrudan erişebiliyorsan filePath da kabul edilir (base64 adımına gerek yok). ' +
  'Etiketler (mandatory/elective/important/optional) generate_schedule önceliklendirmesinde kullanılır. ' +
  'get_import_link\'in döndürdüğü link 24 saat sonra geçersiz olur — kullanıcıya mutlaka belirtin.';

// ---------------------------------------------------------------------------
// Remote erişim (stateless — her istekte taze client)
// ---------------------------------------------------------------------------

async function remoteRequest(method, params) {
  const transport = new StreamableHTTPClientTransport(new URL(REMOTE_URL));
  const client = new Client({ name: 'marmara-stdio-proxy', version: '1.0.0' });
  try {
    await client.connect(transport);
    return await client.request({ method, params }, ResultSchema);
  } finally {
    await client.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// upload_courses — YEREL işlenir: dosya diskten okunur, /api/upload'a bayt POST
// ---------------------------------------------------------------------------

async function localUploadCourses(args) {
  const { filePath, fileBase64Path, fileBase64, courses } = args ?? {};

  try {
    let buf = null;
    let sourceName = '';

    if (fileBase64Path) {
      // TEK STANDART YOL: base64 metin dosyası diskten okunur, burada decode edilir
      const b64Path = resolveHostPath(fileBase64Path);
      const b64Text = (await fs.readFile(b64Path, 'utf8')).replace(/\s+/g, '');
      if (!b64Text) {
        return { content: [{ type: 'text', text: `Base64 dosyası boş: ${fileBase64Path}` }], isError: true };
      }
      buf = Buffer.from(b64Text, 'base64');
      sourceName = path.basename(fileBase64Path).replace(/\.b64$/i, '');
    } else if (filePath) {
      const xlsxPath = resolveHostPath(filePath);
      buf = await fs.readFile(xlsxPath);
      sourceName = path.basename(xlsxPath);
    }

    if (buf) {
      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'application/octet-stream' }), sourceName || 'courses.xlsx');
      const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        return {
          content: [{ type: 'text', text: `Yükleme başarısız (HTTP ${res.status}): ${errBody.slice(0, 300)}` }],
          isError: true,
        };
      }
      const data = await res.json();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            session_id: data.session_id,
            course_count: data.course_count,
            expires_in_hours: data.expires_in_hours ?? 24,
          }, null, 2),
        }],
      };
    }
  } catch (err) {
    const code = err?.code;
    if (code === 'ENOENT') {
      const tried = fileBase64Path ?? filePath ?? '';
      const vmPath = tried.startsWith(VM_FILES_PREFIX);
      return {
        content: [{
          type: 'text',
          text: vmPath
            ? `VM yolu host'ta bulunamadı: ${tried} → ${resolveHostPath(tried)}. Cowork dosya senkronizasyonu gecikmiş olabilir; 1-2 saniye sonra tekrar dene ya da dosyayı ~/Claude/ altına yaz.`
            : `Dosya bulunamadı: ${tried}. Kullanıcıdan dosyanın yerini doğrulamasını iste.`,
        }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: `Dosya okunamadı: ${err?.message ?? String(err)}` }],
      isError: true,
    };
  }

  // fileBase64/courses yolu: remote'un kendi upload_courses'una devret
  return remoteRequest('tools/call', { name: 'upload_courses', arguments: { fileBase64, courses } });
}

// ---------------------------------------------------------------------------
// stdio server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'marmara-schedule', version: '1.0.0' },
  {
    instructions: INSTRUCTIONS,
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(InitializeRequestSchema, async (req) => {
  const remote = await remoteRequest('initialize', req.params).catch(() => null);
  return {
    protocolVersion: remote?.protocolVersion ?? '2025-03-26',
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'marmara-schedule', version: '1.0.0' },
    instructions: INSTRUCTIONS,
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const remote = await remoteRequest('tools/list', {});
  const remoteTools = (remote.tools ?? []).filter(t => t.name !== 'upload_courses');
  return {
    tools: [
      {
        name: 'upload_courses',
        title: 'Ders Kataloğu Yükle',
        description:
          'Ders kataloğunu yükler ve 24 saat geçerli session_id döndürür. ' +
          'ASLA base64\'ü tool argümanı olarak verme. İki yol: (1) fileBase64Path — base64\'ü shell\'de bir dosyaya yaz (base64 -w0 dosya.xlsx > /mnt/user-data/d.b64), buraya sadece o dosyanın yolunu ver; (2) filePath — .xlsx dosyasına doğrudan erişebiliyorsan yolu ver.',
        inputSchema: {
          type: 'object',
          properties: {
            fileBase64Path: { type: 'string', description: 'Base64 metin dosyasının yolu (önerilen): base64 çıktısını shell\'de dosyaya yaz, yolunu ver. Proxy okur ve decode eder — base64 asla context\'ten geçmez.' },
            filePath: { type: 'string', description: 'Excel (.xlsx) dosyasının doğrudan yolu — erişebiliyorsan base64 adımı gereksiz' },
            courses: {
              type: 'array',
              description: 'Parse edilmiş ders listesi (Excel metin olarak verildiyse)',
              items: {
                type: 'object',
                properties: {
                  courseCode: { type: 'string' },
                  courseName: { type: 'string' },
                  instructor: { type: 'string' },
                  dayTimeLocation: { type: 'string' },
                  credits: { type: 'number' },
                },
                required: ['courseCode', 'courseName', 'dayTimeLocation'],
              },
            },
          },
        },
      },
      ...remoteTools,
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === 'upload_courses') return localUploadCourses(args);
  return remoteRequest('tools/call', { name, arguments: args ?? {} });
});

// Diğer her şey (ping vb.) remote'a
server.fallbackRequestHandler = async (req) => remoteRequest(req.method, req.params);

const transport = new StdioServerTransport();
await server.connect(transport);