/**
 * MCP içe aktarma akışı
 *
 * MCP agent'ın ürettiği link (?import_session=<uuid>&draft=<ad>) ile açılan
 * sayfada: /api/session'dan taslak ders kodlarını çeker, yüklü katalogla
 * eşleştirir ve eşleşen dersleri seçili işaretler. URL parametreleri
 * history.replaceState ile temizlenir (refresh'te tekrar tetiklenmesin).
 */

import { useEffect, useRef, useState } from 'react';
import type { Course } from '../types/Course';
import { getBaseCourseCode } from '../utils/scheduleGenerator';

interface DraftResponse {
  course_codes?: string[];
  updated_at?: string;
  /** Koda göre eligible/tag işaretleri (MCP session state'inden) */
  marks?: Record<string, { eligible?: boolean; tag?: string }>;
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

export const useMcpImport = (
  courses: Course[],
  setCourses: (updater: (prev: Course[]) => Course[]) => void
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

        // Katalogla eşleştir (birebir, sonra base kod: "BUS3002.1" ≈ "BUS3002")
        const matchedIds = new Set<string>();
        const draftMatchedIds = new Set<string>();
        const notFoundCodes: string[] = [];
        // Kod → { eligible, tag } işaretleri; katalog eşleşmesiyle birleştirilir
        const marksByCourseId = new Map<string, { eligible?: boolean; tag?: string }>();
        const marks = draft.marks ?? {};

        for (const code of codes) {
          const wanted = code.trim().toLowerCase();
          const match = courses.find(c => c.courseCode.toLowerCase() === wanted) ||
            courses.find(c => getBaseCourseCode(c.courseCode).toLowerCase() === wanted);
          if (match) {
            matchedIds.add(match.id);
            draftMatchedIds.add(match.id);
            const mark = marks[match.courseCode];
            if (mark) marksByCourseId.set(match.id, mark);
          } else {
            notFoundCodes.push(code);
          }
        }

        // Marks'ta olup draft'ta olmayan dersler de (sadece eligible/tag atanmış)
        // uygulanır — add_to_eligible akışı draft gerektirmez
        for (const [code, mark] of Object.entries(marks)) {
          if (!mark.eligible && !mark.tag) continue;
          const match = courses.find(c => c.courseCode.toLowerCase() === code.toLowerCase()) ||
            courses.find(c => getBaseCourseCode(c.courseCode).toLowerCase() === code.toLowerCase());
          if (match && !matchedIds.has(match.id)) {
            matchedIds.add(match.id);
            marksByCourseId.set(match.id, mark);
          }
        }

        if (matchedIds.size > 0) {
          setCourses(prev => prev.map(c => {
            if (!matchedIds.has(c.id)) return c;
            const mark = marksByCourseId.get(c.id);
            return {
              ...c,
              isSelected: true,
              isEligible: true,
              ...(mark?.tag ? { tag: mark.tag } : {}),
            };
          }));
        }

        // Draft (programa eklenen) ve yalnızca işaretlenen (eligible/tag,
        // draft'ta olmayan) ayrımı — bildirimde net ayrım için
        const draftCount = draftMatchedIds.size;
        const markedOnlyCount = matchedIds.size - draftCount;

        setState({
          status: 'success',
          importedCount: matchedIds.size,
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
