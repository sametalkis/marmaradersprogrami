/**
 * MCP server — stateless Streamable HTTP (Durable Objects'sız)
 *
 * Neden `agents` paketinin McpAgent'ı DEĞİL: McpAgent Durable Objects üzerine
 * kuruludur ve DO Free plan'da mevcut değildir. Bunun yerine SDK'nın McpServer'ı,
 * Web Request/Response'a uyarlanmış minimal bir Transport ile her POST /mcp'de
 * sıfırdan örneklenir (resmi stateless desen).
 *
 * Session durumu KV'de (24 saat TTL) tutulur:
 *   <session_id>                 → Course[] (upload_courses yazar)
 *   <session_id>:state           → { marks: { [kod]: { eligible, tag } } } (add_to_eligible/tag_courses yazar)
 *   <session_id>:draft:<name>    → { course_codes, updated_at } (add_to_draft yazar)
 *
 * Kod tekrarı yok: parse/çakışma/generatör mantığı src/'ten import edilir.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Course } from '../src/types/Course';
import { CourseTag } from '../src/types/Course';
import { parseAllSchedules } from '../src/utils/excelParser';
import { parseExcelFileFromBase64 } from './excelParserWorker';
import { extractCourseCodes, matchCoursesWithCodes } from '../src/utils/courseCodeExtractor';
import {
  getBaseCourseCode,
  generateScheduleSuggestions,
  defaultPreferences,
} from '../src/utils/scheduleGenerator';

const TTL_SECONDS = 86400; // 24 saat
const MAX_FILTER_RESULTS = 30;
const MAX_SUGGESTIONS = 5;
const BASE_URL = 'https://marmaradersprogrami.sametalkis.me';

const VALID_TAGS = new Set<string>(Object.values(CourseTag));

export interface Env {
  SCHEDULE_KV: KVNamespace;
}

// ---------------------------------------------------------------------------
// KV yardımcıları
// ---------------------------------------------------------------------------

/** KV'den okunan ham JSON'u doğrulayıp Course[]'a çevirir */
function parseCourses(raw: string): Course[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (c): c is Course =>
      !!c && typeof c === 'object' &&
      typeof (c as Course).courseCode === 'string' &&
      typeof (c as Course).courseName === 'string' &&
      typeof (c as Course).dayTimeLocation === 'string'
  );
}

async function getSessionCourses(env: Env, sessionId: string): Promise<Course[] | null> {
  const raw = await env.SCHEDULE_KV.get(sessionId);
  return raw ? parseCourses(raw) : null;
}

interface DraftFile {
  course_codes: string[];
  updated_at: string;
}

async function readDraft(env: Env, sessionId: string, draftName: string): Promise<DraftFile | null> {
  const raw = await env.SCHEDULE_KV.get(draftKey(sessionId, draftName));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Eski/ham format (düz string[]) da okunur
      return { course_codes: parsed.filter((c): c is string => typeof c === 'string'), updated_at: '' };
    }
    const codes = (parsed as Partial<DraftFile>).course_codes;
    if (Array.isArray(codes)) {
      return {
        course_codes: codes.filter((c): c is string => typeof c === 'string'),
        updated_at: (parsed as Partial<DraftFile>).updated_at ?? '',
      };
    }
    return { course_codes: [], updated_at: '' };
  } catch {
    return { course_codes: [], updated_at: '' };
  }
}

/** Draft KV key şablonu tek yerde: "<session>:draft:<name>" */
const draftKey = (sessionId: string, draftName: string) => `${sessionId}:draft:${draftName}`;

// ---------------------------------------------------------------------------
// Session state (eligible/tag işaretleri) — import akışında uygulamaya taşınır
// ---------------------------------------------------------------------------

interface CourseMark {
  eligible?: boolean;
  tag?: string;
}

interface SessionState {
  marks: Record<string, CourseMark>;
}

const stateKey = (sessionId: string) => `${sessionId}:state`;

async function readState(env: Env, sessionId: string): Promise<SessionState> {
  const raw = await env.SCHEDULE_KV.get(stateKey(sessionId));
  if (!raw) return { marks: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return { marks: parsed.marks && typeof parsed.marks === 'object' ? parsed.marks : {} };
  } catch {
    return { marks: {} };
  }
}

async function writeState(env: Env, sessionId: string, state: SessionState): Promise<void> {
  await env.SCHEDULE_KV.put(stateKey(sessionId), JSON.stringify(state), { expirationTtl: TTL_SECONDS });
}

async function writeDraft(env: Env, sessionId: string, draftName: string, codes: string[]): Promise<void> {
  const file: DraftFile = { course_codes: codes, updated_at: new Date().toISOString() };
  await env.SCHEDULE_KV.put(draftKey(sessionId, draftName), JSON.stringify(file), {
    expirationTtl: TTL_SECONDS,
  });
}

// ---------------------------------------------------------------------------
// Ders yardımcıları
// ---------------------------------------------------------------------------

/** Katalogda kodla ders bul (birebir, sonra base kod eşleşmesi: "BUS3002.1" ≈ "BUS3002") */
function findCourseByCode(courses: Course[], code: string): Course | undefined {
  const wanted = code.trim().toLowerCase();
  return courses.find(c => c.courseCode.toLowerCase() === wanted) ||
    courses.find(c => getBaseCourseCode(c.courseCode).toLowerCase() === wanted);
}

interface ConflictPair {
  course1: string;
  course2: string;
  reason: string;
}

/** İki ders arasındaki zaman çakışmalarını bul */
function findConflicts(courses: Course[]): ConflictPair[] {
  const out: ConflictPair[] = [];
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      for (const x of a.schedules || []) {
        for (const y of b.schedules || []) {
          if (x.day === y.day &&
              !(toMin(x.endTime) <= toMin(y.startTime) || toMin(y.endTime) <= toMin(x.startTime))) {
            out.push({
              course1: a.courseCode,
              course2: b.courseCode,
              reason: `${x.day} ${x.startTime}-${x.endTime} ↔ ${y.startTime}-${y.endTime}`,
            });
          }
        }
      }
    }
  }
  return out;
}

/** Tool response'undaki ders temsilini küçültür (agent context'ini şişirmemek için) */
function courseSummary(c: Course) {
  return {
    courseCode: c.courseCode,
    courseName: c.courseName,
    instructor: c.instructor,
    dayTimeLocation: c.dayTimeLocation,
    credits: c.credits,
  };
}

/** UUID formatı doğrulaması (KV key injection'ı ve kaba-force engeli) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Draft adı karakter kümesi — /api/session'daki regex ile birebir aynıdır.
 * Bu kısıt olmazsa get_import_link'in ürettiği link /api/session'da 404 verirdi.
 */
const DRAFT_NAME_RE = /^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ _-]{1,64}$/;

/** Session bulunamadı / süresi doldu standard cevabı */
function sessionNotFound() {
  return {
    content: [{ type: 'text' as const, text: 'Session bulunamadı veya 24 saatlik süre doldu. Kullanıcıdan dosyayı upload_courses ile yeniden yüklemesini isteyin.' }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Minimal Web-standard Transport (Worker Request/Response köprüsü)
// ---------------------------------------------------------------------------

/**
 * Tek istek-yanıt cycle'ı için transport: start() no-op, send() server'dan çıkan
 * JSON-RPC mesajını yakalar, close() no-op. McpServer istek handler'ını async
 * çalıştırıp response'u send() ile iletir; handleMcp bu mesajları bekleyip
 * JSON Response olarak döndürür.
 */
class WorkerTransport implements Transport {
  onmessage?: (message: JSONRPCMessage, extra?: unknown) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
  sessionId?: string;

  readonly messages: JSONRPCMessage[] = [];
  private waiters: (() => void)[] = [];

  private notify(): void {
    this.waiters.shift()?.();
  }

  private wait(): Promise<void> {
    return new Promise(resolve => this.waiters.push(resolve));
  }

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    this.messages.push(message);
    this.notify();
  }

  /** count adet server→client mesajı gelene kadar bekler (istekler her zaman yanıtlanır) */
  async waitForMessages(count: number): Promise<JSONRPCMessage[]> {
    while (this.messages.length < count) {
      await this.wait();
    }
    return this.messages;
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}

// ---------------------------------------------------------------------------
// MCP server kurulumu
// ---------------------------------------------------------------------------

function createMcpServer(env: Env): McpServer {
  const server = new McpServer(
    { name: 'marmara-schedule', version: '1.0.0' },
    {
      instructions:
        'Marmara Üniversitesi ders programı yardımcısı. ' +
        'Akış: upload_courses → (extract_courses / filter_courses) → add_to_eligible + tag_courses → add_to_draft → (check_conflicts) → (generate_schedule) → get_import_link. ' +
        'Tüm tool çağrıları upload_courses\'un döndürdüğü session_id kullanır. ' +
        'Etiketler (mandatory/elective/important/optional) generate_schedule önceliklendirmesinde kullanılır. ' +
        'get_import_link\'in döndürdüğü link 24 saat sonra geçersiz olur — kullanıcıya mutlaka belirtin.',
    }
  );

  // ---- upload_courses ------------------------------------------------------
  server.registerTool('upload_courses', {
    title: 'Ders Kataloğu Yükle',
    description: 'Excel dosyasını (base64) veya zaten parse edilmiş ders listesini yükler. 24 saat geçerli bir session_id döndürür; sonraki tüm çağrılar bu id\'yi kullanır.',
    inputSchema: {
      fileBase64: z.string().optional().describe('Excel (.xlsx) dosyasının base64 içeriği'),
      courses: z.array(z.object({
        courseCode: z.string().describe('Ders kodu, örn: BUS3002.1'),
        courseName: z.string(),
        instructor: z.string().optional(),
        dayTimeLocation: z.string().describe('Örn: "Pazartesi 09:30 - 10:20 [RTE.I1.Z01]"'),
        credits: z.number().optional(),
      })).optional().describe('Zaten parse edilmiş ders listesi (Excel metin olarak verildiyse)'),
    },
  }, async ({ fileBase64, courses }) => {
    let parsed: Course[] = [];

    if (courses && courses.length > 0) {
      parsed = courses.map((c, i) => ({
        id: `${c.courseCode}-${i}`,
        courseCode: c.courseCode.trim(),
        courseName: c.courseName.trim(),
        instructor: (c.instructor || '').trim(),
        dayTimeLocation: c.dayTimeLocation,
        schedules: parseAllSchedules(c.dayTimeLocation),
        credits: c.credits,
        isSelected: false,
        isEligible: false,
      }));
    } else if (fileBase64) {
      parsed = await parseExcelFileFromBase64(fileBase64);
    }

    if (parsed.length === 0) {
      return {
        content: [{ type: 'text', text: 'Hata: Dosyada geçerli ders bulunamadı. "Ders Kodu" ve "Ders Adı" sütunları dolu satırlar gerekli; ya da courses/fileBase64 parametrelerinden birini verin.' }],
        isError: true,
      };
    }

    const sessionId = crypto.randomUUID();
    await env.SCHEDULE_KV.put(sessionId, JSON.stringify(parsed), { expirationTtl: TTL_SECONDS });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          session_id: sessionId,
          course_count: parsed.length,
          sample: parsed.slice(0, 3).map(courseSummary),
          expires_in_hours: 24,
        }, null, 2),
      }],
    };
  });

  // ---- filter_courses ------------------------------------------------------
  server.registerTool('filter_courses', {
    title: 'Ders Filtrele',
    description: 'Yüklenmiş katalogda arama/filtreleme yapar (kod, ad, öğretim üyesi, departman, gün). Katalogu tek seferde döndürmez; en fazla 30 sonuç verir.',
    inputSchema: {
      session_id: z.string().uuid(),
      query: z.string().optional().describe('Serbest metin: ders kodu, adı veya öğretim üyesinde arama'),
      department: z.string().optional().describe('Departman ön eki, örn: BUS, CSE'),
      day: z.string().optional().describe('Gün adı (Türkçe), örn: Pazartesi'),
    },
  }, async ({ session_id, query, department, day }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    const courses = await getSessionCourses(env, session_id);
    if (!courses) return sessionNotFound();

    const q = query?.trim().toLowerCase();
    const dept = department?.trim().toUpperCase();
    const filtered = courses.filter(c => {
      if (dept && !c.courseCode.toUpperCase().startsWith(dept)) return false;
      if (day && !(c.schedules || []).some(s => s.day.toLowerCase() === day.trim().toLowerCase())) return false;
      if (q && !(
        c.courseCode.toLowerCase().includes(q) ||
        c.courseName.toLowerCase().includes(q) ||
        c.instructor.toLowerCase().includes(q)
      )) return false;
      return true;
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total_matches: filtered.length,
          returned: Math.min(filtered.length, MAX_FILTER_RESULTS),
          truncated: filtered.length > MAX_FILTER_RESULTS,
          courses: filtered.slice(0, MAX_FILTER_RESULTS).map(courseSummary),
        }, null, 2),
      }],
    };
  });

  // ---- extract_courses -----------------------------------------------------
  server.registerTool('extract_courses', {
    title: 'Metinden Ders Çıkar',
    description: 'Serbest metinden (müfredat, Word/PDF kopyası, web sayfası vb.) üniversite ders kodlarını çıkarır ve katalogla eşleştirir. Toplu ders eklemede ilk adım.',
    inputSchema: {
      session_id: z.string().uuid(),
      text: z.string().min(1).max(50000).describe('Ders kodlarının geçtiği serbest metin'),
    },
  }, async ({ session_id, text }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    const courses = await getSessionCourses(env, session_id);
    if (!courses) return sessionNotFound();

    // src/utils/courseCodeExtractor ile aynı regex/mantık (tek kaynak)
    const codes = extractCourseCodes(text);
    const result = matchCoursesWithCodes(codes, courses);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total_extracted: result.totalExtractedCodes,
          matched_base_codes: result.matchedCodes.map(m => ({
            code: m.normalizedCode,
            sections: m.matchedCourses.map(courseSummary),
          })),
          unmatched_codes: result.unmatchedCodes,
          total_matched_courses: result.totalMatchedCourses,
          matched_course_codes: courses
            .filter(c => result.allMatchedCourseIds.includes(c.id))
            .map(c => c.courseCode),
        }, null, 2),
      }],
    };
  });

  // ---- add_to_eligible -----------------------------------------------------
  server.registerTool('add_to_eligible', {
    title: 'Uygunluk Havuzuna Ekle',
    description: 'Dersleri uygun (seçilebilir) havuza ekler ve opsiyonel etiket atar. Etiketler: mandatory (Zorunlu), elective (Seçmeli), important (Önemli), optional (İsteğe Bağlı). Etiketler generate_schedule\'ın ders önceliklendirmesinde kullanılır.',
    inputSchema: {
      session_id: z.string().uuid(),
      course_codes: z.array(z.string()).min(1).describe('Uygun havuza eklenecek ders kodları'),
      tag: z.enum(['mandatory', 'elective', 'important', 'optional']).optional().describe('Tüm eklenenlere atanacak etiket'),
    },
  }, async ({ session_id, course_codes, tag }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    const courses = await getSessionCourses(env, session_id);
    if (!courses) return sessionNotFound();

    const state = await readState(env, session_id);
    const added: string[] = [];
    const notFound: string[] = [];

    for (const code of course_codes) {
      const course = findCourseByCode(courses, code);
      if (!course) {
        notFound.push(code);
        continue;
      }
      const mark = state.marks[course.courseCode] || {};
      mark.eligible = true;
      if (tag) mark.tag = tag;
      state.marks[course.courseCode] = mark;
      added.push(course.courseCode);
    }

    if (notFound.length > 0 && added.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ added: false, reason: 'not_found', not_found: notFound }, null, 2) }],
        isError: true,
      };
    }

    await writeState(env, session_id, state);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          added,
          not_found: notFound.length > 0 ? notFound : undefined,
          tag: tag ?? undefined,
          message: tag
            ? `${added.length} ders uygun havuza eklendi ve "${tag}" etiketi atandı.`
            : `${added.length} ders uygun havuza eklendi.`,
        }, null, 2),
      }],
    };
  });

  // ---- tag_courses ---------------------------------------------------------
  server.registerTool('tag_courses', {
    title: 'Dersleri Etiketle',
    description: 'Derslere etiket atar veya kaldırır. Etiketler: mandatory (Zorunlu), elective (Seçmeli), important (Önemli), optional (İsteğe Bağlı).',
    inputSchema: {
      session_id: z.string().uuid(),
      course_codes: z.array(z.string()).min(1).describe('Etiketlenecek ders kodları'),
      tag: z.enum(['mandatory', 'elective', 'important', 'optional']).nullable().optional().describe('Atanacak etiket; null = etiketi kaldır'),
    },
  }, async ({ session_id, course_codes, tag }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    if (tag !== undefined && tag !== null && !VALID_TAGS.has(tag)) {
      return { content: [{ type: 'text', text: `Geçersiz etiket: ${tag}` }], isError: true };
    }
    const courses = await getSessionCourses(env, session_id);
    if (!courses) return sessionNotFound();

    const state = await readState(env, session_id);
    const updated: string[] = [];
    const notFound: string[] = [];

    for (const code of course_codes) {
      const course = findCourseByCode(courses, code);
      if (!course) {
        notFound.push(code);
        continue;
      }
      const mark = state.marks[course.courseCode] || {};
      if (tag === null) {
        delete mark.tag;
      } else if (tag !== undefined) {
        mark.tag = tag;
        mark.eligible = true; // etiket atamak havuza da ekler (uygulama davranışıyla uyumlu)
      }
      state.marks[course.courseCode] = mark;
      updated.push(course.courseCode);
    }

    if (notFound.length > 0 && updated.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ updated: false, reason: 'not_found', not_found: notFound }, null, 2) }],
        isError: true,
      };
    }

    await writeState(env, session_id, state);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          updated,
          tag: tag ?? null,
          not_found: notFound.length > 0 ? notFound : undefined,
        }, null, 2),
      }],
    };
  });

  // ---- add_to_draft --------------------------------------------------------
  server.registerTool('add_to_draft', {
    title: 'Taslağa Ders Ekle',
    description: 'Dersleri adlandırılmış taslağa ekler. Çakışma tespit edilirse confirm_add olmadan eklemez; çakışan çiftleri listeler.',
    inputSchema: {
      session_id: z.string().uuid(),
      draft_name: z.string().min(1).max(64).describe('Taslak adı, örn: "Bahar 2026"'),
      course_codes: z.array(z.string()).min(1).describe('Eklenecek ders kodları (şube kodu veya base kod)'),
      confirm_add: z.boolean().optional().describe('Çakışma olsa da ekle (kullanıcı onayladıysa)'),
    },
  }, async ({ session_id, draft_name, course_codes, confirm_add }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    if (!DRAFT_NAME_RE.test(draft_name)) {
      return { content: [{ type: 'text', text: 'draft_name 1-64 karakter olmalı ve yalnızca harf, rakam, boşluk, alt/orta tire içermeli (Türkçe harfler geçerli).' }], isError: true };
    }
    const courses = await getSessionCourses(env, session_id);
    if (!courses) return sessionNotFound();

    const draft = await readDraft(env, session_id, draft_name);
    const existingCodes = new Set(draft?.course_codes ?? []);
    const toAdd: Course[] = [];
    const notFound: string[] = [];
    const alreadyInDraft: string[] = [];

    for (const code of course_codes) {
      const course = findCourseByCode(courses, code);
      if (!course) {
        notFound.push(code);
        continue;
      }
      if (existingCodes.has(course.courseCode)) {
        alreadyInDraft.push(course.courseCode);
        continue;
      }
      toAdd.push(course);
      existingCodes.add(course.courseCode);
    }

    if (notFound.length > 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ added: false, reason: 'not_found', not_found: notFound, message: 'Bu kodlar katalogda yok. filter_courses ile doğrulayın.' }, null, 2) }],
        isError: true,
      };
    }

    // Çakışma kontrolü: mevcut taslak + eklenecekler birlikte
    const combinedCodes = [...(draft?.course_codes ?? []), ...toAdd.map(c => c.courseCode)];
    const combined = combinedCodes
      .map(code => courses.find(c => c.courseCode === code))
      .filter((c): c is Course => !!c);
    const conflicts = findConflicts(combined);

    if (conflicts.length > 0 && !confirm_add) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            added: false,
            reason: 'conflict_detected',
            conflicts,
            message: 'Çakışma tespit edildi. Kullanıcı onaylıyorsa confirm_add: true ile tekrar çağırın.',
          }, null, 2),
        }],
      };
    }

    const newCodes = combinedCodes;
    await writeDraft(env, session_id, draft_name, newCodes);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          added: true,
          added_courses: toAdd.map(courseSummary),
          already_in_draft: alreadyInDraft,
          conflicts_added_despite: conflicts.length > 0 ? conflicts : undefined,
          draft_size: newCodes.length,
        }, null, 2),
      }],
    };
  });

  // ---- check_conflicts -----------------------------------------------------
  server.registerTool('check_conflicts', {
    title: 'Çakışma Kontrolü',
    description: 'Taslaktaki dersler arasındaki zaman çakışmalarını raporlar.',
    inputSchema: {
      session_id: z.string().uuid(),
      draft_name: z.string().min(1).max(64),
    },
  }, async ({ session_id, draft_name }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    const courses = await getSessionCourses(env, session_id);
    if (!courses) return sessionNotFound();

    const draft = await readDraft(env, session_id, draft_name);
    if (!draft) {
      return {
        content: [{ type: 'text', text: `Draft "${draft_name}" bulunamadı. add_to_draft ile önce ders ekleyin.` }],
        isError: true,
      };
    }

    const draftCourses = draft.course_codes
      .map(code => courses.find(c => c.courseCode === code))
      .filter((c): c is Course => !!c);
    const conflicts = findConflicts(draftCourses);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          draft_name,
          course_count: draftCourses.length,
          conflict_count: conflicts.length,
          has_conflicts: conflicts.length > 0,
          conflicts,
        }, null, 2),
      }],
    };
  });

  // ---- generate_schedule ---------------------------------------------------
  server.registerTool('generate_schedule', {
    title: 'Program Üret',
    description: 'Seçilen derslerle çakışmasız haftalık program kombinasyonları üretir (en iyi 5). Etiket dağılımı (requirements) verilmezse tüm seçilen dersler programa girmeye çalışır. Ders etiketleri session state\'inden (add_to_eligible/tag_courses) okunur.',
    inputSchema: {
      session_id: z.string().uuid(),
      selected_course_codes: z.array(z.string()).min(1).describe('Programa girebilecek ders kodları'),
      requirements: z.object({
        mandatory: z.number().int().min(0).optional(),
        elective: z.number().int().min(0).optional(),
        important: z.number().int().min(0).optional(),
        optional: z.number().int().min(0).optional(),
      }).optional().describe('Etiket başına programda olmasını istenen ders sayısı; verilmezse tüm seçilen dersler programa girer'),
    },
  }, async ({ session_id, selected_course_codes, requirements }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    const courses = await getSessionCourses(env, session_id);
    if (!courses) return sessionNotFound();
    const state = await readState(env, session_id);

    const selected: Course[] = [];
    const notFound: string[] = [];
    for (const code of selected_course_codes) {
      const course = findCourseByCode(courses, code);
      if (course) selected.push(course);
      else notFound.push(code);
    }
    if (notFound.length > 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'not_found', not_found: notFound }, null, 2) }],
        isError: true,
      };
    }

    // Generator yalnızca etiketli derslerle çalışır. Etiketler session state'ten
    // okunur; etiketsiz kalanlar mandatory sayılır (etiketsiz ders de programa
    // girebilsin diye). requirements verilmezse her etiketten tümü istenir.
    const tagOf = (c: Course): CourseTag => {
      const mark = state.marks[c.courseCode];
      return (mark?.tag as CourseTag) ?? CourseTag.MANDATORY;
    };
    const tagged = selected.map(c => ({ ...c, isEligible: true, tag: tagOf(c) }));
    const counts: Record<string, number> = {};
    for (const c of tagged) counts[c.tag as string] = (counts[c.tag as string] || 0) + 1;

    const prefsReq: Record<string, number> = {
      [CourseTag.MANDATORY]: 0, [CourseTag.ELECTIVE]: 0, [CourseTag.IMPORTANT]: 0, [CourseTag.OPTIONAL]: 0,
    };
    if (requirements) {
      for (const [key, value] of Object.entries(requirements)) {
        if (typeof value === 'number') prefsReq[key] = value;
      }
    } else {
      for (const [key, value] of Object.entries(counts)) prefsReq[key] = value;
    }

    const preferences = {
      ...defaultPreferences,
      requirements: prefsReq as typeof defaultPreferences.requirements,
    };

    const suggestions = generateScheduleSuggestions(tagged, preferences).slice(0, MAX_SUGGESTIONS);

    if (suggestions.length === 0) {
      return {
        content: [{ type: 'text', text: 'Uygun program kombinasyonu bulunamadı (tüm seçenekler çakışıyor). check_conflicts ile hangi çiftlerin çakıştığını inceleyin.' }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          suggestion_count: suggestions.length,
          suggestions: suggestions.map((s, i) => ({
            rank: i + 1,
            score: s.score,
            conflict_count: s.conflictCount,
            courses: s.courses.map(c => c.courseCode),
            days: s.summary.days,
            earliest_start: s.summary.earliestStart,
            latest_end: s.summary.latestEnd,
          })),
        }, null, 2),
      }],
    };
  });

  // ---- get_import_link -----------------------------------------------------
  server.registerTool('get_import_link', {
    title: 'İçe Aktarma Linki Al',
    description: 'Taslağı uygulamaya aktarmak için tek kullanımlık link üretir. Link 24 saat geçerlidir; kullanıcıya mutlaka iletin.',
    inputSchema: {
      session_id: z.string().uuid(),
      draft_name: z.string().min(1).max(64),
    },
  }, async ({ session_id, draft_name }) => {
    if (!UUID_RE.test(session_id)) {
      return { content: [{ type: 'text', text: 'Geçersiz session_id formatı.' }], isError: true };
    }
    const draft = await readDraft(env, session_id, draft_name);

    if (!draft) {
      return {
        content: [{ type: 'text', text: `Draft "${draft_name}" bulunamadı. Önce add_to_draft ile ders ekleyin.` }],
        isError: true,
      };
    }
    if (draft.course_codes.length === 0) {
      return {
        content: [{ type: 'text', text: `Draft "${draft_name}" boş. Önce add_to_draft ile ders ekleyin.` }],
        isError: true,
      };
    }

    const link = `${BASE_URL}/?import_session=${session_id}&draft=${encodeURIComponent(draft_name)}`;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          import_link: link,
          draft_name,
          course_count: draft.course_codes.length,
          expires_in_hours: 24,
          note: 'Bu linki kullanıcıya iletin; 24 saat sonra geçersiz olur. Kullanıcı linke tıklayınca dersler uygulamasındaki taslağa aktarılır.',
        }, null, 2),
      }],
    };
  });

  return server;
}

// ---------------------------------------------------------------------------
// HTTP handler — stateless Streamable HTTP
// ---------------------------------------------------------------------------

const JSON_HEADERS: Record<string, string> = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
};

/**
 * POST /mcp: JSON-RPC gövdesini stateless olarak işler, tek JSON response döner.
 * GET /mcp (SSE akışı) ve DELETE /mcp bu stateless tasarımda gereksizdir — 405.
 */
export const handleMcp = async (request: Request, env: Env): Promise<Response> => {
  if (request.method === 'GET' || request.method === 'DELETE') {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed: bu server statelesstir, yalnizca POST destekler' },
      id: null,
    }), { status: 405, headers: { ...JSON_HEADERS, allow: 'POST' } });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...JSON_HEADERS, allow: 'POST' },
    });
  }

  // Streamable HTTP istemcileri sonucu JSON bekler
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('application/json') && !accept.includes('*/*')) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Not Acceptable: Accept header must include application/json' },
      id: null,
    }), { status: 406, headers: JSON_HEADERS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null,
    }), { status: 400, headers: JSON_HEADERS });
  }

  const transport = new WorkerTransport();
  const server = createMcpServer(env);

  try {
    await server.connect(transport);
  } catch (err) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32603, message: `Internal error: ${err instanceof Error ? err.message : String(err)}` },
      id: null,
    }), { status: 500, headers: JSON_HEADERS });
  }

  // JSON-RPC: id'li her istek tam bir response üretir; notification üretmez.
  const isRequest = (m: unknown) => !!m && typeof m === 'object' && 'id' in (m as object);
  const expectedResponses = Array.isArray(body)
    ? body.filter(isRequest).length
    : isRequest(body) ? 1 : 0;

  // Gelen mesajı server'a ilet; handler'lar async çalışıp response'u send() ile yollar
  const incoming = body as JSONRPCMessage;
  void Promise.resolve(transport.onmessage?.(incoming)).catch(err => transport.onerror?.(err instanceof Error ? err : new Error(String(err))));

  if (expectedResponses > 0) {
    await transport.waitForMessages(expectedResponses);
  }

  if (transport.messages.length === 0) {
    // Yalnızca notification geldi — response beklenmez
    return new Response(null, { status: 202 });
  }

  // Tek response normaldir; birden fazlaysa batch (JSON-RPC batching)
  const payload = transport.messages.length === 1 ? transport.messages[0] : transport.messages;
  return new Response(JSON.stringify(payload), { headers: JSON_HEADERS });
};
