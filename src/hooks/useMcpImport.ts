/**
 * MCP içe aktarma akışı
 *
 * MCP agent'ın ürettiği link (?import_session=<uuid>&draft=<ad> veya
 * &all_drafts=1) ile açılan sayfada: /api/session'dan taslak ders kodlarını
 * ve KATALOGU çeker. Katalog boşsa (link ile ilk kez gelen kullanıcı —
 * localStorage'da ders yok) katalog cevaptan yüklenir; böylece import
 * linki sıfır veriyle açılan sitede de doğrudan çalışır. Sonra kodlar
 * katalogla eşleştirilir ve her draft uygulama tarafında AYRI bir taslak
 * (senaryo) olarak oluşturulur; ilk taslak aktif seçilir. URL
 * parametreleri history.replaceState ile temizlenir (refresh'te tekrar
 * tetiklenmesin).
 */

import { useEffect, useRef, useState } from 'react';
import type { Course, ScheduleScenario } from '../types/Course';
import { getBaseCourseCode } from '../utils/scheduleGenerator';

interface DraftResponse {
  course_codes?: string[];
  updated_at?: string;
  /** Koda göre eligible/tag işaretleri (MCP session state'inden) */
  marks?: Record<string, { eligible?: boolean; tag?: string }>;
  /** Tam katalog — link ile ilk kez gelen kullanıcının localStorage'ı boş olur */
  courses?: Course[];
  /** all_drafts modunda her draftın adı + kodları (app'te ayrı senaryo olur) */
  drafts?: { name: string; course_codes?: string[] }[];
}

export interface McpImportState {
  /** idle = işlem yok */
  status: 'idle' | 'loading' | 'success' | 'error';
  /** Başarıda katalogda eşleşen ders sayısı (draft + işaretleme toplamı) */
  importedCount: number;
  /** Bunlardan kaçı draft'a eklenmişti (isSelected=seçili) */
  draftCount: number;
  /** Bunlardan kaçı yalnızca işaretlenmişti (eligible/tag — draft'ta değil) */
  markedOnlyCount: number;
  /** Linkteki draft'ta olup katalogda bulunamayan kodlar */
  notFoundCodes: string[];
  /** Hata mesajı (404 = süresi doldu) */
  errorMessage: string | null;
  draftName: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScenarioUpdater = (updater: (prev: ScheduleScenario[]) => ScheduleScenario[]) => void;

/** Kod listesini katalogla eşleştir (birebir, sonra base kod: "BUS3002.1" ≈ "BUS3002") */
const matchCodes = (codes: string[], pool: Course[]) => {
  const matchedIds = new Set<string>();
  const notFoundCodes: string[] = [];
  for (const code of codes) {
    const wanted = code.trim().toLowerCase();
    const match = pool.find(c => c.courseCode.toLowerCase() === wanted) ||
      pool.find(c => getBaseCourseCode(c.courseCode).toLowerCase() === wanted);
    if (match) {
      matchedIds.add(match.id);
    } else {
      notFoundCodes.push(code);
    }
  }
  return { matchedIds, notFoundCodes };
};

export const useMcpImport = (
  courses: Course[],
  setCourses: (updater: (prev: Course[]) => Course[]) => void,
  setScenarios?: ScenarioUpdater,
  setActiveScenarioId?: (id: string) => void,
): McpImportState => {
  const [state, setState] = useState<McpImportState>({
    status: 'idle',
    importedCount: 0,
    draftCount: 0,
    markedOnlyCount: 0,
    notFoundCodes: [],
    errorMessage: null,
    draftName: null,
  });
  // URL parametreleri yalnızca ilk mount'ta bir kez okunur
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('import_session');
    const draftName = params.get('draft');
    const allDrafts = params.get('all_drafts') === '1';

    if (!sessionId || (!draftName && !allDrafts)) return;
    ranRef.current = true;

    // Refresh'te tekrar tetiklenmesin diye parametreleri hemen temizle
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);

    if (!UUID_RE.test(sessionId)) {
      setState({ status: 'error', importedCount: 0, draftCount: 0, markedOnlyCount: 0, notFoundCodes: [], errorMessage: 'Geçersiz içe aktarma linki.', draftName });
      return;
    }

    setState(prev => ({ ...prev, status: 'loading', draftName }));

    const run = async () => {
      try {
        const query = allDrafts
          ? `import_session=${encodeURIComponent(sessionId)}&all_drafts=1`
          : `import_session=${encodeURIComponent(sessionId)}&draft=${encodeURIComponent(draftName ?? '')}`;
        const res = await fetch(`/api/session?${query}`);
        if (!res.ok) {
          const errorMessage = res.status === 404
            ? 'Bu içe aktarma linkinin süresi dolmuş (24 saat) veya taslak bulunamadı.'
            : 'İçe aktarma sırasında sunucu hatası oluştu.';
          setState({ status: 'error', importedCount: 0, draftCount: 0, markedOnlyCount: 0, notFoundCodes: [], errorMessage, draftName });
          return;
        }

        const draft = await res.json() as DraftResponse;
        const codes = Array.isArray(draft.course_codes)
          ? draft.course_codes.filter((c): c is string => typeof c === 'string')
          : [];

        // Link ile ilk kez gelen kullanıcının localStorage'ı boştur; katalogu
        // cevaptan yükle. setCourses tarih (history) sistemini atlar — import
        // ilk yükleme sayılır, "geri al" kataloğu geri almamalı.
        let effectiveCourses = courses;
        if (courses.length === 0 && Array.isArray(draft.courses) && draft.courses.length > 0) {
          const catalog = draft.courses.map(c => ({ ...c, isSelected: false, isEligible: false }));
          setCourses(() => catalog);
          effectiveCourses = catalog;
        }

        // Her draftın kodlarını ayrı ayrı eşleştir — her draft uygulamada
        // kendi adıyla ayrı bir senaryo (taslak) olur
        const draftGroups = (allDrafts && Array.isArray(draft.drafts) && draft.drafts.length > 0
          ? draft.drafts
            .filter(d => d && typeof d.name === 'string')
            .map(d => ({ name: d.name, codes: Array.isArray(d.course_codes) ? d.course_codes : [] }))
          : [{ name: draftName ?? 'Taslak', codes }]
        ).map(d => ({ name: d.name, ...matchCodes(d.codes, effectiveCourses) }));

        // Tüm draftların birleşimi (marks eşleştirmesi bu havuz üzerinden)
        const allMatchedIds = new Set<string>();
        const draftMatchedIds = new Set<string>();
        const notFoundCodes: string[] = [];
        for (const g of draftGroups) {
          g.matchedIds.forEach(id => { allMatchedIds.add(id); draftMatchedIds.add(id); });
          notFoundCodes.push(...g.notFoundCodes);
        }

        // Kod → { eligible, tag } işaretleri; katalog eşleşmesiyle birleştirilir
        const marksByCourseId = new Map<string, { eligible?: boolean; tag?: string }>();
        const marks = draft.marks ?? {};
        for (const id of allMatchedIds) {
          const course = effectiveCourses.find(c => c.id === id);
          if (course) {
            const mark = marks[course.courseCode];
            if (mark) marksByCourseId.set(id, mark);
          }
        }

        // Marks'ta olup draft'ta olmayan dersler de (sadece eligible/tag atanmış)
        // uygulanır — add_to_eligible akışı draft gerektirmez
        for (const [code, mark] of Object.entries(marks)) {
          if (!mark.eligible && !mark.tag) continue;
          const match = effectiveCourses.find(c => c.courseCode.toLowerCase() === code.toLowerCase()) ||
            effectiveCourses.find(c => getBaseCourseCode(c.courseCode).toLowerCase() === code.toLowerCase());
          if (match && !allMatchedIds.has(match.id)) {
            allMatchedIds.add(match.id);
            marksByCourseId.set(match.id, mark);
          }
        }

        // Senaryolar: her draft için { name, courseIds }. Import tarih
        // sistemini atlar; yalnızca İLK senaryo aktif olur ve isSelected
        // yalnızca onun derslerine verilir (app'te seçim aktif senaryoyla
        // senkronize — diğer senaryolar kendi courseIds'ini taşır).
        if (setScenarios && setActiveScenarioId) {
          const createdScenarios = draftGroups
            .filter(g => g.matchedIds.size > 0)
            .map((g, i) => ({
              id: `scenario-mcp-${Date.now()}-${i}`,
              name: g.name,
              courseIds: Array.from(g.matchedIds),
              createdAt: Date.now(),
            }));
          if (createdScenarios.length > 0) {
            const activeIds = new Set(createdScenarios[0].courseIds);
            setScenarios(prev => [...prev, ...createdScenarios]);
            setActiveScenarioId(createdScenarios[0].id);
            if (allMatchedIds.size > 0) {
              setCourses(prev => prev.map(c => {
                if (!allMatchedIds.has(c.id)) return c;
                const mark = marksByCourseId.get(c.id);
                return {
                  ...c,
                  isSelected: activeIds.has(c.id),
                  isEligible: true,
                  ...(mark?.tag ? { tag: mark.tag } : {}),
                };
              }));
            }
          }
        } else if (allMatchedIds.size > 0) {
          // Senaryo API'si verilmediyse eski davranış: hepsi seçili
          setCourses(prev => prev.map(c => {
            if (!allMatchedIds.has(c.id)) return c;
            const mark = marksByCourseId.get(c.id);
            const isDraftCourse = draftMatchedIds.has(c.id);
            return {
              ...c,
              isSelected: isDraftCourse,
              isEligible: true,
              ...(mark?.tag ? { tag: mark.tag } : {}),
            };
          }));
        }

        // Draft (programa eklenen) ve yalnızca işaretlenen (eligible/tag,
        // draft'ta olmayan) ayrımı
        const draftCount = draftMatchedIds.size;
        const markedOnlyCount = allMatchedIds.size - draftCount;

        setState({
          status: 'success',
          importedCount: allMatchedIds.size,
          draftCount,
          markedOnlyCount,
          notFoundCodes,
          errorMessage: null,
          draftName,
        });
      } catch {
        setState({ status: 'error', importedCount: 0, draftCount: 0, markedOnlyCount: 0, notFoundCodes: [], errorMessage: 'İçe aktarma başarısız: ağ hatası.', draftName });
      }
    };

    void run();
    // courses yalnızca ilk mount anındaki katalogla eşleştirilir; import tek seferlik
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
};