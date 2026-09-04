/**
 * Salt-okunur REST endpoint: /api/session
 *
 * Frontend, ?import_session=<uuid>[&draft=<name>] linkiyle açıldığında
 * buraya fetch atar. Yazma/silme YOK — yazma işi MCP tool'larına ait.
 */

import type { Env } from './index';

export const handleApiSession = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('import_session');
  const draftName = url.searchParams.get('draft');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'missing_session_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Session id format doğrulaması (uuid) — KV key injection'ı ve kaba-force engeli
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(JSON.stringify({ error: 'invalid_session_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Draft adı sınırlı karakter kümesiyle kısıtlı (KV key güvenliği)
  const safeDraft = draftName && /^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ _-]{1,64}$/.test(draftName)
    ? draftName
    : null;

  const key = safeDraft ? `${sessionId}:draft:${safeDraft}` : sessionId;

  try {
    const data = await env.SCHEDULE_KV.get(key);
    if (data === null) {
      return new Response(JSON.stringify({ error: 'expired_or_not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(data, {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'kv_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
