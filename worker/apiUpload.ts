/**
 * Excel yükleme endpoint'i: POST /api/upload
 *
 * MCP akışının base64 sorununu çözer: model Excel baytlarını kendi
 * context'inden geçirmek yerine (token israfı + bozma riski), shell
 * erişimi olan agent'lar dosyayı doğrudan buraya POST eder:
 *
 *   curl -sf -X POST https://.../api/upload \
 *     -F "file=@SunulanDersListesi.xlsx" \
 *     | jq -r .session_id
 *
 * Dönen session_id tüm MCP tool'larında (upload_courses'unkiyle aynı
 * formatta) kullanılır. multipart/form-data VEYA raw body (xlsx content-type)
 * kabul edilir.
 */

import type { Env } from './index';
import { parseExcelFileFromBytes } from './excelParserWorker';
import { TTL_SECONDS } from './mcp';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB — ders listeleri için fazlasıyla yeterli

export const handleApiUpload = async (request: Request, env: Env): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    let bytes: Uint8Array | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      // Workers'ta File tipi DOM File ile birebir aynı değil; yapısal kontrol
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        bytes = new Uint8Array(await (file as File).arrayBuffer());
      }
    } else {
      // Raw body (.xlsx baytları)
      const buf = await request.arrayBuffer();
      if (buf.byteLength > 0) bytes = new Uint8Array(buf);
    }

    if (!bytes || bytes.length === 0) {
      return new Response(JSON.stringify({ error: 'empty_file' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
      return new Response(JSON.stringify({ error: 'file_too_large', max_bytes: MAX_UPLOAD_BYTES }), {
        status: 413,
        headers: { 'content-type': 'application/json' },
      });
    }

    const courses = await parseExcelFileFromBytes(bytes);
    if (courses.length === 0) {
      return new Response(JSON.stringify({ error: 'no_valid_courses' }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      });
    }

    const sessionId = crypto.randomUUID();
    await env.SCHEDULE_KV.put(sessionId, JSON.stringify(courses), { expirationTtl: TTL_SECONDS });

    return new Response(JSON.stringify({
      session_id: sessionId,
      course_count: courses.length,
      expires_in_hours: 24,
    }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'parse_failed' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
};
