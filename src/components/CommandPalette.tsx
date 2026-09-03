import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, BookOpen, Check, Plus, Minus, Tag, AlertTriangle, CornerDownLeft } from 'lucide-react';
import type { Course, CustomTag } from '../types/Course';
import { TAG_DOTS, TAG_LABELS, CourseTag } from '../types/Course';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  onToggleSelect: (course: Course) => void;
  onMoveToEligible?: (course: Course) => void;
  onTagChange?: (course: Course, tag: CourseTag | string | undefined) => void;
  customTags?: CustomTag[];
  conflicts?: { courseId: string; message: string }[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  courses,
  onToggleSelect,
  onMoveToEligible,
  onTagChange,
  customTags = [],
  conflicts = []
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [tagDropdownCourseId, setTagDropdownCourseId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Açıldığında input'a odaklan ve aramayı sıfırla
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTagDropdownCourseId(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Dropdown açıkken dışarı tıklayınca kapat
  useEffect(() => {
    if (!tagDropdownCourseId) return;
    const handleOutsideClick = () => setTagDropdownCourseId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [tagDropdownCourseId]);

  // Filtrelenmiş dersler
  const filteredCourses = useMemo(() => {
    if (!search.trim()) {
      // Boşken ilk 15 dersi göster
      return courses.slice(0, 15);
    }

    const term = search.toLowerCase().trim();
    return courses.filter(c => {
      const matchCode = c.courseCode.toLowerCase().includes(term);
      const matchName = c.courseName.toLowerCase().includes(term);
      const matchInstructor = c.instructor?.toLowerCase().includes(term);
      const matchLocation = c.dayTimeLocation?.toLowerCase().includes(term);
      return matchCode || matchName || matchInstructor || matchLocation;
    }).slice(0, 25);
  }, [courses, search]);

  // Klavye olayları (ArrowUp, ArrowDown, Enter, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCourses.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCourses.length) % Math.max(1, filteredCourses.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCourses[selectedIndex]) {
          onToggleSelect(filteredCourses[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCourses, selectedIndex, onToggleSelect, onClose]);

  // Seçili öğeyi kaydırarak görünür tut
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Spotlight Arama Komut Paleti"
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arama Input Satırı */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-zinc-800/80 gap-3">
          <Search className="h-5 w-5 text-indigo-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Ders kodu, adı, hoca veya derslik ara... (örn: CSE, Ahmet, RTE)"
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Sonuç Listesi */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scroll-smooth max-h-[50vh]"
        >
          {filteredCourses.length > 0 ? (
            filteredCourses.map((course, idx) => {
              const isHighlighted = idx === selectedIndex;
              const hasConflict = conflicts.some(c => c.courseId === course.id);
              const customTag = customTags.find(t => t.id === course.tag);
              const builtInTag = Object.values(CourseTag).includes(course.tag as CourseTag) ? (course.tag as CourseTag) : null;

              return (
                <div
                  key={course.id}
                  onClick={() => onToggleSelect(course)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isHighlighted
                      ? 'bg-indigo-50 dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-500/40 shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-900/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                      course.isSelected
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                        : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400'
                    }`}>
                      <BookOpen className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-zinc-100">
                          {course.courseCode}
                        </span>
                        {builtInTag && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                            <span className={`w-1.5 h-1.5 rounded-full ${TAG_DOTS[builtInTag]}`} />
                            {TAG_LABELS[builtInTag]}
                          </span>
                        )}
                        {customTag && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                            <span>{customTag.emoji}</span>
                            {customTag.name}
                          </span>
                        )}
                        {hasConflict && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Çakışma
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-zinc-400 truncate mt-0.5 font-medium">
                        {course.courseName}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                        {course.instructor && <span>{course.instructor}</span>}
                        {course.dayTimeLocation && (
                          <>
                            <span>•</span>
                            <span className="truncate">{course.dayTimeLocation}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Aksiyon Butonları & Etiket */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Durum Rozeti */}
                    {course.isSelected ? (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                        Seçili
                      </span>
                    ) : course.isEligible ? (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                        Uygun
                      </span>
                    ) : null}

                    {/* Artı / Eksi Butonları */}
                    {course.isSelected ? (
                      <button
                        type="button"
                        onClick={() => onToggleSelect(course)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Programdan Kaldır (Uygun Havuzuna Al)"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    ) : course.isEligible ? (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onMoveToEligible?.(course)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title="Uygun Listesinden Çıkar (Geri Al)"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleSelect(course)}
                          className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                          title="Programa Ekle (Takvime Seç)"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleSelect(course)}
                        className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Uygun Derslere Ekle"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}

                    {/* Etiket Seçici Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setTagDropdownCourseId(tagDropdownCourseId === course.id ? null : course.id)}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          course.tag
                            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-zinc-800'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title="Etiket Ata / Değiştir"
                      >
                        <Tag className="h-3.5 w-3.5" />
                      </button>

                      {tagDropdownCourseId === course.id && (
                        <div 
                          className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl p-2 w-48 max-h-60 overflow-y-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[9.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">
                            Sabit Etiketler
                          </div>
                          <div className="space-y-0.5">
                            {Object.values(CourseTag).map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  onTagChange?.(course, course.tag === tag ? undefined : tag);
                                  setTagDropdownCourseId(null);
                                }}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                                  course.tag === tag
                                    ? 'bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 font-bold'
                                    : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-300'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${TAG_DOTS[tag]}`} />
                                  {TAG_LABELS[tag]}
                                </span>
                                {course.tag === tag && <Check className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>

                          {customTags.length > 0 && (
                            <>
                              <div className="text-[9.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1 mt-1.5 border-t border-slate-100 dark:border-zinc-800">
                                Özel Etiketler
                              </div>
                              <div className="space-y-0.5">
                                {customTags.map((tag) => (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => {
                                      onTagChange?.(course, course.tag === tag.id ? undefined : tag.id);
                                      setTagDropdownCourseId(null);
                                    }}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                                      course.tag === tag.id
                                        ? 'bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 font-bold'
                                        : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5 truncate">
                                      <span>{tag.emoji}</span>
                                      <span className="truncate">{tag.name}</span>
                                    </span>
                                    {course.tag === tag.id && <Check className="h-3 w-3" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {course.tag && (
                            <button
                              type="button"
                              onClick={() => {
                                onTagChange?.(course, undefined);
                                setTagDropdownCourseId(null);
                              }}
                              className="w-full mt-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800 text-left px-2 py-1 text-[11px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            >
                              Etiketi Kaldır
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
              <p className="font-semibold text-sm">Eşleşen ders bulunamadı</p>
              <p className="text-xs mt-1">Farklı bir ders kodu veya öğretim üyesi adı deneyin.</p>
            </div>
          )}
        </div>

        {/* Alt Footer - Klavye Kısayol Rehberi */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-900/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono">↓</kbd>
              Gezin
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono flex items-center gap-0.5">
                <CornerDownLeft className="h-2.5 w-2.5" /> Enter
              </kbd>
              Ekle / Çıkar
            </span>
          </div>
          <span className="text-[10.5px] opacity-75">
            {filteredCourses.length} sonuç
          </span>
        </div>
      </div>
    </div>
  );
};
