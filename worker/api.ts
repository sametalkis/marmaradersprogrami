/**
 * Salt-okunur REST endpoint: /api/session
 *
 * Frontend, ?import_session=<uuid>[&draft=<name>] linkiyle açıldığında
 * buraya fetch atar. Yazma/silme YOK — yazma işi MCP tool'larına ait.
 *
 * ?draft=<ad>        → o draftın course_codes + marks
 * ?all_drafts=1      → session'daki TÜM draftlar birleştirilmiş + marks
 *                      (draft adı verilmeyince bu kullanılır)
 */

import type { Env } from './index';

export const handleApiSession = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('import_session');
  const draftName = url.searchParams.get('draft');
  const allDrafts = url.searchParams.get('all_drafts') === '1';

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
    // Session state (eligible/tag işaretleri) her zaman yanına eklenir;
    // katalog (ham Course[]) — import linkiyle İLK kez gelen kullanıcının
    // localStorage'ı boştur, eşleştirme ve app içeriği için katalog şart
    const [data, stateRaw, catalogRaw] = await Promise.all([
      env.SCHEDULE_KV.get(key),
      env.SCHEDULE_KV.get(`${sessionId}:state`),
      env.SCHEDULE_KV.get(sessionId),
    ]);

    // Tek link = tüm draftlar: session state'teki draft dizinini oku,
    // her draftın course_codes'larını birleştir (sıra korunur, tekrarsız)
    if (allDrafts && stateRaw) {
      const state = JSON.parse(stateRaw) as { marks?: Record<string, { eligible?: boolean; tag?: string }>; drafts?: string[] };
      const draftNames = (state.drafts ?? []).filter(d => /^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ _-]{1,64}$/.test(d));
      const merged: string[] = [];
      const seen = new Set<string>();
      const perDraft: { name: string; count: number }[] = [];
      await Promise.all(draftNames.map(async name => {
        const raw = await env.SCHEDULE_KV.get(`${sessionId}:draft:${name}`);
        if (!raw) return;
        try {
          const d = JSON.parse(raw) as { course_codes?: string[] };
          return (d.course_codes ?? []).filter((c): c is string => typeof c === 'string');
        } catch {
          return [];
        }
      })).then(results => {
        results.forEach((codes, i) => {
          const safe = codes ?? [];
          const fresh = safe.filter(c => !seen.has(c));
          fresh.forEach(c => seen.add(c));
          merged.push(...fresh);
          perDraft.push({ name: draftNames[i], count: fresh.length });
        });
      });
      if (merged.length === 0 && state.marks && Object.keys(state.marks).length === 0) {
        return new Response(JSON.stringify({ error: 'expired_or_not_found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
      const marks = state.marks ?? {};
      return new Response(JSON.stringify({
        course_codes: merged,
        drafts: perDraft,
        marks,
        courses: catalogRaw ? JSON.parse(catalogRaw) : [],
      }), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      });
    }

    if (data === null) {
      return new Response(JSON.stringify({ error: 'expired_or_not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Draft key'i: course_codes + marks birleştir; düz session key'i: ham Course[]
    if (safeDraft) {
      const draft = JSON.parse(data) as { course_codes?: string[]; updated_at?: string };
      const state = stateRaw
        ? (JSON.parse(stateRaw) as { marks?: Record<string, { eligible?: boolean; tag?: string }> })
        : { marks: {} };
      return new Response(JSON.stringify({
        course_codes: draft.course_codes ?? [],
        updated_at: draft.updated_at,
        marks: state.marks ?? {},
        courses: catalogRaw ? JSON.parse(catalogRaw) : [],
      }), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
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
