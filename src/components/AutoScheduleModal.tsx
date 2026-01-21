import React, { useState, useMemo } from 'react';
import { X, Wand2, Calendar, AlertTriangle, Check, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import type { Course, SchedulePreferences, ScheduleSuggestion, CustomTag, ParsedSchedule } from '../types/Course';
import { CourseTag, TAG_LABELS, TAG_COLOR_PALETTE } from '../types/Course';
import { generateScheduleSuggestions, defaultPreferences, countTaggedCourses, countUniqueCourses, countCustomTaggedCourses, countUniqueCustomTaggedCourses } from '../utils/scheduleGenerator';
import { parseSchedule } from '../utils/excelParser';

interface AutoScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  eligibleCourses: Course[];
  customTags?: CustomTag[];
  onApplySuggestion: (courses: Course[]) => void;
}

// Ders renkleri - her ders için farklı renk (ScheduleViewer ile aynı)
const COURSE_COLORS = [
  { bg: 'bg-violet-500', text: 'text-white', light: 'bg-violet-100' },
  { bg: 'bg-emerald-500', text: 'text-white', light: 'bg-emerald-100' },
  { bg: 'bg-amber-500', text: 'text-white', light: 'bg-amber-100' },
  { bg: 'bg-rose-500', text: 'text-white', light: 'bg-rose-100' },
  { bg: 'bg-cyan-500', text: 'text-white', light: 'bg-cyan-100' },
  { bg: 'bg-fuchsia-500', text: 'text-white', light: 'bg-fuchsia-100' },
  { bg: 'bg-lime-500', text: 'text-white', light: 'bg-lime-100' },
  { bg: 'bg-orange-500', text: 'text-white', light: 'bg-orange-100' },
  { bg: 'bg-teal-500', text: 'text-white', light: 'bg-teal-100' },
  { bg: 'bg-indigo-500', text: 'text-white', light: 'bg-indigo-100' },
];

interface ScheduleItem {
  course: Course;
  schedule: ParsedSchedule;
  stackIndex: number;
  stackSize: number;
  hasConflict: boolean;
}

// Mini Schedule Preview Component - ScheduleViewer ile aynı görünüm
const MiniSchedulePreview: React.FC<{
  courses: Course[];
  customTags: CustomTag[];
}> = ({ courses }) => {
  const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
  const hours = Array.from({ length: 11 }, (_, i) => 8 + i); // 08:00 - 18:00
  
  // Her derse bir renk ata
  const courseColorMap = useMemo(() => {
    const map = new Map<string, typeof COURSE_COLORS[0]>();
    courses.forEach((course, index) => {
      map.set(course.id, COURSE_COLORS[index % COURSE_COLORS.length]);
    });
    return map;
  }, [courses]);
  
  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Dersin pozisyonunu ve genişliğini hesapla (yüzde olarak)
  const getCourseStyle = (startTime: string, endTime: string, stackIndex: number, stackSize: number) => {
    const dayStart = 8 * 60; // 08:00
    const dayEnd = 18 * 60;  // 18:00
    const totalMinutes = dayEnd - dayStart;
    
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    
    const left = ((startMin - dayStart) / totalMinutes) * 100;
    const width = ((endMin - startMin) / totalMinutes) * 100;
    
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
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Saat başlıkları */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <div className="w-16 flex-shrink-0 p-2 text-xs font-semibold text-slate-500 text-center"></div>
        <div className="flex-1 flex">
          {hours.map(hour => (
            <div 
              key={hour} 
              className="flex-1 text-center text-[11px] font-semibold text-slate-500 py-2"
            >
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>
      
      {/* Günler ve dersler */}
      <div className="space-y-1 p-2">
        {days.map(day => {
          const scheduleItems = getScheduleItemsForDay(day);

          return (
            <div key={day} className="flex items-stretch">
              {/* Gün etiketi */}
              <div className="w-16 flex-shrink-0 flex items-center">
                <span className="text-xs font-bold text-slate-700 bg-slate-200/50 px-2 py-1.5 rounded-lg w-full text-center">
                  {day.substring(0, 3)}
                </span>
              </div>
              
              {/* Ders alanı */}
              <div className="flex-1 relative bg-slate-100/50 rounded-lg min-h-[60px] border border-slate-200/50 ml-1">
                {/* Saat çizgileri */}
                <div className="absolute inset-0 flex">
                  {hours.map((hour, i) => (
                    <div 
                      key={hour} 
                      className={`flex-1 ${i < hours.length - 1 ? 'border-r border-slate-200/50' : ''}`}
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
                      title={`${course.courseCode} - ${course.courseName}\n${course.instructor}\n${schedule.startTime}-${schedule.endTime}\n${schedule.classroom}${hasConflict ? '\n⚠️ Çakışma var!' : ''}`}
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
      
      {/* Ders Listesi Legend */}
      <div className="px-3 py-2 border-t border-slate-200 bg-slate-50">
        <div className="flex flex-wrap gap-1.5">
          {courses.map(course => {
            const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
            return (
              <div 
                key={course.id} 
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${color.light} text-slate-700`}
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
  onApplySuggestion
}) => {
  const [preferences, setPreferences] = useState<SchedulePreferences>(defaultPreferences);
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<'config' | 'results'>('config');

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

  const handleApply = () => {
    const suggestion = suggestions[currentIndex];
    if (suggestion) {
      onApplySuggestion(suggestion.courses);
      onClose();
      resetState();
    }
  };

  const resetState = () => {
    setStep('config');
    setSuggestions([]);
    setCurrentIndex(0);
    setPreferences(defaultPreferences);
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`relative bg-white rounded-2xl shadow-2xl w-full transform transition-all max-h-[90vh] overflow-hidden flex flex-col ${
          step === 'results' ? 'max-w-4xl' : 'max-w-2xl'
        }`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Wand2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Otomatik Program Oluştur</h3>
                  <p className="text-violet-200 text-sm">
                    {step === 'config' ? 'Tercihlerini belirle' : `${suggestions.length} öneri bulundu`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 'config' ? (
              <>
                {/* Uyarı - Etiketli ders yoksa */}
                {totalTagged === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">Etiketli ders bulunamadı!</p>
                        <p className="text-sm text-amber-700 mt-1">
                          Otomatik program oluşturmak için önce "Uygun Dersler" bölümünden derslere etiket atamalısın 
                          (Zorunlu, Seçmeli, Önemli, İsteğe Bağlı).
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                    <p className="text-sm text-indigo-700">
                      <strong>{totalUnique}</strong> farklı ders bulundu ({totalTagged} section). 
                      <span className="block mt-1 text-indigo-600">
                        💡 Aynı dersin farklı section'larından (örn: XXX.1, XXX.2) sadece biri seçilir.
                      </span>
                    </p>
                  </div>
                )}

                {/* Ders Sayıları */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-semibold text-slate-700">Kaç ders almak istiyorsun?</h4>
                  
                  {/* Sabit Etiketler */}
                  {Object.values(CourseTag).map(tag => (
                    <div key={tag} className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{TAG_LABELS[tag].split(' ')[0]}</span>
                        <div>
                          <span className="font-medium text-slate-700">{TAG_LABELS[tag].split(' ')[1]}</span>
                          <span className="text-sm text-slate-500 ml-2">
                            ({uniqueCounts[tag]} ders{tagCounts[tag] > uniqueCounts[tag] ? `, ${tagCounts[tag]} section` : ''})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRequirementChange(tag, preferences.requirements[tag] - 1)}
                          disabled={preferences.requirements[tag] <= 0}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-lg">
                          {preferences.requirements[tag]}
                        </span>
                        <button
                          onClick={() => handleRequirementChange(tag, preferences.requirements[tag] + 1)}
                          disabled={preferences.requirements[tag] >= uniqueCounts[tag]}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Özel Etiketler */}
                  {Object.entries(customTagCounts).map(([tagId, count]) => {
                    const customTag = getCustomTagInfo(tagId);
                    if (!customTag) return null;
                    
                    const colorStyle = getCustomTagColor(customTag.color);
                    const uniqueCount = uniqueCustomCounts[tagId] || 0;
                    const currentValue = preferences.customRequirements[tagId] || 0;
                    
                    return (
                      <div 
                        key={tagId} 
                        className={`flex items-center justify-between rounded-xl p-4 ${colorStyle?.light || 'bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{customTag.emoji}</span>
                          <div>
                            <span className={`font-medium ${colorStyle?.text || 'text-slate-700'}`}>
                              {customTag.name}
                            </span>
                            <span className="text-sm opacity-70 ml-2">
                              ({uniqueCount} ders{count > uniqueCount ? `, ${count} section` : ''})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCustomRequirementChange(tagId, currentValue - 1)}
                            disabled={currentValue <= 0}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-lg">
                            {currentValue}
                          </span>
                          <button
                            onClick={() => handleCustomRequirementChange(tagId, currentValue + 1)}
                            disabled={currentValue >= uniqueCount}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <h4 className="font-semibold text-slate-700">Tercihler</h4>
                  
                  <label className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 transition-colors">
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
                      <span className="font-medium text-slate-700">Çakışmaya izin ver</span>
                      <p className="text-sm text-slate-500">Bazı dersler aynı saatte olabilir</p>
                    </div>
                    {preferences.allowConflicts && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Max:</span>
                        <select
                          value={preferences.maxConflicts}
                          onChange={e => setPreferences(prev => ({ ...prev, maxConflicts: parseInt(e.target.value) }))}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                    )}
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.avoidEarlyMorning}
                      onChange={e => setPreferences(prev => ({ ...prev, avoidEarlyMorning: e.target.checked }))}
                      className="w-5 h-5 rounded text-violet-600"
                    />
                    <div>
                      <span className="font-medium text-slate-700">Sabah 08:00-09:00 derslerinden kaçın</span>
                      <p className="text-sm text-slate-500">Erken saatler tercih edilmez</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.preferCompactSchedule}
                      onChange={e => setPreferences(prev => ({ ...prev, preferCompactSchedule: e.target.checked }))}
                      className="w-5 h-5 rounded text-violet-600"
                    />
                    <div>
                      <span className="font-medium text-slate-700">Kompakt program tercih et</span>
                      <p className="text-sm text-slate-500">Dersler arası boşluk az olsun</p>
                    </div>
                  </label>
                </div>
              </>
            ) : (
              /* Results Step - Carousel View */
              <div>
                {suggestions.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="font-medium text-red-800">Uygun program bulunamadı!</p>
                    <p className="text-sm text-red-600 mt-2">
                      Tercihlerini değiştirmeyi veya çakışmaya izin vermeyi dene.
                    </p>
                    <button
                      onClick={() => setStep('config')}
                      className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Geri Dön
                    </button>
                  </div>
                ) : currentSuggestion && (
                  <div className="space-y-4">
                    {/* Navigation Header */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={goToPrev}
                        disabled={currentIndex === 0}
                        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xl font-bold text-slate-800">
                            Öneri {currentIndex + 1}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            currentSuggestion.score >= 80 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : currentSuggestion.score >= 50 
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {currentSuggestion.score} puan
                          </span>
                          {currentSuggestion.conflictCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                              {currentSuggestion.conflictCount} çakışma
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {currentIndex + 1} / {suggestions.length}
                        </p>
                      </div>
                      
                      <button
                        onClick={goToNext}
                        disabled={currentIndex === suggestions.length - 1}
                        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </div>
                    
                    {/* Schedule Preview */}
                    <MiniSchedulePreview 
                      courses={currentSuggestion.courses} 
                      customTags={customTags}
                    />
                    
                    {/* Info Bar */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{currentSuggestion.summary.totalCourses} ders</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{currentSuggestion.summary.earliestStart} - {currentSuggestion.summary.latestEnd}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {currentSuggestion.summary.days.map(day => (
                          <span key={day} className="px-2 py-0.5 bg-slate-200 rounded text-xs text-slate-600">
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
                            className={`px-2 py-1 border rounded text-xs font-medium ${tagStyle}`}
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
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx === currentIndex 
                              ? 'bg-violet-500' 
                              : 'bg-slate-300 hover:bg-slate-400'
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
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              {step === 'config' ? (
                <>
                  <div className="text-sm text-slate-600">
                    Toplam: <span className="font-bold text-slate-800">{totalRequired}</span> ders seçilecek
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={totalRequired === 0 || isGenerating}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep('config')}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                  >
                    ← Geri
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={suggestions.length === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Bu Programı Uygula
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
