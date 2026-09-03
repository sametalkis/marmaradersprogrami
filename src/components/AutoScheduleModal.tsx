import React, { useState, useMemo } from 'react';
import { X, Wand2, Calendar, AlertTriangle, Check, Clock, ChevronRight, ChevronLeft, Plus, CheckCircle2 } from 'lucide-react';
import type { Course, SchedulePreferences, ScheduleSuggestion, CustomTag, ParsedSchedule, ScheduleScenario } from '../types/Course';
import { CourseTag, TAG_LABELS, TAG_DOTS, TAG_COLOR_PALETTE, DAYS_OF_WEEK } from '../types/Course';
import { generateScheduleSuggestions, defaultPreferences, countTaggedCourses, countUniqueCourses, countCustomTaggedCourses, countUniqueCustomTaggedCourses } from '../utils/scheduleGenerator';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { parseSchedule } from '../utils/excelParser';
import { COURSE_COLORS, buildCourseColorMap } from '../utils/scheduleRenderUtils';
import type { ScheduleItem } from '../utils/scheduleRenderUtils';

interface AutoScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  eligibleCourses: Course[];
  customTags?: CustomTag[];
  onApplySuggestion: (courses: Course[]) => void;
  scenarios?: ScheduleScenario[];
  activeScenarioId?: string;
  onApplyToScenario?: (courses: Course[], scenarioId?: string, newScenarioName?: string) => void;
}

// Mini Schedule Preview Component - ScheduleViewer ile aynı görünüm
const MiniSchedulePreview: React.FC<{
  courses: Course[];
  customTags: CustomTag[];
}> = ({ courses }) => {
  const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
  
  // En geç bitiş saatini dinamik olarak hesapla (en az 18:00, gerekirse 19:00, 20:00 vs.)
  const maxEndHour = useMemo(() => {
    let maxH = 18;
    courses.forEach(c => {
      const schedules = c.schedules || [parseSchedule(c.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => {
        if (s && s.endTime) {
          const [h, m] = s.endTime.split(':').map(Number);
          const endH = m > 0 ? h + 1 : h;
          if (endH > maxH) maxH = endH;
        }
      });
    });
    return Math.min(23, maxH);
  }, [courses]);

  const START_HOUR = 8;
  const END_HOUR = maxEndHour;
  const hours = useMemo(() => {
    return Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  }, [END_HOUR]);
  
  // Her derse bir renk ata
  const courseColorMap = useMemo(() => buildCourseColorMap(courses), [courses]);
  
  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Dersin pozisyonunu ve genişliğini hesapla (yüzde olarak) - taşmayı kesin olarak önler
  const getCourseStyle = (startTime: string, endTime: string, stackIndex: number, stackSize: number) => {
    const dayStart = START_HOUR * 60; // 08:00
    const dayEnd = END_HOUR * 60;     // Dinamik bitiş saati (örn: 19:00 veya 20:00)
    const totalMinutes = dayEnd - dayStart;
    
    const startMin = timeToMinutes(startTime);
    const [eh, em] = endTime.split(':').map(Number);
    // Marmara 50 dk bloklarında yuvarlama kontrolü
    const endMin = (em >= 45 && em <= 55) ? (eh + 1) * 60 : eh * 60 + em;
    
    const rawLeft = ((startMin - dayStart) / totalMinutes) * 100;
    const rawWidth = ((endMin - startMin) / totalMinutes) * 100;

    const left = Math.max(0, Math.min(100, rawLeft));
    const width = Math.min(100 - left, rawWidth);
    
    // Dikey pozisyon (çakışan dersler için)
    const heightPercent = 100 / stackSize;
    const topPercent = stackIndex * heightPercent;
    
    return { 
      left: `${left}%`, 
      width: `${width}%`,
      top: `${topPercent}%`,
      height: `${heightPercent}%`
    };
  };

  // Çakışma kontrolü
  const checkTimeConflictLocal = (s1: ParsedSchedule, s2: ParsedSchedule): boolean => {
    const start1 = timeToMinutes(s1.startTime);
    const end1 = timeToMinutes(s1.endTime);
    const start2 = timeToMinutes(s2.startTime);
    const end2 = timeToMinutes(s2.endTime);
    return start1 < end2 && start2 < end1;
  };

  // Çakışan dersleri grupla ve stack pozisyonlarını hesapla
  const getScheduleItemsForDay = (day: string): ScheduleItem[] => {
    const daySchedules: { course: Course; schedule: ParsedSchedule }[] = [];
    
    courses.forEach(course => {
      const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => {
        if (s && s.day === day) {
          daySchedules.push({ course, schedule: s });
        }
      });
    });

    const result: ScheduleItem[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < daySchedules.length; i++) {
      if (processed.has(i)) continue;

      const current = daySchedules[i];
      const conflictGroup: number[] = [i];
      
      for (let j = 0; j < daySchedules.length; j++) {
        if (i === j || processed.has(j)) continue;
        
        const other = daySchedules[j];
        if (checkTimeConflictLocal(current.schedule, other.schedule)) {
          conflictGroup.push(j);
        }
      }

      const stackSize = conflictGroup.length;
      conflictGroup.forEach((idx, stackIndex) => {
        processed.add(idx);
        const item = daySchedules[idx];
        result.push({
          course: item.course,
          schedule: item.schedule,
          stackIndex,
          stackSize,
          hasConflict: stackSize > 1
        });
      });
    }

    return result;
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-inner">
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[480px] sm:min-w-full">
          {/* Saat başlıkları */}
          <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
            <div className="w-14 sm:w-16 flex-shrink-0 p-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 text-center"></div>
            <div className="flex-1 flex">
              {hours.map(hour => (
                <div 
                  key={hour} 
                  className="flex-1 text-center text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-zinc-400 py-1.5 sm:py-2 font-mono"
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>
          
          {/* Günler ve dersler */}
          <div className="space-y-1 p-1.5 sm:p-2">
        {days.map(day => {
          const scheduleItems = getScheduleItemsForDay(day);

          return (
            <div key={day} className="flex items-stretch">
              {/* Gün etiketi */}
              <div className="w-16 flex-shrink-0 flex items-center">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-200/50 dark:bg-zinc-800 px-2 py-1.5 rounded-lg w-full text-center">
                  {day.substring(0, 3)}
                </span>
              </div>
              
              {/* Ders alanı */}
              <div className="flex-1 relative bg-slate-100/50 dark:bg-black/40 rounded-lg min-h-[60px] border border-slate-200/50 dark:border-zinc-800/80 ml-1">
                {/* Saat çizgileri */}
                <div className="absolute inset-0 flex">
                  {hours.map((hour, i) => (
                    <div 
                      key={hour} 
                      className={`flex-1 ${i < hours.length - 1 ? 'border-r border-slate-200/50 dark:border-zinc-800/60' : ''}`}
                    />
                  ))}
                </div>
                
                {/* Dersler */}
                {scheduleItems.map(({ course, schedule, stackIndex, stackSize, hasConflict }, idx) => {
                  const style = getCourseStyle(schedule.startTime, schedule.endTime, stackIndex, stackSize);
                  const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
                  const isCompact = stackSize > 1;

                  return (
                    <div
                      key={`${course.id}-${day}-${idx}`}
                      className={`absolute ${hasConflict ? 'ring-2 ring-red-400 ring-offset-1' : ''} ${color.bg} ${color.text} rounded shadow-sm overflow-hidden transition-all hover:shadow-md hover:z-20 cursor-pointer`}
                      style={{ 
                        left: style.left, 
                        width: style.width,
                        top: `calc(${style.top} + 2px)`,
                        height: `calc(${style.height} - 4px)`
                      }}
                      title={`${course.courseCode} - ${course.courseName}\n${course.instructor}\n${schedule.startTime}-${schedule.endTime}\n${schedule.classroom}${hasConflict ? '\nÇakışma var!' : ''}`}
                    >
                      <div className={`${isCompact ? 'p-0.5' : 'p-1.5'} h-full flex flex-col justify-center overflow-hidden`}>
                        <div className={`font-bold ${isCompact ? 'text-[9px]' : 'text-[11px]'} leading-tight truncate`}>
                          {course.courseCode.replace(/\.\d+$/, '')}
                        </div>
                        {!isCompact && (
                          <>
                            <div className="text-[10px] opacity-95 truncate leading-tight font-medium">
                              {course.courseName}
                            </div>
                            <div className="text-[9px] opacity-80 truncate leading-tight mt-0.5">
                              {schedule.startTime}-{schedule.endTime}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
          </div>
        </div>
      </div>
      
      {/* Ders Listesi Legend */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
        <div className="flex flex-wrap gap-1.5">
          {courses.map(course => {
            const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
            return (
              <div 
                key={course.id} 
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${color.light} text-slate-700 dark:text-zinc-200 dark:bg-zinc-800`}
              >
                <div className={`w-2 h-2 rounded-full ${color.bg}`}></div>
                <span className="font-medium">{course.courseCode.replace(/\.\d+$/, '')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  isOpen,
  onClose,
  eligibleCourses,
  customTags = [],
  onApplySuggestion,
  scenarios = [],
  activeScenarioId,
  onApplyToScenario
}) => {
  // Girdiler localStorage'da hatırlanır (sayfa yenilenince kaybolmaz)
  const [preferences, setPreferences] = useLocalStorage<SchedulePreferences>('marmara-wizard-prefs', defaultPreferences);
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<'config' | 'results'>('config');

  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === activeScenarioId);
  }, [scenarios, activeScenarioId]);

  // Sabit etiketli derslerin sayısını hesapla
  const tagCounts = useMemo(() => countTaggedCourses(eligibleCourses), [eligibleCourses]);
  const uniqueCounts = useMemo(() => countUniqueCourses(eligibleCourses), [eligibleCourses]);
  
  // Özel etiketli derslerin sayısını hesapla
  const customTagCounts = useMemo(() => countCustomTaggedCourses(eligibleCourses), [eligibleCourses]);
  const uniqueCustomCounts = useMemo(() => countUniqueCustomTaggedCourses(eligibleCourses), [eligibleCourses]);
  
  const totalTagged = Object.values(tagCounts).reduce((a, b) => a + b, 0) + 
                      Object.values(customTagCounts).reduce((a, b) => a + b, 0);
  const totalUnique = Object.values(uniqueCounts).reduce((a, b) => a + b, 0) +
                      Object.values(uniqueCustomCounts).reduce((a, b) => a + b, 0);
  
  // Özel etiket bilgisini al
  const getCustomTagInfo = (tagId: string) => {
    return customTags.find(t => t.id === tagId);
  };
  
  const getCustomTagColor = (colorId: string) => {
    return TAG_COLOR_PALETTE.find(c => c.id === colorId);
  };

  const handleRequirementChange = (tag: CourseTag, value: number) => {
    setPreferences(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        [tag]: Math.max(0, Math.min(value, uniqueCounts[tag]))
      }
    }));
  };

  const handleCustomRequirementChange = (tagId: string, value: number) => {
    const maxValue = uniqueCustomCounts[tagId] || 0;
    setPreferences(prev => ({
      ...prev,
      customRequirements: {
        ...prev.customRequirements,
        [tagId]: Math.max(0, Math.min(value, maxValue))
      }
    }));
  };

  const toggleFreeDay = (day: string) => {
    setPreferences(prev => {
      const current = prev.freeDays || [];
      const next = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return { ...prev, freeDays: next };
    });
  };

  // Kullanıcın derslerindeki gerçek başlangıç saatleri (sıralı, tekrarsız)
  const availableStartTimes = useMemo(() => {
    const times = new Set<string>();
    eligibleCourses.forEach(c => {
      const schedules = c.schedules && c.schedules.length > 0
        ? c.schedules
        : [parseSchedule(c.dayTimeLocation)].filter(Boolean) as ParsedSchedule[];
      schedules.forEach(s => { if (s?.startTime) times.add(s.startTime); });
    });
    return Array.from(times).sort();
  }, [eligibleCourses]);

  const handleGenerate = () => {
    setIsGenerating(true);
    
    // Async gibi davran (UI donmasın)
    setTimeout(() => {
      const results = generateScheduleSuggestions(eligibleCourses, preferences);
      setSuggestions(results);
      setCurrentIndex(0);
      setIsGenerating(false);
      setStep('results');
    }, 100);
  };

  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApplyCurrent = () => {
    const suggestion = suggestions[currentIndex];
    if (suggestion) {
      if (onApplyToScenario && activeScenarioId) {
        onApplyToScenario(suggestion.courses, activeScenarioId);
      } else {
        onApplySuggestion(suggestion.courses);
      }
      setFeedback(`✓ ${activeScenario?.name || 'Program'} güncellendi!`);
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const handleApplyNewScenario = () => {
    const suggestion = suggestions[currentIndex];
    if (suggestion) {
      const nextNum = scenarios.length + 1;
      const newName = `Taslak ${nextNum} (${suggestion.score}p)`;
      if (onApplyToScenario) {
        onApplyToScenario(suggestion.courses, undefined, newName);
      } else {
        onApplySuggestion(suggestion.courses);
      }
      setFeedback(`✓ ${newName} oluşturuldu!`);
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const resetState = () => {
    setStep('config');
    setSuggestions([]);
    setCurrentIndex(0);
    // preferences bilerek sıfırlanmaz — kullanıcı girdileri localStorage'da hatırlanır
  };

  const handleClose = () => {
    onClose();
    resetState();
  };
  
  const goToPrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };
  
  const goToNext = () => {
    setCurrentIndex(prev => Math.min(suggestions.length - 1, prev + 1));
  };

  if (!isOpen) return null;

  const totalRequired = Object.values(preferences.requirements).reduce((a, b) => a + b, 0) +
                        Object.values(preferences.customRequirements || {}).reduce((a, b) => a + b, 0);
  
  const currentSuggestion = suggestions[currentIndex];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="auto-schedule-title">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className={`relative bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full transform transition-all h-[94vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-900 ${
        step === 'results' ? 'max-w-4xl' : 'max-w-2xl'
      }`}>
        {/* Header */}
        <div className="bg-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-white/10 text-white rounded-lg flex-shrink-0">
                <Wand2 className="h-4 sm:h-5 w-4 sm:w-5" />
              </div>
              <div>
                <h3 id="auto-schedule-title" className="text-base sm:text-xl font-bold text-white tracking-tight">Otomatik Program Oluştur</h3>
                <p className="text-slate-400 text-[11px] sm:text-xs font-medium">
                  {step === 'config' ? 'Tercihlerini belirle' : `${suggestions.length} öneri bulundu`}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
          {step === 'config' ? (
            <>
              {/* Uyarı - Etiketli ders yoksa */}
              {totalTagged === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Etiketli ders bulunamadı!</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Otomatik program oluşturmak için önce "Uygun Dersler" bölümünden derslere etiket atamalısın 
                        (Zorunlu, Seçmeli, Önemli, İsteğe Bağlı).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4 mb-6">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    <strong>{totalUnique}</strong> farklı ders bulundu ({totalTagged} section). 
                    <span className="block mt-1 text-indigo-600 dark:text-indigo-400">
                      Not: Aynı dersin farklı section'larından (örn: XXX.1, XXX.2) sadece biri seçilir.
                    </span>
                  </p>
                </div>
              )}

                {/* Ders Sayıları */}
                  <div className="space-y-4 mb-6">
                  <h4 className="font-semibold text-slate-700 dark:text-zinc-200">Kaç ders almak istiyorsun?</h4>

                  {/* Sabit Etiketler */}
                  {Object.values(CourseTag).map(tag => (
                    <div key={tag} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-zinc-900/80 rounded-xl p-3 sm:p-4 border border-slate-200/60 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <span className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full flex-shrink-0 ${TAG_DOTS[tag]}`} />
                        <div className="min-w-0">
                          <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-zinc-200 block sm:inline">{TAG_LABELS[tag]}</span>
                          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 sm:ml-2 block sm:inline">
                            ({uniqueCounts[tag]} ders{tagCounts[tag] > uniqueCounts[tag] ? `, ${tagCounts[tag]} sect.` : ''})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleRequirementChange(tag, preferences.requirements[tag] - 1)}
                          disabled={preferences.requirements[tag] <= 0}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold active:scale-95 transition-all text-base cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 sm:w-8 text-center font-bold text-sm sm:text-base font-mono dark:text-white">
                          {preferences.requirements[tag]}
                        </span>
                        <button
                          onClick={() => handleRequirementChange(tag, preferences.requirements[tag] + 1)}
                          disabled={preferences.requirements[tag] >= uniqueCounts[tag]}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold active:scale-95 transition-all text-base cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Özel Etiketler */}
                  {customTags.map(customTag => {
                    const tagId = customTag.id;
                    const count = customTagCounts[tagId] || 0;
                    const uniqueCount = uniqueCustomCounts[tagId] || 0;
                    const colorStyle = TAG_COLOR_PALETTE.find(c => c.id === customTag.color);
                    const currentValue = preferences.customRequirements[tagId] || 0;

                    return (
                      <div
                        key={tagId}
                        className={`flex items-center justify-between gap-2 rounded-xl p-3 sm:p-4 border border-slate-200/60 dark:border-zinc-800/80 ${colorStyle?.light || 'bg-slate-50 dark:bg-zinc-900/80'}`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <span className="text-base sm:text-lg flex-shrink-0">{customTag.emoji}</span>
                          <div className="min-w-0">
                            <span className={`font-semibold text-xs sm:text-sm block sm:inline ${colorStyle?.text || 'text-slate-800 dark:text-zinc-200'}`}>
                              {customTag.name}
                            </span>
                            <span className="text-[11px] sm:text-xs opacity-70 sm:ml-2 block sm:inline dark:text-zinc-400">
                              ({uniqueCount} ders{count > uniqueCount ? `, ${count} sect.` : ''})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleCustomRequirementChange(tagId, currentValue - 1)}
                            disabled={currentValue <= 0}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold active:scale-95 transition-all text-base cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 sm:w-8 text-center font-bold text-sm sm:text-base font-mono dark:text-white">
                            {currentValue}
                          </span>
                          <button
                            onClick={() => handleCustomRequirementChange(tagId, currentValue + 1)}
                            disabled={currentValue >= uniqueCount}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold active:scale-95 transition-all text-base cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tercihler */}
                <div className="space-y-3 mb-6">
                  <h4 className="font-semibold text-slate-700 dark:text-zinc-200">Tercihler</h4>
                  
                  <label className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.allowConflicts}
                      onChange={e => setPreferences(prev => ({ 
                        ...prev, 
                        allowConflicts: e.target.checked,
                        maxConflicts: e.target.checked ? 1 : 0
                      }))}
                      className="w-5 h-5 rounded text-violet-600"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-700 dark:text-zinc-200">Çakışmaya izin ver</span>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">Bazı dersler aynı saatte olabilir</p>
                    </div>
                    {preferences.allowConflicts && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 dark:text-zinc-400">Max:</span>
                        <select
                          value={preferences.maxConflicts}
                          onChange={e => setPreferences(prev => ({ ...prev, maxConflicts: parseInt(e.target.value) }))}
                          className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 px-2 py-1 text-sm cursor-pointer"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                    )}
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.avoidEarlyMorning}
                      onChange={e => setPreferences(prev => ({ ...prev, avoidEarlyMorning: e.target.checked }))}
                      className="w-5 h-5 rounded text-violet-600"
                    />
                    <div>
                      <span className="font-medium text-slate-700 dark:text-zinc-200">Sabah 08:00-09:00 derslerinden kaçın</span>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">Erken saatler tercih edilmez</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.preferCompactSchedule}
                      onChange={e => setPreferences(prev => ({ ...prev, preferCompactSchedule: e.target.checked }))}
                      className="w-5 h-5 rounded text-violet-600"
                    />
                    <div>
                      <span className="font-medium text-slate-700 dark:text-zinc-200">Kompakt program tercih et</span>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">Dersler arası boşluk az olsun</p>
                    </div>
                  </label>

                  {/* Gelişmiş Kısıtlar */}
                  <div className="bg-slate-50 dark:bg-zinc-900/60 rounded-xl p-4 border border-slate-200/60 dark:border-zinc-800/80 space-y-4">
                    <div>
                      <h5 className="font-semibold text-slate-700 dark:text-zinc-200 text-sm">Gelişmiş Kısıtlar</h5>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Bu kurallara uymayan dersler otomatik olarak elenir
                      </p>
                    </div>

                    {/* En erken ders başlangıcı — seçenekler kullanıcının derslerinden gelir */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm text-slate-700 dark:text-zinc-200 flex-shrink-0">En erken ders başlangıcı</span>
                      <select
                        value={preferences.earliestStartTime || ''}
                        onChange={e => setPreferences(prev => ({ ...prev, earliestStartTime: e.target.value || undefined }))}
                        className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 px-2 py-1 text-sm cursor-pointer"
                      >
                        <option value="">Yok</option>
                        {availableStartTimes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Boş günler */}
                    <div>
                      <span className="font-medium text-sm text-slate-700 dark:text-zinc-200 block mb-2">Boş günler</span>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 -mt-1 mb-2">
                        Bu günlerde ders olmasını istemediğin günleri seç
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_OF_WEEK.map(day => {
                          const isSelected = (preferences.freeDays || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleFreeDay(day)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer active:scale-95 ${
                                isSelected
                                  ? 'bg-violet-600 border-violet-600 text-white hover:bg-violet-500'
                                  : 'bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
                              }`}
                            >
                              {day.substring(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Saat koruması — belirtilen aralıkta ders olmasın */}
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.blockTimeRange || false}
                          onChange={e => setPreferences(prev => ({ ...prev, blockTimeRange: e.target.checked }))}
                          className="w-5 h-5 rounded text-violet-600"
                        />
                        <div>
                          <span className="font-medium text-sm text-slate-700 dark:text-zinc-200">Saat koruması</span>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">Bu saat aralığında ders olmasın</p>
                        </div>
                      </label>
                      <div className={`flex items-center gap-2 mt-2 pl-8 ${!(preferences.blockTimeRange) ? 'opacity-40 pointer-events-none' : ''}`}>
                        <input
                          type="time"
                          value={preferences.blockTimeStart || '12:00'}
                          onChange={e => setPreferences(prev => ({ ...prev, blockTimeStart: e.target.value || '12:00' }))}
                          disabled={!preferences.blockTimeRange}
                          aria-label="Korumalı aralık başlangıcı"
                          className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 px-2 py-1 text-sm font-mono disabled:cursor-not-allowed"
                        />
                        <span className="text-sm text-slate-500 dark:text-zinc-400">-</span>
                        <input
                          type="time"
                          value={preferences.blockTimeEnd || '13:00'}
                          onChange={e => setPreferences(prev => ({ ...prev, blockTimeEnd: e.target.value || '13:00' }))}
                          disabled={!preferences.blockTimeRange}
                          aria-label="Korumalı aralık bitişi"
                          className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 px-2 py-1 text-sm font-mono disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Results Step - Carousel View */
              <div>
                {suggestions.length === 0 ? (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl p-6 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="font-medium text-red-800 dark:text-red-200">Uygun program bulunamadı!</p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-2">
                      Tercihlerini değiştirmeyi veya çakışmaya izin vermeyi dene.
                    </p>
                    <button
                      onClick={() => setStep('config')}
                      className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                    >
                      Geri Dön
                    </button>
                  </div>
                ) : currentSuggestion && (
                  <div className="space-y-4">
                    {/* Navigation Header */}
                    <div className="flex items-center justify-between gap-2 p-1">
                      <button
                        onClick={goToPrev}
                        disabled={currentIndex === 0}
                        className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                        aria-label="Önceki öneri"
                      >
                        <ChevronLeft className="h-5 sm:h-6 w-5 sm:w-6 text-slate-700 dark:text-zinc-200" />
                      </button>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                          <span className="text-base sm:text-xl font-bold text-slate-800 dark:text-white">
                            Öneri {currentIndex + 1}
                          </span>
                          <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-bold ${
                            currentSuggestion.score >= 80 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50' 
                              : currentSuggestion.score >= 50 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800/50'
                          }`}>
                            {currentSuggestion.score} puan
                          </span>
                          {currentSuggestion.conflictCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/50">
                              {currentSuggestion.conflictCount} çakışma
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                          {currentIndex + 1} / {suggestions.length}
                        </p>
                      </div>
                      
                      <button
                        onClick={goToNext}
                        disabled={currentIndex === suggestions.length - 1}
                        className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                        aria-label="Sonraki öneri"
                      >
                        <ChevronRight className="h-5 sm:h-6 w-5 sm:w-6 text-slate-700 dark:text-zinc-200" />
                      </button>
                    </div>
                    
                    {/* Schedule Preview */}
                    <MiniSchedulePreview 
                      courses={currentSuggestion.courses} 
                      customTags={customTags}
                    />
                    
                    {/* Info Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-zinc-900/60 rounded-xl p-3 sm:p-4 border border-slate-200/60 dark:border-zinc-800/60">
                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          <span className="font-semibold">{currentSuggestion.summary.totalCourses} ders</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          <span className="font-semibold font-mono">{currentSuggestion.summary.earliestStart} - {currentSuggestion.summary.latestEnd}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {currentSuggestion.summary.days.map(day => (
                          <span key={day} className="px-2 py-0.5 bg-slate-200/80 dark:bg-zinc-800 rounded-md text-[10px] sm:text-xs font-bold text-slate-700 dark:text-zinc-300">
                            {day.substring(0, 3)}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Course List */}
                    <div className="flex flex-wrap gap-1.5">
                      {currentSuggestion.courses.map(course => {
                        let tagStyle = 'bg-white border-slate-200 text-slate-700';
                        
                        if (course.tag) {
                          if (course.tag === CourseTag.MANDATORY) {
                            tagStyle = 'bg-red-100 border-red-300 text-red-800';
                          } else if (course.tag === CourseTag.ELECTIVE) {
                            tagStyle = 'bg-blue-100 border-blue-300 text-blue-800';
                          } else if (course.tag === CourseTag.IMPORTANT) {
                            tagStyle = 'bg-amber-100 border-amber-300 text-amber-800';
                          } else if (course.tag === CourseTag.OPTIONAL) {
                            tagStyle = 'bg-slate-100 border-slate-300 text-slate-700';
                          } else {
                            const customTag = getCustomTagInfo(course.tag);
                            if (customTag) {
                              const colorStyle = getCustomTagColor(customTag.color);
                              tagStyle = `${colorStyle?.light || 'bg-slate-100'} ${colorStyle?.border || 'border-slate-300'} ${colorStyle?.text || 'text-slate-700'}`;
                            }
                          }
                        }
                        
                        return (
                          <span 
                            key={course.id} 
                            className={`px-2 py-1 border rounded-lg text-[11px] sm:text-xs font-bold font-mono ${tagStyle}`}
                            title={course.courseName}
                          >
                            {course.courseCode}
                          </span>
                        );
                      })}
                    </div>
                    
                    {/* Pagination Dots */}
                    <div className="flex justify-center gap-1.5 pt-2">
                      {suggestions.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentIndex(idx)}
                          aria-label={`Öneri ${idx + 1}`}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx === currentIndex 
                              ? 'bg-indigo-600' 
                              : 'bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400 dark:hover:bg-zinc-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-900 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              {step === 'config' ? (
                <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 text-center sm:text-left">
                    Toplam: <span className="font-bold text-slate-800 dark:text-white font-mono">{totalRequired}</span> ders seçilecek
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={totalRequired === 0 || isGenerating}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-indigo-600/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Oluşturuluyor...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Program Öner
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="px-3 py-2 text-xs sm:text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      ← Geri
                    </button>
                    {feedback && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-in fade-in duration-150">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span>{feedback}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* 1. Yeni Taslak Olarak Ekle Butonu */}
                    <button
                      type="button"
                      onClick={handleApplyNewScenario}
                      disabled={suggestions.length === 0}
                      className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Mevcut taslağı bozmadan yeni bir taslağa kaydet"
                    >
                      <Plus className="h-4 w-4" />
                      <span>+ Yeni Taslağa Ekle</span>
                    </button>

                    {/* 2. Mevcut Aktif Taslağa Uygula Butonu */}
                    <button
                      type="button"
                      onClick={handleApplyCurrent}
                      disabled={suggestions.length === 0}
                      className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                      title={`${activeScenario?.name || 'Mevcut Taslak'} üzerine uygula`}
                    >
                      <Check className="h-4 w-4" />
                      <span>{activeScenario ? `${activeScenario.name}'a Uygula` : 'Bu Programı Uygula'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
