import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, ClipboardPaste, Check, AlertCircle, Sparkles, Trash2, 
  BookOpen, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import type { Course, CustomTag } from '../types/Course';
import { CourseTag, TAG_LABELS, TAG_DOTS, TAG_COLOR_PALETTE } from '../types/Course';
import { extractCourseCodes, matchCoursesWithCodes } from '../utils/courseCodeExtractor';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  onBatchAddToEligible: (courseIds: string[], assignTag?: CourseTag | string) => void;
  customTags?: CustomTag[];
}

const SAMPLE_TEXT = `DECISION SCIENCE CURRICULUM
ACC3041 Cost Accounting
MIS3021 Management Information Systems
PROD3001 Operations Management
STAT3001 Statistical Data Analysis
BUS4091 Electronic Business
MIS3311 Knowledge Management
MIS3313 Business Intelligence
QTDS4053 Operations Research Applications
QTDS4054 Python for Data Analysis
STAT4093 Forecasting`;

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  courses,
  onBatchAddToEligible,
  customTags = []
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedTag, setSelectedTag] = useState<CourseTag | string | 'none'>('none');
  const [excludedCodeSet, setExcludedCodeSet] = useState<Set<string>>(new Set());
  const [showUnmatched, setShowUnmatched] = useState(false);

  // Metin değiştikçe veya modal açıldığında analiz yap
  const analysis = useMemo(() => {
    if (!inputText.trim()) {
      return {
        totalExtractedCodes: 0,
        matchedCodes: [],
        unmatchedCodes: [],
        totalMatchedCourses: 0,
        allMatchedCourseIds: []
      };
    }

    const codes = extractCourseCodes(inputText);
    return matchCoursesWithCodes(codes, courses);
  }, [inputText, courses]);

  // Modal açıldığında input temizliği (veya kapatırken)
  useEffect(() => {
    if (!isOpen) {
      setExcludedCodeSet(new Set());
      setShowUnmatched(false);
    }
  }, [isOpen]);

  // Hariç tutulmamış ve gerçekten eklenecek course ID'leri
  const finalCourseIdsToAdd = useMemo(() => {
    const ids: string[] = [];
    analysis.matchedCodes.forEach(item => {
      if (!excludedCodeSet.has(item.normalizedCode)) {
        item.matchedCourses.forEach(c => ids.push(c.id));
      }
    });
    return ids;
  }, [analysis, excludedCodeSet]);

  const toggleCodeSelection = (normalizedCode: string) => {
    setExcludedCodeSet(prev => {
      const next = new Set(prev);
      if (next.has(normalizedCode)) {
        next.delete(normalizedCode);
      } else {
        next.add(normalizedCode);
      }
      return next;
    });
  };

  const handleApply = () => {
    if (finalCourseIdsToAdd.length === 0) return;
    const tagToAssign = selectedTag === 'none' ? undefined : (selectedTag as CourseTag | string);
    onBatchAddToEligible(finalCourseIdsToAdd, tagToAssign);
    onClose();
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="batch-import-title"
    >
      {/* Arka Plan Bulanıklığı */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Kutusu */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all h-[92vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-850">
          
          {/* Header */}
          <div className="bg-slate-900 px-4 sm:px-6 py-4 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <ClipboardPaste className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="batch-import-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Metinden Toplu Ders Ekle
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* İçerik */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* Metin Alanı ve Aksiyonları */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Metni Buraya Yapıştırın
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInputText(SAMPLE_TEXT)}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    Örnek Doldur
                  </button>
                  {inputText && (
                    <button
                      type="button"
                      onClick={() => setInputText('')}
                      className="text-[11px] font-bold text-red-500 hover:underline flex items-center gap-1 cursor-pointer ml-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Temizle
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Örn: ACC3041 Cost Accounting 5 ECTS, MIS3021 Management Information Systems, PROD3001..."
                className="w-full h-32 sm:h-36 p-3 text-xs sm:text-sm font-mono border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600"
              />
            </div>

            {/* Canlı Sonuç Paneli */}
            {inputText.trim() ? (
              <div className="space-y-3">
                {/* İstatistik Çubukları */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center">
                    <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400">Metindeki Kodlar</div>
                    <div className="text-base sm:text-xl font-bold font-mono text-slate-800 dark:text-white mt-0.5">
                      {analysis.totalExtractedCodes}
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-center">
                    <div className="text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300">Eşleşen Section'lar</div>
                    <div className="text-base sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {finalCourseIdsToAdd.length}
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-center">
                    <div className="text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-300">Açılmayan Dersler</div>
                    <div className="text-base sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                      {analysis.unmatchedCodes.length}
                    </div>
                  </div>
                </div>

                {/* Eşleşen Dersler Listesi (Seçilebilir haplar) */}
                {analysis.matchedCodes.length > 0 && (
                  <div className="p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-zinc-300">
                        Eklenecek Dersler ({analysis.matchedCodes.length})
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        (Dersi çıkarmak için üzerine dokunun)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-thin">
                      {analysis.matchedCodes.map(item => {
                        const isExcluded = excludedCodeSet.has(item.normalizedCode);
                        const firstMatch = item.matchedCourses[0];

                        return (
                          <button
                            key={item.normalizedCode}
                            type="button"
                            onClick={() => toggleCodeSelection(item.normalizedCode)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                              !isExcluded
                                ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700/80 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                : 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 line-through opacity-60'
                            }`}
                            title={firstMatch ? `${firstMatch.courseName} (${item.matchedCourses.length} section)` : item.normalizedCode}
                          >
                            <CheckCircle2 className={`h-3 w-3 ${!isExcluded ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-0'}`} />
                            <span>{item.normalizedCode}</span>
                            <span className="text-[10px] font-normal opacity-70">
                              ({item.matchedCourses.length} sec)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bulunamayan / Dönemde Açılmamış Dersler */}
                {analysis.unmatchedCodes.length > 0 && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowUnmatched(!showUnmatched)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        Sistemde Bulunamayan {analysis.unmatchedCodes.length} Kod (Bu dönem programda yer almıyor olabilir)
                      </span>
                      {showUnmatched ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {showUnmatched && (
                      <div className="p-2.5 pt-0 flex flex-wrap gap-1.5 text-xs">
                        {analysis.unmatchedCodes.map(code => (
                          <span
                            key={code}
                            className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-mono text-[11px] font-semibold border border-amber-200 dark:border-amber-800/60"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Boş Durum Bilgilendirme Kartı */
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 text-slate-600 dark:text-zinc-400">
                  <p className="font-bold text-slate-800 dark:text-zinc-200">Nasıl Çalışır?</p>
                  <p>
                    Bölümünüzün müfredat listesini, OBS'den aldığınız dersleri veya arkadaşınızdan gelen ders kodlarını olduğu gibi buraya yapıştırın. 
                    Format önemli değildir; sistem <strong>ACC3041</strong>, <strong>MIS 3021</strong>, <strong>QTDS4053</strong> gibi tüm dersleri otomatik tanır ve ilgili dersin tüm section'larını Uygun Havuzuna ekler.
                  </p>
                </div>
              </div>
            )}

            {/* İsteğe Bağlı Etiket Atama */}
            {finalCourseIdsToAdd.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-900 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Eklenen Derslere Etiket Ata (İsteğe Bağlı)
                </label>
                
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTag('none')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedTag === 'none'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-transparent shadow-sm'
                        : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-200'
                    }`}
                  >
                    Etiket Yok
                  </button>

                  {Object.values(CourseTag).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(tag)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        selectedTag === tag
                          ? 'bg-indigo-600 text-white border-transparent shadow-md shadow-indigo-600/30 scale-100'
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${TAG_DOTS[tag]}`} />
                      <span>{TAG_LABELS[tag]}</span>
                    </button>
                  ))}

                  {customTags.map(cTag => {
                    const colorStyle = TAG_COLOR_PALETTE.find(c => c.id === cTag.color);
                    return (
                      <button
                        key={cTag.id}
                        type="button"
                        onClick={() => setSelectedTag(cTag.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          selectedTag === cTag.id
                            ? 'bg-indigo-600 text-white border-transparent shadow-md shadow-indigo-600/30'
                            : `${colorStyle?.light || 'bg-slate-100 dark:bg-zinc-900'} ${colorStyle?.text || 'text-slate-700 dark:text-zinc-300'} border-slate-200 dark:border-zinc-800`
                        }`}
                      >
                        <span>{cTag.emoji}</span>
                        <span>{cTag.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-900 flex-shrink-0 flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              Vazgeç
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={finalCourseIdsToAdd.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>
                {finalCourseIdsToAdd.length > 0 
                  ? `${finalCourseIdsToAdd.length} Dersi Uygun Havuzuna Ekle`
                  : 'Ders Seçilmedi'}
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
