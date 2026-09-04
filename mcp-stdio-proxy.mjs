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

const INSTRUCTIONS =
  'Marmara Üniversitesi ders programı yardımcısı. ' +
  'AKIŞ: upload_courses → (extract_courses / filter_courses) → add_to_eligible + tag_courses → add_to_draft → (check_conflicts) → (generate_schedule) → get_import_link. ' +
  'Tüm tool çağrıları upload_courses\'un döndürdüğü session_id kullanır. ' +
  'ÖNEMLİ — Excel yükleme: Kullanıcı bir dosya eklediyse veya dosya yolunu biliyorsan upload_courses\'a MUTLAKA filePath ver (örn. "/home/kullanıcı/dersler.xlsx" veya "/mnt/user-data/uploads/dosya.xlsx", ~ desteklenir). ' +
  'base64\'e ÇEVİRME, dosyayı okumaya çalışma, cat/piping yapma — proxy dosyayı diskten okur ve yükler. ' +
  'filePath yoksa (dosya içeriği zaten metin olarak elindeyse) fileBase64 veya courses kullan. ' +
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
  const { filePath, fileBase64, courses } = args ?? {};

  try {
    if (filePath) {
      const expanded = filePath.startsWith('~') ? path.join(os.homedir(), filePath.slice(1)) : filePath;
      const buf = await fs.readFile(expanded);
      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'application/octet-stream' }), path.basename(expanded));
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
      // Muhtemel neden: yol Cowork VM'inin içinde (/mnt/user-data/...), proxy
      // host'ta çalışır ve oraya erişemez. Modele doğru fallback'i söyle.
      return {
        content: [{
          type: 'text',
          text:
            'Dosya bu makinede bulunamadı — büyük ihtimalle Cowork VM\'inin içinde ("/mnt/user-data/...") ve proxy host\'ta çalışıyor. ' +
            'İki seçenek:\n' +
            '1) Dosya VM\'indeyse: shell\'de şunu çalıştır ve çıktıyı fileBase64 parametresine ver: base64 -w0 "' + (args?.filePath ?? '') + '"\n' +
            '2) Alternatif: kullanıcı dosyayı ~/Claude klasörüne kopyalarsa oradan okunabilir.\n' +
            'Küçük dosyalarda seçenek 1 uygundur.',
        }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: `Dosya okunamadı: ${err?.message ?? String(err)}` }],
      isError: true,
    };
  }

  // filePath yoksa remote'un kendi upload_courses'una devret (fileBase64/courses yolu)
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
          'Kullanıcı bir dosya eklediyse/yolu biliyorsa MUTLAKA filePath kullan — dosya diskten okunur, base64 gereksiz. ' +
          'filePath yalnızca dosya yolu biliniyorken; içeriği elinde metin olarak tutuyorsan fileBase64 ya da courses kullan.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Excel (.xlsx) dosyasının lokal yolu, örn: /mnt/user-data/uploads/dersler.xlsx (önerilen — base64\'e çevirme)' },
            fileBase64: { type: 'string', description: 'Excel base64 — yalnızca dosya yolu yoksa' },
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