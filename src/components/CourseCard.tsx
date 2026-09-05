import { useState, useRef, useEffect } from 'react';
import { Clock, User, MapPin, Plus, Minus, AlertTriangle, Tag, ChevronDown } from 'lucide-react';
import type { Course, CustomTag, ParsedSchedule } from '../types/Course';
import { CourseTag, TAG_COLORS, TAG_LABELS, TAG_DOTS, TAG_COLOR_PALETTE } from '../types/Course';
import { parseSchedule } from '../utils/excelParser';

interface CourseCardProps {
  course: Course;
  onToggleSelect?: (course: Course) => void;
  onMoveToEligible?: (course: Course) => void;
  onTagChange?: (course: Course, tag: CourseTag | string | undefined) => void;
  customTags?: CustomTag[];
  showActions?: boolean;
  hasConflict?: boolean;
  conflictMessage?: string;
  compact?: boolean;
  onHover?: (course: Course) => void;
  onLeave?: () => void;
}

export const CourseCard = ({
  course,
  onToggleSelect,
  onMoveToEligible,
  onTagChange,
  customTags = [],
  showActions = true,
  hasConflict = false,
  conflictMessage,
  onHover,
  onLeave
}: CourseCardProps) => {
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTagDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagDropdown]);

  const schedules: ParsedSchedule[] = (course.schedules || [parseSchedule(course.dayTimeLocation)]).filter((s): s is ParsedSchedule => s !== null);
  const firstSchedule = schedules[0];

  // Etiket bilgisini al (sabit veya özel)
  const isBuiltInTag = (tag: string | undefined): tag is CourseTag => {
    return Object.values(CourseTag).includes(tag as CourseTag);
  };

  const getTagInfo = () => {
    if (!course.tag) return null;

    if (isBuiltInTag(course.tag)) {
      return {
        label: TAG_LABELS[course.tag],
        colorClass: TAG_COLORS[course.tag],
        dotClass: TAG_DOTS[course.tag],
        bgColor: course.tag === CourseTag.MANDATORY ? 'bg-red-500' :
                 course.tag === CourseTag.ELECTIVE ? 'bg-blue-500' :
                 course.tag === CourseTag.IMPORTANT ? 'bg-amber-500' : 'bg-slate-400'
      };
    }
    
    // Özel etiket
    const customTag = customTags.find(t => t.id === course.tag);
    if (customTag) {
      const colorStyle = TAG_COLOR_PALETTE.find(c => c.id === customTag.color);
      return {
        label: customTag.name,
        colorClass: `${colorStyle?.light || 'bg-slate-100'} ${colorStyle?.text || 'text-slate-800'} ${colorStyle?.border || 'border-slate-200'}`,
        dotClass: colorStyle?.bg || 'bg-slate-500',
        bgColor: colorStyle?.bg || 'bg-slate-500',
        isCustom: true,
        customEmoji: customTag.emoji
      };
    }
    
    return null;
  };

  const tagInfo = getTagInfo();

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect) {
      onToggleSelect(course);
    }
  };

  const handleMoveToEligible = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMoveToEligible) {
      onMoveToEligible(course);
    }
  };

  const handleTagChange = (tag: CourseTag | string | undefined) => {
    if (onTagChange) {
      onTagChange(course, tag);
    }
    setShowTagDropdown(false);
  };

  return (
    <div 
      className={`
        bg-white dark:bg-zinc-950 rounded-lg border p-3 transition-shadow hover:shadow-sm cursor-pointer
        ${hasConflict ? 'border-red-300 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40' : 'border-slate-200 dark:border-zinc-900 hover:border-slate-300 dark:hover:border-zinc-800'}
        ${course.isSelected ? 'ring-2 ring-accent-500 border-accent-300 dark:border-accent-700' : ''}
      `}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={() => onHover?.(course)}
      onMouseLeave={() => onLeave?.()}
    >
      {/* Ana Satır */}
      <div className="flex items-center gap-3">
        {/* Tag Rengi */}
        {tagInfo && (
          <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${tagInfo.bgColor}`} />
        )}
        
        {/* İçerik */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{course.courseCode}</span>
            {course.isSelected ? (
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-accent-100 dark:bg-accent-950/80 text-accent-700 dark:text-accent-300">
                Seçili
              </span>
            ) : course.isEligible ? (
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                Uygun
              </span>
            ) : null}
            {tagInfo && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${tagInfo.colorClass} inline-flex items-center gap-1`}>
                {tagInfo.isCustom ? (
                  <span className="text-[10px]">{tagInfo.customEmoji}</span>
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${tagInfo.dotClass}`} />
                )}
              </span>
            )}
            {hasConflict && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{course.courseName}</p>
          {course.instructor && (
            <p className="text-[11px] font-medium text-slate-700 dark:text-zinc-300 truncate mt-0.5 flex items-center gap-1">
              <User className="h-3 w-3 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
              <span className="truncate">{course.instructor}</span>
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            {firstSchedule && (
              <span>{firstSchedule.day.substring(0, 3)} {firstSchedule.startTime}</span>
            )}
            {schedules.length > 1 && (
              <span className="text-accent-600 dark:text-accent-400 font-semibold">+{schedules.length - 1}</span>
            )}
          </div>
        </div>
        
        {/* Aksiyonlar */}
        {showActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {course.isSelected ? (
              <button
                onClick={handleSelect}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                title="Programdan Kaldır (Uygun Havuzuna Al)"
              >
                <Minus className="h-4 w-4" />
              </button>
            ) : course.isEligible ? (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleMoveToEligible}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  title="Uygun Listesinden Çıkar (Geri Al)"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleSelect}
                  className="p-2 text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-950/50 rounded-lg transition-colors cursor-pointer"
                  title="Programa Ekle (Takvime Seç)"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSelect}
                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                title="Uygun Derslere Ekle"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}

            {/* Tag Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagDropdown(!showTagDropdown);
                }}
                className={`relative flex items-center justify-center rounded-lg transition-all active:scale-95 ${
                  course.tag
                    ? 'px-2 py-1 gap-1 bg-slate-100 dark:bg-zinc-800/90 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 shadow-xs'
                    : showTagDropdown
                    ? 'p-2 bg-accent-50 dark:bg-zinc-800 text-accent-600 dark:text-accent-400 ring-2 ring-accent-500/30 rounded-lg'
                    : 'p-2 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg'
                }`}
                title={course.tag ? `Etiket: ${tagInfo?.label} (Değiştir)` : 'Etiket Ekle'}
                aria-expanded={showTagDropdown}
                aria-label="Etiket seç"  
                aria-haspopup="listbox"
              >
                {tagInfo ? (
                  tagInfo.isCustom ? (
                    <span className="text-xs select-none">{tagInfo.customEmoji}</span>
                  ) : (
                    <span className={`w-2 h-2 rounded-full ${tagInfo.dotClass} shadow-xs`} />
                  )
                ) : (
                  <Tag className="h-3.5 w-3.5" />
                )}
              </button>

              {showTagDropdown && (
                <div
                  className="absolute right-0 top-full mt-2 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200 dark:border-zinc-700/90 rounded-2xl shadow-2xl p-2.5 w-56 select-none"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowTagDropdown(false); }}
                  role="listbox"
                  aria-label="Etiket listesi"
                >
                  {/* Başlık ve Kaldır Butonu */}
                  <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-[10.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Ders Etiketi
                    </span>
                    {course.tag && (
                      <button
                        onClick={() => handleTagChange(undefined)}
                        className="flex items-center gap-1 text-[11px] font-bold text-red-500 dark:text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 px-1.5 py-0.5 rounded-md transition-colors"
                        title="Etiketi Kaldır"
                      >
                        <Minus className="h-2.5 w-2.5" />
                        Kaldır
                      </button>
                    )}
                  </div>

                  {/* Sabit Etiketler (2x2 Kompakt Grid) */}
                  <div className="mb-2.5">
                    <div className="text-[9.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-1 mb-1.5">
                      Sabit Etiketler
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.values(CourseTag).map((tag) => {
                        const isSelected = course.tag === tag;
                        return (
                          <button
                            key={tag}
                            onClick={() => handleTagChange(tag)}
                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all border text-left relative ${
                              isSelected
                                ? 'bg-accent-50 dark:bg-zinc-800 border-accent-300 dark:border-accent-500/60 text-accent-900 dark:text-white shadow-xs'
                                : 'bg-slate-50/80 dark:bg-zinc-800/40 hover:bg-slate-100 dark:hover:bg-zinc-800 border-slate-200/60 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TAG_DOTS[tag]}`} />
                            <span className="truncate">{TAG_LABELS[tag]}</span>
                            {isSelected && <span className="ml-auto text-accent-600 dark:text-accent-400 text-[10px] font-bold">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Özel Etiketler Bölümü */}
                  <div>
                    <div className="text-[9.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-1 mb-1.5">
                      Özel Etiketler
                    </div>
                    {customTags.length > 0 ? (
                      <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin pr-0.5">
                        {customTags.map((tag) => {
                          const isSelected = course.tag === tag.id;
                          return (
                            <button
                              key={tag.id}
                              onClick={() => handleTagChange(tag.id)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all text-left border ${
                                isSelected
                                  ? 'bg-accent-50 dark:bg-zinc-800 border-accent-300 dark:border-accent-500/60 text-accent-900 dark:text-white shadow-xs'
                                  : 'bg-slate-50/60 dark:bg-zinc-800/30 hover:bg-slate-100 dark:hover:bg-zinc-800 border-slate-200/60 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                              }`}
                            >
                              <span className="text-sm select-none">{tag.emoji}</span>
                              <span className="truncate flex-1">{tag.name}</span>
                              {isSelected && <span className="text-accent-600 dark:text-accent-400 text-[10px] font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-center rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-dashed border-slate-200 dark:border-zinc-800 text-[11px] text-slate-400 dark:text-zinc-500">
                        Henüz özel etiket yok
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        )}
      </div>
      
      {/* Genişletilmiş Detaylar */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs space-y-1.5">
          <div className="flex items-center text-slate-600 dark:text-zinc-400">
            <User className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
            <span className="truncate">{course.instructor || 'Belirtilmemiş'}</span>
          </div>
          {schedules.map((schedule, index) => (
            <div key={index} className="flex items-center text-slate-600 dark:text-zinc-400">
              <Clock className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
              <span>{schedule.day} {schedule.startTime}-{schedule.endTime}</span>
              <MapPin className="h-3 w-3 mx-1.5 flex-shrink-0" />
              <span className="truncate">{schedule.classroom}</span>
            </div>
          ))}
          {hasConflict && conflictMessage && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded text-red-700 dark:text-red-300 text-[11px] flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              {conflictMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
