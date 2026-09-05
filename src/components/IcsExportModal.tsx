import React from 'react';
import { Calendar, X, Download, AlertTriangle } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface IcsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (semesterStartDate: string, weekCount: number) => void;
  /** Dışa aktarılamayacak ders kodları */
  skippedCourseCodes?: string[];
}

/** Bugünden sonraki ilk Pazartesi'yi 'YYYY-MM-DD' olarak döner */
const getNextMonday = (): string => {
  const now = new Date();
  const dow = now.getDay(); // 0=Pazar
  const daysUntilMonday = dow === 1 ? 7 : (8 - dow) % 7 || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
};

const DEFAULT_SEMESTER_START = getNextMonday();
const DEFAULT_WEEK_COUNT = 14;

export const IcsExportModal: React.FC<IcsExportModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  skippedCourseCodes = [],
}) => {
  const [semesterStart, setSemesterStart] = useLocalStorage<string>(
    'marmara-ics-semester-start',
    DEFAULT_SEMESTER_START
  );
  const [weekCount, setWeekCount] = useLocalStorage<number>(
    'marmara-ics-week-count',
    DEFAULT_WEEK_COUNT
  );

  if (!isOpen) return null;

  const safeWeekCount = Math.min(Math.max(Number(weekCount) || DEFAULT_WEEK_COUNT, 1), 30);

  const handleConfirm = () => {
    onConfirm(semesterStart || DEFAULT_SEMESTER_START, safeWeekCount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="ics-export-modal-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl max-w-md w-full transform transition-all border border-slate-200 dark:border-zinc-900">
          {/* Header */}
          <div className="bg-slate-900 rounded-t-2xl px-6 py-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-accent-500/10 border border-accent-500/20 rounded-xl text-accent-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 id="ics-export-modal-title" className="text-xl font-bold text-white tracking-tight">Takvime Aktar (.ics)</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Seçili dersler, haftalık tekrarlayan takvim etkinlikleri olarak dışa aktarılır.
            </p>

            {/* Dönem başlangıcı */}
            <div>
              <label htmlFor="ics-semester-start" className="block text-sm font-semibold text-slate-700 dark:text-zinc-200 mb-1.5">
                Dönem Başlangıcı
              </label>
              <input
                id="ics-semester-start"
                type="date"
                value={semesterStart}
                onChange={(e) => setSemesterStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/60 focus:border-accent-500 transition-colors cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              />
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                Etkinlikler bu haftadan itibaren tekrar eder.
              </p>
            </div>

            {/* Hafta sayısı */}
            <div>
              <label htmlFor="ics-week-count" className="block text-sm font-semibold text-slate-700 dark:text-zinc-200 mb-1.5">
                Hafta Sayısı
              </label>
              <input
                id="ics-week-count"
                type="number"
                min={1}
                max={30}
                value={weekCount}
                onChange={(e) => setWeekCount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/60 focus:border-accent-500 transition-colors"
              />
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                1-30 arası bir değer girin (varsayılan 14 hafta).
              </p>
            </div>

            {/* Atlanan dersler uyarısı */}
            {skippedCourseCodes.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Bazı dersler dışa aktarılamadı</p>
                    <p>
                      Geçerli gün/saat bilgisi bulunamadığı için şu dersler atlandı:{' '}
                      <span className="font-mono font-semibold">{skippedCourseCodes.join(', ')}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Buttons */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-950 rounded-b-2xl flex gap-3 justify-end border-t border-slate-200 dark:border-zinc-900">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <X className="h-4 w-4" />
              İptal
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2.5 text-white bg-accent-600 hover:bg-accent-500 active:scale-[0.98] rounded-xl font-medium transition-all flex items-center gap-2 shadow-sm shadow-accent-600/25 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Dışa Aktar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
