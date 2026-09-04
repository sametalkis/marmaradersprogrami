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
}

export interface McpImportState {
  /** idle = işlem yok */
  status: 'idle' | 'loading' | 'success' | 'error';
  /** Başarıda katalogda eşleşen ders sayısı */
  importedCount: number;
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

    if (!sessionId || !draftName) return;
    ranRef.current = true;

    // Refresh'te tekrar tetiklenmesin diye parametreleri hemen temizle
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);

    if (!UUID_RE.test(sessionId)) {
      setState({ status: 'error', importedCount: 0, notFoundCodes: [], errorMessage: 'Geçersiz içe aktarma linki.', draftName });
      return;
    }

    setState(prev => ({ ...prev, status: 'loading', draftName }));

    const run = async () => {
      try {
        const res = await fetch(`/api/session?import_session=${encodeURIComponent(sessionId)}&draft=${encodeURIComponent(draftName)}`);
        if (!res.ok) {
          const errorMessage = res.status === 404
            ? 'Bu içe aktarma linkinin süresi dolmuş (24 saat) veya taslak bulunamadı.'
            : 'İçe aktarma sırasında sunucu hatası oluştu.';
          setState({ status: 'error', importedCount: 0, notFoundCodes: [], errorMessage, draftName });
          return;
        }

        const draft = await res.json() as DraftResponse;
        const codes = Array.isArray(draft.course_codes)
          ? draft.course_codes.filter((c): c is string => typeof c === 'string')
          : [];

        // Katalogla eşleştir (birebir, sonra base kod: "BUS3002.1" ≈ "BUS3002")
        const matchedIds = new Set<string>();
        const notFoundCodes: string[] = [];
        for (const code of codes) {
          const wanted = code.trim().toLowerCase();
          const match = courses.find(c => c.courseCode.toLowerCase() === wanted) ||
            courses.find(c => getBaseCourseCode(c.courseCode).toLowerCase() === wanted);
          if (match) matchedIds.add(match.id);
          else notFoundCodes.push(code);
        }

        if (matchedIds.size > 0) {
          // Uygunluk havuzu bozulmadan seçim işaretlenir
          setCourses(prev => prev.map(c =>
            matchedIds.has(c.id) ? { ...c, isSelected: true, isEligible: true } : c
          ));
        }

        setState({
          status: 'success',
          importedCount: matchedIds.size,
          notFoundCodes,
          errorMessage: null,
          draftName,
        });
      } catch {
        setState({ status: 'error', importedCount: 0, notFoundCodes: [], errorMessage: 'İçe aktarma başarısız: ağ hatası.', draftName });
      }
    };

    void run();
    // courses yalnızca ilk mount anındaki katalogla eşleştirilir; import tek seferlik
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
};
