import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, AlertTriangle, Columns, Rows, Sparkles, Plus, Pencil, Check, X } from 'lucide-react';
import type { Course, CustomTag, ScheduleScenario, ParsedSchedule } from '../types/Course';
import { DAYS_OF_WEEK, CourseTag, TAG_LABELS, TAG_DOTS } from '../types/Course';
import { findScheduleConflicts } from '../utils/scheduleManager';
import { parseSchedule, checkTimeConflict } from '../utils/excelParser';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { COURSE_COLORS, timeToMinutes, endTimeToMinutes, getScheduleItemsForDay, buildCourseColorMap } from '../utils/scheduleRenderUtils';
import type { ScheduleItem } from '../utils/scheduleRenderUtils';
import { ScheduleStats } from './ScheduleStats';

interface ScheduleViewerProps {
  courses: Course[];
  customTags?: CustomTag[];
  hoveredCourse?: Course | null;
  scenarios?: ScheduleScenario[];
  activeScenarioId?: string;
  onSelectScenario?: (id: string) => void;
  onAddScenario?: () => void;
  onDeleteScenario?: (id: string) => void;
  onRenameScenario?: (id: string, newName: string) => void;
  onToggleCourseSelect?: (course: Course) => void;
}

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({ 
  courses, 
  customTags = [],
  hoveredCourse,
  scenarios = [],
  activeScenarioId,
  onSelectScenario,
  onAddScenario,
  onDeleteScenario,
  onRenameScenario,
  onToggleCourseSelect
}) => {
  const [viewMode, setViewMode] = useLocalStorage<'vertical' | 'horizontal'>('marmara-schedule-view-mode', 'vertical');
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedConflictCourse, setSelectedConflictCourse] = useState<Course | null>(null);
  const conflicts = findScheduleConflicts(courses);
  const selectedCourses = courses.filter(c => c.isSelected);
  
  // Her derse bir renk ata
  const courseColorMap = useMemo(() => buildCourseColorMap(selectedCourses), [selectedCourses]);

  // Akşam dersleri ve İkinci Öğretim için dinamik saat aralığı (Derslerin bitişine göre tam A4 oranı)
  const maxCourseEndHour = useMemo(() => {
    let maxHour = 17; // Standart gün 17:00'de biter, akşam dersi varsa otomatik uzar
    selectedCourses.forEach(course => {
      const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => {
        if (s && s.endTime) {
          const [h, m] = s.endTime.split(':').map(Number);
          const endH = m > 0 ? h + 1 : h;
          if (endH > maxHour) maxHour = endH;
        }
      });
    });
    return Math.min(maxHour, 23);
  }, [selectedCourses]);

  // Mobilde varsayılan gün: Bugün hafta içi ise bugün, değilse Pazartesi
  const defaultMobileDay = useMemo(() => {
    const dayIdx = new Date().getDay(); // 0 = Pazar, 1 = Pzt, ... 5 = Cuma
    if (dayIdx >= 1 && dayIdx <= 5) {
      return DAYS_OF_WEEK[dayIdx - 1];
    }
    return DAYS_OF_WEEK[0]; // Pazartesi
  }, []);

  const [selectedMobileDay, setSelectedMobileDay] = useState<string>(defaultMobileDay);

  // Taslak çubuğu: mouse wheel'i yatay kaydırmaya çevir (scrollbar gizli olduğundan tek yol olsun).
  // Native listener (React onWheel passive olduğu için preventDefault çalışmaz).
  const scenarioBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = scenarioBarRef.current;
    if (!bar) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // yatay wheel/touchpad'e dokunma
      bar.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    bar.addEventListener('wheel', onWheel, { passive: false });
    return () => bar.removeEventListener('wheel', onWheel);
  }, []);

  // Günlere göre ders sayıları (Mobilde gün haplarının üzerinde rozet olarak gösterilir)
  const courseCountByDay = useMemo(() => {
    const counts: { [day: string]: number } = {};
    DAYS_OF_WEEK.forEach(day => {
      counts[day] = getScheduleItemsForDay(selectedCourses, day).length;
    });
    return counts;
  }, [selectedCourses]);

  const HOUR_HEIGHT = 64; // Her saat diliminin yüksekliği (px)
  const START_HOUR = 8;
  const END_HOUR = maxCourseEndHour;
  const hours = useMemo(() => {
    return Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
  }, [END_HOUR]);

  // Dikey ders pozisyonu ve yüksekliği hesaplama
  const getCourseStyleVertical = (startTime: string, endTime: string, stackIndex: number, stackSize: number) => {
    const dayStartMin = START_HOUR * 60; // 08:00
    const startMin = timeToMinutes(startTime);
    const endMin = endTimeToMinutes(endTime);
    
    // Dikey pozisyon ve Yükseklik (px)
    const topPx = (startMin - dayStartMin) * (HOUR_HEIGHT / 60);
    const heightPx = Math.max((endMin - startMin) * (HOUR_HEIGHT / 60), 30);
    
    // Yatay pozisyon (çakışan dersler için sütun içi bölüşüm)
    const widthPercent = 100 / stackSize;
    const leftPercent = stackIndex * widthPercent;
    
    return { 
      top: `${topPx}px`, 
      height: `${heightPx}px`,
      left: `${leftPercent}%`,
      width: `${widthPercent}%`
    };
  };

  // Yatay ders pozisyonu ve genişliği hesaplama
  const getCourseStyleHorizontal = (startTime: string, endTime: string, stackIndex: number, stackSize: number) => {
    const dayStartMin = START_HOUR * 60; // 08:00
    const dayEndMin = END_HOUR * 60;
    const totalMin = dayEndMin - dayStartMin;

    const startMin = timeToMinutes(startTime);
    const endMin = endTimeToMinutes(endTime);

    const leftPercent = ((startMin - dayStartMin) / totalMin) * 100;
    const widthPercent = ((endMin - startMin) / totalMin) * 100;

    const heightPercent = 100 / stackSize;
    const topPercent = stackIndex * heightPercent;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      top: `${topPercent}%`,
      height: `${heightPercent}%`
    };
  };

  // Günleri sadece ders olanlar için filtrele (Cumartesi/Pazar boşsa gösterme)
  const daysWithCourses = useMemo(() => {
    const daysSet = new Set<string>();
    selectedCourses.forEach(course => {
      const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => s && daysSet.add(s.day));
    });
    if (hoveredCourse) {
      const isAlreadySelected = selectedCourses.some(c => c.id === hoveredCourse.id);
      if (!isAlreadySelected) {
        const hSchedules = hoveredCourse.schedules || [parseSchedule(hoveredCourse.dayTimeLocation)].filter(Boolean);
        hSchedules.forEach(s => s && daysSet.add(s.day));
      }
    }
    return DAYS_OF_WEEK.filter(day => daysSet.has(day) || ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'].includes(day));
  }, [selectedCourses, hoveredCourse]);

  // Hover edilen dersin o günkü hayalet blokları ve anlık çakışma durumu
  const getHoveredGhostsForDay = (day: string) => {
    if (!hoveredCourse) return [];

    // Zaten seçili olan ders için hayalet gösterme (zaten takvimde var)
    const isAlreadySelected = selectedCourses.some(c => c.id === hoveredCourse.id);
    if (isAlreadySelected) return [];

    const hSchedules = (hoveredCourse.schedules || [parseSchedule(hoveredCourse.dayTimeLocation)])
      .filter((s): s is ParsedSchedule => s !== null && s.day === day);

    if (hSchedules.length === 0) return [];

    // Seçili derslerle çakışma kontrolü (kendi ID'sini hariç tutarak)
    const selectedItemsForDay = getScheduleItemsForDay(selectedCourses, day);

    return hSchedules.map(hSched => {
      let hasConflict = false;
      let conflictCourseCode: string | undefined = undefined;

      for (const selItem of selectedItemsForDay) {
        if (selItem.course.id === hoveredCourse.id) continue;

        if (checkTimeConflict(hSched, selItem.schedule)) {
          hasConflict = true;
          conflictCourseCode = selItem.course.courseCode;
          break;
        }
      }

      return {
        schedule: hSched,
        hasConflict,
        conflictCourseCode
      };
    });
  };

  // Hover edilen dersin çakıştığı mevcut seçili derslerin ID kümesi (takvimde parlama efekti için)
  const hoveredConflictCourseIds = useMemo(() => {
    if (!hoveredCourse) return new Set<string>();
    const isAlreadySelected = selectedCourses.some(c => c.id === hoveredCourse.id);
    if (isAlreadySelected) return new Set<string>();

    const hSchedules = (hoveredCourse.schedules || [parseSchedule(hoveredCourse.dayTimeLocation)]).filter(Boolean);
    const conflictingIds = new Set<string>();

    for (const selCourse of selectedCourses) {
      if (selCourse.id === hoveredCourse.id) continue;
      const selSchedules = (selCourse.schedules || [parseSchedule(selCourse.dayTimeLocation)]).filter(Boolean);
      for (const hSched of hSchedules) {
        if (!hSched) continue;
        for (const sSched of selSchedules) {
          if (!sSched) continue;
          if (checkTimeConflict(hSched, sSched)) {
            conflictingIds.add(selCourse.id);
          }
        }
      }
    }
    return conflictingIds;
  }, [hoveredCourse, selectedCourses]);

  // Etiketlere göre ders sayılarını hesapla (sabit ve özel)
  const tagCounts = useMemo(() => {
    const builtIn: { [key in CourseTag]?: number } = {};
    const custom: { [key: string]: number } = {};
    
    selectedCourses.forEach(course => {
      if (course.tag) {
        // Sabit etiket mi kontrol et
        if (Object.values(CourseTag).includes(course.tag as CourseTag)) {
          builtIn[course.tag as CourseTag] = (builtIn[course.tag as CourseTag] || 0) + 1;
        } else {
          // Özel etiket
          custom[course.tag] = (custom[course.tag] || 0) + 1;
        }
      }
    });
    
    return { builtIn, custom };
  }, [selectedCourses]);

  // Özel etiket bilgisini al
  const getCustomTagInfo = (tagId: string) => {
    return customTags.find(t => t.id === tagId);
  };

  return (
    <div className="bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-900 overflow-hidden">
      {/* Başlık */}
      <div className="bg-slate-900 dark:bg-black px-6 py-4 border-b border-slate-800 dark:border-zinc-900">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg text-white">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Haftalık Ders Programı</h2>
              <p className="text-slate-400 text-xs font-medium">{selectedCourses.length} ders seçildi</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Dikey / Yatay Smooth Sliding Geçiş Butonları (PDF çıktısında ve mobilde gizlenir) */}
            <div data-html2canvas-ignore="true" className="relative hidden sm:flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 shadow-inner select-none min-w-[170px]" role="radiogroup" aria-label="Görünüm modu">
              {/* Animasyonlu vurgu rengi arka plan kaydırıcısı */}
              <div
                className="absolute top-1 bottom-1 bg-accent-600 rounded-lg transition-all duration-300 ease-out shadow-sm pointer-events-none"
                style={{
                  left: viewMode === 'vertical' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)'
                }}
              />
              <button
                onClick={() => setViewMode('vertical')}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                  viewMode === 'vertical' ? 'text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Dikey Görünüm (Günler Üstte)"
                role="radio"
                aria-checked={viewMode === 'vertical'}
                aria-label="Dikey görünüm"
              >
                <Columns className="h-3.5 w-3.5" />
                Dikey
              </button>
              <button
                onClick={() => setViewMode('horizontal')}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                  viewMode === 'horizontal' ? 'text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Yatay Görünüm (Saatler Üstte)"
                role="radio"
                aria-checked={viewMode === 'horizontal'}
                aria-label="Yatay görünüm"
              >
                <Rows className="h-3.5 w-3.5" />
                Yatay
              </button>
            </div>

            {conflicts.length > 0 && (
              <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span>{conflicts.length} Çakışma Var</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Senaryo / Taslak Sekmeleri */}
      {scenarios.length > 0 && (
        <div data-html2canvas-ignore="true" className="flex items-center gap-1.5 px-3 sm:px-6 py-2 bg-slate-100/80 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-900">
          {/* Çipler çoksa yatay kaydırma; "Taslaklar:" etiketi ve "Yeni Taslak" sabit kalır */}
          <div ref={scenarioBarRef} className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0 scroll-smooth">
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1 flex-shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-accent-500" />
              Taslaklar:
            </span>
            {scenarios.map((sc) => {
            const isActive = activeScenarioId === sc.id;
            const isEditing = editingScenarioId === sc.id;

            if (isEditing) {
              return (
                <form
                  key={sc.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingName.trim()) {
                      onRenameScenario?.(sc.id, editingName.trim());
                    }
                    setEditingScenarioId(null);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-900 rounded-xl border-2 border-accent-500 shadow-md ring-2 ring-accent-500/20 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditingScenarioId(null);
                      }
                    }}
                    onBlur={() => {
                      if (editingName.trim()) {
                        onRenameScenario?.(sc.id, editingName.trim());
                      }
                      setEditingScenarioId(null);
                    }}
                    className="text-xs font-bold text-slate-800 dark:text-zinc-100 bg-transparent outline-none w-24 sm:w-28 px-1"
                    placeholder="Taslak adı..."
                  />
                  <button
                    type="submit"
                    onMouseDown={(e) => e.preventDefault()}
                    className="p-1 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Kaydet (Enter)"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </form>
              );
            }

            return (
              <div
                key={sc.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectScenario?.(sc.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingScenarioId(sc.id);
                  setEditingName(sc.name);
                }}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none flex-shrink-0 ${
                  isActive
                    ? 'bg-accent-600 text-white shadow-sm shadow-accent-600/30'
                    : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/80'
                }`}
                title="Tıklayarak geç, çift tıklayarak veya kalem simgesine basarak ismini değiştir"
              >
                <span>{sc.name}</span>

                {/* İsmi Düzenle Butonu */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingScenarioId(sc.id);
                    setEditingName(sc.name);
                  }}
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    isActive
                      ? 'text-accent-200 hover:text-white hover:bg-accent-700'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 opacity-60 group-hover:opacity-100'
                  }`}
                  title="Taslak İsmini Değiştir"
                >
                  <Pencil className="h-3 w-3" />
                </button>

                <span className={
                  isActive 
                    ? "text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent-700 text-white" 
                    : "text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }>
                  {sc.courseIds.length}
                </span>

                {scenarios.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteScenario?.(sc.id);
                    }}
                    className={`ml-0.5 p-1 rounded-md transition-all cursor-pointer ${
                      isActive
                        ? 'text-accent-200 hover:text-red-300 hover:bg-accent-700'
                        : 'text-slate-400 hover:text-red-400 hover:bg-slate-100 dark:hover:bg-zinc-800 opacity-60 group-hover:opacity-100'
                    }`}
                    title="Taslağı Sil"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          </div>
          <button
            onClick={() => onAddScenario?.()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-950/40 hover:bg-accent-100 dark:hover:bg-accent-900/50 border border-dashed border-accent-300 dark:border-accent-700 transition-colors flex-shrink-0"
            title="Yeni Boş Taslak Oluştur"
          >
            <Plus className="h-3 w-3" />
            Yeni Taslak
          </button>
        </div>
      )}

      {/* Çakışma Uyarıları */}
      {conflicts.length > 0 && (
        <div className="px-6 py-4 bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900/40">
          <div className="flex flex-wrap gap-2">
            {conflicts.map((conflict, index) => (
              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                {conflict.course1.courseCode} ↔ {conflict.course2.courseCode}: {conflict.conflictReason}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Haftalık İstatistik Paneli (Dikey/Yatay/Mobil tüm görünümlerin üstünde) */}
      <ScheduleStats courses={selectedCourses} />

      {/* MOBİL GÜNLÜK AJANDA MODU (Mobilde 5 günün birbirine girmesini önler, Apple/Google Calendar gibi gün bazlı tam genişlik kartlar sunar) */}
      <div data-view="mobile-agenda" className="block lg:hidden p-3.5 space-y-3">
        {/* Gün Seçici Haplar (Tabs) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
          {DAYS_OF_WEEK.map((day) => {
            const count = courseCountByDay[day] || 0;
            const isSelected = selectedMobileDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedMobileDay(day)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-accent-600 text-white shadow-md shadow-accent-600/30 ring-2 ring-accent-500/50'
                    : count > 0
                    ? 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                    : 'bg-slate-100/70 dark:bg-zinc-900/40 text-slate-400 dark:text-zinc-500 border border-transparent'
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                {count > 0 && (
                  isSelected ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black bg-accent-900 text-white">
                      {count}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100">
                      {count}
                    </span>
                  )
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedMobileDay('all')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedMobileDay === 'all'
                ? 'bg-accent-600 text-white shadow-md shadow-accent-600/30 ring-2 ring-accent-500/50'
                : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200/60'
            }`}
          >
            <span>Tüm Hafta</span>
          </button>
        </div>

        {/* Seçili Günün Tam Genişlik Kart Akışı */}
        {selectedMobileDay !== 'all' && (
          <div className="space-y-2.5">
            {getScheduleItemsForDay(selectedCourses, selectedMobileDay).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-zinc-950/60 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                  {selectedMobileDay} Günü Boş!
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                  Bu gün için seçilmiş herhangi bir dersiniz bulunmuyor.
                </p>
              </div>
            ) : (
              getScheduleItemsForDay(selectedCourses, selectedMobileDay)
                .sort((a, b) => timeToMinutes(a.schedule.startTime) - timeToMinutes(b.schedule.startTime))
                .map(({ course, schedule, hasConflict }, idx) => {
                  const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
                  return (
                    <div
                      key={`mob-${course.id}-${selectedMobileDay}-${idx}`}
                      onClick={() => {
                        if (hasConflict) setSelectedConflictCourse(course);
                      }}
                      className={`relative rounded-2xl p-4 shadow-sm border transition-all ${color.bg} ${color.text} border-black/10`}
                    >
                      {/* Üst Satır: Ders Kodu + Saat Dilimi */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-base text-white tracking-tight drop-shadow-sm">
                          {course.courseCode}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasConflict && (
                            <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                              Çakışma!
                            </span>
                          )}
                          <span className="font-mono font-bold text-xs bg-black/25 text-white px-2 py-1 rounded-lg">
                            {schedule.startTime} - {schedule.endTime}
                          </span>
                        </div>
                      </div>

                      {/* Orta Satır: Ders Adı (Kesilmeden tam boy) */}
                      <div className="mt-1.5 font-bold text-sm text-white leading-snug">
                        {course.courseName}
                      </div>

                      {/* Alt Satır: Öğretim Görevlisi & Derslik */}
                      <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-xs text-white/90">
                        <span className="font-medium truncate max-w-[200px]">
                          {course.instructor || 'Öğretim Elemanı Belirtilmemiş'}
                        </span>
                        {schedule.classroom && (
                          <span className="font-bold font-sans bg-black/30 text-white px-2 py-0.5 rounded-md text-[11px]">
                            {schedule.classroom}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* MASAÜSTÜ HAFTALIK GRID (Masaüstünde her zaman, mobilde ise sadece "Tüm Hafta" tıklandığında görünür. PDF çıktısında her zaman bu kısım 1200px render edilir!) */}
      <div 
        data-view="desktop-grid"
        className={`${selectedMobileDay === 'all' ? 'block' : 'hidden lg:block'} p-4 lg:p-6`}
      >
        {viewMode === 'vertical' ? (
          <div className="overflow-x-auto scrollbar-thin transition-all duration-300 ease-in-out">
            <div className="min-w-[700px]">
              {/* Gün Başlıkları */}
              <div 
                className="grid bg-slate-900 dark:bg-zinc-900/95 text-white rounded-t-xl font-semibold text-xs text-center py-3 divide-x divide-slate-800 dark:divide-zinc-800 border-b border-slate-700 dark:border-zinc-800 shadow-sm"
                style={{ gridTemplateColumns: `110px repeat(${daysWithCourses.length}, minmax(0, 1fr))` }}
              >
                <div className="text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider self-center text-[11px]">Saat / Gün</div>
                {daysWithCourses.map(day => (
                  <div key={day} className="py-1 tracking-wide font-bold text-sm text-slate-100 dark:text-white">
                    {day}
                  </div>
                ))}
              </div>

              {/* Program Izgarası */}
              <div className="relative border-x border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-black rounded-b-xl overflow-hidden">
                <div 
                  className="grid divide-x divide-slate-200 dark:divide-zinc-800/80 relative"
                  style={{ 
                    gridTemplateColumns: `110px repeat(${daysWithCourses.length}, minmax(0, 1fr))`,
                    height: `${(hours.length - 1) * HOUR_HEIGHT}px` 
                  }}
                >
                  {/* Sol Saat Eksenı (50 dk aralıklar) */}
                  <div className="relative bg-slate-50/80 dark:bg-zinc-950/90 divide-y divide-slate-200/70 dark:divide-zinc-800/80 select-none">
                    {hours.slice(0, -1).map(hour => (
                      <div 
                        key={hour} 
                        className="h-[64px] flex items-center justify-center text-[11px] font-semibold text-slate-500 dark:text-zinc-400 font-mono tracking-tighter"
                      >
                        {hour.toString().padStart(2, '0')}:00 - {hour.toString().padStart(2, '0')}:50
                      </div>
                    ))}
                  </div>

                  {/* Gün Kolonları */}
                  {daysWithCourses.map(day => {
                    const scheduleItems: ScheduleItem[] = getScheduleItemsForDay(selectedCourses, day);

                    return (
                      <div key={day} className="relative h-full bg-slate-50/20 dark:bg-black">
                        {/* Arka Plan Saat Çizgileri */}
                        <div className="absolute inset-0 divide-y divide-slate-100 dark:divide-zinc-800/50 pointer-events-none">
                          {hours.slice(0, -1).map(hour => (
                            <div key={hour} className="h-[64px]" />
                          ))}
                        </div>

                        {/* Ders Kartları */}
                        {scheduleItems.map(({ course, schedule, stackIndex, stackSize, hasConflict }, idx) => {
                          const style = getCourseStyleVertical(schedule.startTime, schedule.endTime, stackIndex, stackSize);
                          const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
                          const isCompact = stackSize > 1;
                          const isHoverConflict = hoveredConflictCourseIds.has(course.id);

                          // Dersin dakika süresini hesapla
                          const startM = timeToMinutes(schedule.startTime);
                          const endM = endTimeToMinutes(schedule.endTime);
                          const durationMin = endM - startM;
                          const isShort = isCompact || durationMin <= 60;
                          const isLong = !isCompact && durationMin > 120;

                          return (
                            <div
                              key={`${course.id}-${day}-${idx}`}
                              onClick={() => {
                                if (hasConflict) setSelectedConflictCourse(course);
                              }}
                              className={`absolute rounded-xl shadow border overflow-hidden transition-all duration-200 cursor-pointer group ${
                                isShort ? 'p-1.5' : isLong ? 'p-2 sm:p-2.5' : 'p-2'
                              } ${
                                isHoverConflict
                                  ? 'ring-4 ring-red-500 ring-offset-2 animate-pulse z-45 scale-[1.02] shadow-2xl border-red-400'
                                  : hasConflict
                                  ? 'ring-2 ring-red-500 ring-offset-1 z-30 shadow-red-500/30 border-red-400'
                                  : 'hover:shadow-lg hover:scale-[1.01] hover:z-40 border-black/15'
                              } ${color.bg} ${color.text}`}
                              style={{ 
                                top: `calc(${style.top} + 2px)`,
                                height: `calc(${style.height} - 4px)`,
                                left: `calc(${style.left} + 2px)`,
                                width: `calc(${style.width} - 4px)`
                              }}
                              title={hasConflict ? `${course.courseCode} - Çakışmayı çözmek için tıkla!` : `${course.courseCode} - ${course.courseName}\n${course.instructor}\n${schedule.startTime}-${schedule.endTime}\n${schedule.classroom}`}
                            >
                              <div className="h-full flex flex-col justify-between overflow-hidden select-none">
                                <div className="min-w-0">
                                  {/* Ders Kodu & Çakışma Rozeti */}
                                  <div className="flex items-center justify-between gap-1 leading-none">
                                    <span className={`font-black ${isShort ? 'text-xs' : 'text-xs sm:text-sm'} tracking-tight truncate text-white drop-shadow-sm`}>
                                      {course.courseCode}
                                    </span>
                                    {hasConflict && (
                                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-600 text-white text-[8.5px] font-black uppercase tracking-wider flex-shrink-0 animate-pulse">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        Çöz
                                      </span>
                                    )}
                                    {isHoverConflict && !hasConflict && (
                                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-600 text-white text-[8.5px] font-black uppercase tracking-wider flex-shrink-0 animate-pulse">
                                        Çakışır!
                                      </span>
                                    )}
                                  </div>

                                  {/* Ders Adı ve Hoca (Sadece 2+ saatlik derslerde) */}
                                  {!isShort && (
                                    <div className="mt-0.5 min-w-0">
                                      <div className={`font-semibold text-white/95 leading-tight truncate ${isLong ? 'text-[11.5px]' : 'text-[10.5px]'}`}>
                                        {course.courseName}
                                      </div>
                                      {isLong && course.instructor && (
                                        <div className="text-[10px] font-medium text-white/80 leading-tight truncate mt-0.5">
                                          {course.instructor}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Alt Bilgi Barı: Saat ve Derslik */}
                                <div className={`flex items-center justify-between gap-1 text-[9.5px] sm:text-[10px] font-mono font-bold text-white/95 leading-none min-w-0 ${
                                  isShort ? 'mt-0.5' : 'pt-1 border-t border-white/20 mt-auto'
                                }`}>
                                  <span className="truncate">{schedule.startTime}-{schedule.endTime}</span>
                                  {schedule.classroom && (
                                    <span className="font-sans font-bold text-[9px] bg-black/25 text-white px-1.5 py-0.5 rounded flex-shrink-0 truncate">
                                      {schedule.classroom}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Hover Ghost Preview Blocks (Dikey) */}
                        {getHoveredGhostsForDay(day).map((gh, gIdx) => {
                          const gStyle = getCourseStyleVertical(gh.schedule.startTime, gh.schedule.endTime, 0, 1);
                          return (
                            <div
                              key={`ghost-v-${hoveredCourse?.id}-${day}-${gIdx}`}
                              onClick={() => hoveredCourse && onToggleCourseSelect?.(hoveredCourse)}
                              className={`absolute z-35 rounded-xl p-2.5 border-2 border-dashed transition-all duration-150 cursor-pointer pointer-events-auto shadow-xl backdrop-blur-xs flex flex-col justify-between overflow-hidden select-none ${
                                gh.hasConflict
                                  ? 'border-red-500 bg-red-500/20 text-red-800 dark:text-red-200 ring-2 ring-red-500/40'
                                  : 'border-accent-500 bg-accent-500/20 dark:bg-accent-950/60 text-accent-900 dark:text-accent-200 ring-2 ring-accent-500/30'
                              }`}
                              style={{
                                top: `calc(${gStyle.top} + 2px)`,
                                height: `calc(${gStyle.height} - 4px)`,
                                left: '4px',
                                width: 'calc(100% - 8px)'
                              }}
                              title={`${hoveredCourse?.courseCode} Önizlemesi (Seçmek için tıkla)`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-extrabold text-xs tracking-tight truncate">
                                    {hoveredCourse?.courseCode}
                                  </span>
                                  {gh.hasConflict && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 shadow-xs flex-shrink-0">
                                      ⚠️ Çakışma!
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-semibold truncate mt-0.5">
                                  {hoveredCourse?.courseName}
                                </div>
                                {gh.conflictCourseCode && (
                                  <div className="text-[9.5px] font-bold text-red-600 dark:text-red-300 truncate mt-0.5">
                                    Çakışan: {gh.conflictCourseCode}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono font-semibold opacity-90 mt-1">
                                <span>{gh.schedule.startTime}-{gh.schedule.endTime}</span>
                                <span className="text-[9px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-sans truncate">
                                  {gh.schedule.classroom}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Yatay Görünüm (Saatler Üstte, Günler Solda - Birleşik Tablo Tasarımı) */
          <div className="overflow-x-auto scrollbar-thin transition-all duration-300 ease-in-out">
            <div style={{ minWidth: `${96 + (hours.length - 1) * 92}px` }}>
              {/* Saat Başlıkları (Dark Slate Header - 50 dk aralıklar) */}
              <div 
                className="grid bg-slate-900 dark:bg-zinc-900/95 text-white rounded-t-xl font-semibold text-xs text-center py-2 divide-x divide-slate-800 dark:divide-zinc-800 border-b border-slate-700 dark:border-zinc-800 shadow-sm"
                style={{ gridTemplateColumns: `96px repeat(${hours.length - 1}, minmax(92px, 1fr))` }}
              >
                <div className="text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider self-center text-[10.5px]">Gün / Saat</div>
                {hours.slice(0, -1).map(hour => (
                  <div key={hour} className="py-1 px-1 flex flex-col items-center justify-center select-none font-mono">
                    <span className="font-bold text-[11px] text-white dark:text-zinc-100 tracking-tight whitespace-nowrap leading-tight">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                    <span className="text-[9.5px] font-medium text-slate-400 dark:text-zinc-400 tracking-tight whitespace-nowrap leading-tight">
                      {hour.toString().padStart(2, '0')}:50
                    </span>
                  </div>
                ))}
              </div>

              {/* Program Izgarası (Birleşik Tablo Gövdesi) */}
              <div className="border-x border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-black rounded-b-xl overflow-hidden divide-y divide-slate-200 dark:divide-zinc-800">
                {daysWithCourses.map(day => {
                  const scheduleItems: ScheduleItem[] = getScheduleItemsForDay(selectedCourses, day);
                  const maxDayStack = Math.max(...scheduleItems.map(item => item.stackSize), 1);
                  const rowHeight = Math.max(maxDayStack * 64, 96); // Çakışan dersler ve ferah kart alanı için dinamik satır yüksekliği

                  return (
                    <div 
                      key={day} 
                      className="grid divide-x divide-slate-200 dark:divide-zinc-800/80"
                      style={{ 
                        gridTemplateColumns: `96px repeat(${hours.length - 1}, minmax(92px, 1fr))`,
                        height: `${rowHeight}px`
                      }}
                    >
                      {/* Sol Gün Adı Eksenı */}
                      <div className="bg-slate-50/80 dark:bg-zinc-950/90 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-zinc-200 tracking-wide select-none">
                        {day}
                      </div>

                      {/* Günlük Ders Zaman Çizelgesi */}
                      <div 
                        className="relative h-full bg-slate-50/20 dark:bg-black"
                        style={{ gridColumn: `2 / span ${hours.length - 1}` }}
                      >
                        {/* Arka Plan Saat Dikey Çizgileri */}
                        <div className="absolute inset-0 flex divide-x divide-slate-100 dark:divide-zinc-800/50 pointer-events-none">
                          {hours.slice(0, -1).map(hour => (
                            <div key={hour} className="flex-1" />
                          ))}
                        </div>

                        {/* Ders Kartları */}
                        {scheduleItems.map(({ course, schedule, stackIndex, stackSize, hasConflict }, idx) => {
                          const style = getCourseStyleHorizontal(schedule.startTime, schedule.endTime, stackIndex, stackSize);
                          const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
                          const isCompact = stackSize > 1;
                          const isHoverConflict = hoveredConflictCourseIds.has(course.id);

                          const startM = timeToMinutes(schedule.startTime);
                          const endM = endTimeToMinutes(schedule.endTime);
                          const durationMin = endM - startM;
                          const isShort = isCompact || durationMin <= 60;
                          const isLong = !isCompact && durationMin > 120;

                          return (
                            <div
                              key={`${course.id}-${day}-${idx}`}
                              onClick={() => {
                                if (hasConflict) setSelectedConflictCourse(course);
                              }}
                              className={`absolute rounded-xl shadow border overflow-hidden transition-all duration-200 cursor-pointer group ${
                                isShort ? 'p-1.5' : isLong ? 'p-2 sm:p-2.5' : 'p-2'
                              } ${
                                isHoverConflict
                                  ? 'ring-4 ring-red-500 ring-offset-2 animate-pulse z-45 scale-[1.02] shadow-2xl border-red-400'
                                  : hasConflict
                                  ? 'ring-2 ring-red-500 ring-offset-1 z-30 shadow-red-500/30 border-red-400'
                                  : 'hover:shadow-lg hover:scale-[1.01] hover:z-40 border-black/15'
                              } ${color.bg} ${color.text}`}
                              style={{ 
                                left: `calc(${style.left} + 2px)`,
                                width: `calc(${style.width} - 4px)`,
                                top: `calc(${style.top} + 2px)`,
                                height: `calc(${style.height} - 4px)`
                              }}
                              title={hasConflict ? `${course.courseCode} - Çakışmayı çözmek için tıkla!` : `${course.courseCode} - ${course.courseName}\n${course.instructor}\n${schedule.startTime}-${schedule.endTime}\n${schedule.classroom}`}
                            >
                              <div className="h-full flex flex-col justify-between overflow-hidden select-none">
                                <div className="min-w-0">
                                  {/* Ders Kodu & Çakışma Rozeti */}
                                  <div className="flex items-center justify-between gap-1 leading-none">
                                    <span className={`font-black ${isShort ? 'text-xs' : 'text-xs sm:text-sm'} tracking-tight truncate text-white drop-shadow-sm`}>
                                      {course.courseCode}
                                    </span>
                                    {hasConflict && (
                                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-600 text-white text-[8.5px] font-black uppercase tracking-wider flex-shrink-0 animate-pulse">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        Çöz
                                      </span>
                                    )}
                                    {isHoverConflict && !hasConflict && (
                                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-600 text-white text-[8.5px] font-black uppercase tracking-wider flex-shrink-0 animate-pulse">
                                        Çakışır!
                                      </span>
                                    )}
                                  </div>

                                  {/* Ders Adı ve Hoca */}
                                  {!isShort && (
                                    <div className="mt-0.5 min-w-0">
                                      <div className={`font-semibold text-white/95 leading-tight truncate ${isLong ? 'text-[11.5px]' : 'text-[10.5px]'}`}>
                                        {course.courseName}
                                      </div>
                                      {isLong && course.instructor && (
                                        <div className="text-[10px] font-medium text-white/80 leading-tight truncate mt-0.5">
                                          {course.instructor}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Alt Bilgi Barı: Saat ve Derslik */}
                                <div className={`flex items-center justify-between gap-1 text-[9.5px] sm:text-[10px] font-mono font-bold text-white/95 leading-none min-w-0 ${
                                  isShort ? 'mt-0.5' : 'pt-1 border-t border-white/20 mt-auto'
                                }`}>
                                  <span className="truncate">{schedule.startTime}-{schedule.endTime}</span>
                                  {schedule.classroom && (
                                    <span className="font-sans font-bold text-[9px] bg-black/25 text-white px-1.5 py-0.5 rounded flex-shrink-0 truncate">
                                      {schedule.classroom}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Hover Ghost Preview Blocks (Yatay) */}
                        {getHoveredGhostsForDay(day).map((gh, gIdx) => {
                          const gStyle = getCourseStyleHorizontal(gh.schedule.startTime, gh.schedule.endTime, 0, 1);
                          return (
                            <div
                              key={`ghost-h-${hoveredCourse?.id}-${day}-${gIdx}`}
                              onClick={() => hoveredCourse && onToggleCourseSelect?.(hoveredCourse)}
                              className={`absolute z-35 rounded-xl p-2 border-2 border-dashed transition-all duration-150 cursor-pointer pointer-events-auto shadow-xl backdrop-blur-xs flex flex-col justify-between overflow-hidden select-none ${
                                gh.hasConflict
                                  ? 'border-red-500 bg-red-500/20 text-red-800 dark:text-red-200 ring-2 ring-red-500/40'
                                  : 'border-accent-500 bg-accent-500/20 dark:bg-accent-950/60 text-accent-900 dark:text-accent-200 ring-2 ring-accent-500/30'
                              }`}
                              style={{
                                left: `calc(${gStyle.left} + 2px)`,
                                width: `calc(${gStyle.width} - 4px)`,
                                top: '2px',
                                height: 'calc(100% - 4px)'
                              }}
                              title={`${hoveredCourse?.courseCode} Önizlemesi (Seçmek için tıkla)`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-extrabold text-xs tracking-tight truncate">
                                    {hoveredCourse?.courseCode}
                                  </span>
                                  {gh.hasConflict && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 shadow-xs flex-shrink-0">
                                      ⚠️ Çakışma!
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-semibold truncate mt-0.5">
                                  {hoveredCourse?.courseName}
                                </div>
                                {gh.conflictCourseCode && (
                                  <div className="text-[9.5px] font-bold text-red-600 dark:text-red-300 truncate mt-0.5">
                                    Çakışan: {gh.conflictCourseCode}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono font-semibold opacity-90 mt-1">
                                <span>{gh.schedule.startTime}-{gh.schedule.endTime}</span>
                                <span className="text-[9px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-sans truncate">
                                  {gh.schedule.classroom}
                                </span>
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
        )}


        {/* Ders Listesi Legend - Kompakt */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-900">
          <div className="flex flex-wrap gap-2">
            {selectedCourses.map(course => {
              const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
              const hasAnyConflict = conflicts.some(c => c.course1.id === course.id || c.course2.id === course.id);
              
              return (
                <div 
                  key={course.id} 
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    hasAnyConflict 
                      ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50' 
                      : `${color.light} dark:bg-zinc-900 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800`
                  }`}
                  title={`${course.courseName}\n${course.instructor}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${hasAnyConflict ? 'bg-red-500' : color.bg}`}></div>
                  <span className="font-bold">{course.courseCode}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alt bilgi */}
      <div className="px-6 py-4 bg-slate-100 dark:bg-black border-t border-slate-200 dark:border-zinc-900">
        <div className="flex items-center justify-between text-sm flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-slate-600 dark:text-zinc-400">
              <span className="font-bold text-slate-800 dark:text-white">{selectedCourses.length}</span> ders
            </span>
            <span className={conflicts.length > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
              <span className="font-bold">{conflicts.length}</span> çakışma
            </span>
            
            {/* Etiket bazlı sayılar */}
            <div className="flex items-center gap-2 border-l border-slate-300 dark:border-zinc-800 pl-4 flex-wrap">
              {/* Sabit etiketler */}
              {Object.entries(tagCounts.builtIn).map(([tag, count]) => {
                const tagKey = tag as CourseTag;
                const name = TAG_LABELS[tagKey];

                return (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 shadow-sm"
                    title={name}
                  >
                    <span className={`w-2 h-2 rounded-full ${TAG_DOTS[tagKey]}`} />
                    <span className="font-bold">{count}</span>
                    <span className="text-slate-500 dark:text-zinc-400 hidden sm:inline">{name}</span>
                  </span>
                );
              })}
              {/* Özel etiketler */}
              {Object.entries(tagCounts.custom).map(([tagId, count]) => {
                const customTag = getCustomTagInfo(tagId);
                if (!customTag) return null;
                
                return (
                  <span 
                    key={tagId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 shadow-sm"
                    title={`${customTag.emoji} ${customTag.name}`}
                  >
                    <span>{customTag.emoji}</span>
                    <span className="font-bold">{count}</span>
                    <span className="hidden sm:inline">{customTag.name}</span>
                  </span>
                );
              })}
              {Object.keys(tagCounts.builtIn).length === 0 && Object.keys(tagCounts.custom).length === 0 && (
                <span className="text-xs text-slate-400 dark:text-zinc-500 italic">Etiket yok</span>
              )}
            </div>
          </div>
          <button 
            onClick={() => {
              if (conflicts.length > 0) {
                setSelectedConflictCourse(conflicts[0].course1);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              conflicts.length > 0
                ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60 hover:bg-red-200 dark:hover:bg-red-900/80 shadow-xs'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            {conflicts.length > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{conflicts.length} Çakışmayı Çöz</span>
              </>
            ) : (
              'Program Hazır'
            )}
          </button>
        </div>
      </div>

      {/* Çakışma Çözücü Modal */}
      {selectedConflictCourse && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedConflictCourse(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Çakışma Çözücü"
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/50 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-red-100 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl flex-shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-red-950 dark:text-red-200">
                    Saat Çakışması Çözücü
                  </h3>
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {selectedConflictCourse.courseCode} ile çakışan dersler
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedConflictCourse(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-800 dark:text-zinc-100">
                    {selectedConflictCourse.courseCode} - {selectedConflictCourse.courseName}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-100 dark:bg-accent-950 text-accent-700 dark:text-accent-300">
                    Seçili
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono">
                  {selectedConflictCourse.dayTimeLocation} • {selectedConflictCourse.instructor}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">Çakışan Diğer Ders(ler):</p>
                {conflicts
                  .filter(c => c.course1.id === selectedConflictCourse.id || c.course2.id === selectedConflictCourse.id)
                  .map((c, i) => {
                    const otherCourse = c.course1.id === selectedConflictCourse.id ? c.course2 : c.course1;
                    return (
                      <div key={i} className="p-3 rounded-xl bg-red-50/80 dark:bg-red-950/25 border border-red-200 dark:border-red-900/40 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-red-950 dark:text-red-200 truncate">
                            {otherCourse.courseCode} - {otherCourse.courseName}
                          </div>
                          <div className="text-[11px] text-red-700 dark:text-red-400 mt-0.5 font-mono truncate">
                            {otherCourse.dayTimeLocation}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onToggleCourseSelect?.(otherCourse);
                            setSelectedConflictCourse(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs whitespace-nowrap flex-shrink-0"
                        >
                          Bunu Kaldır
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">
              <button
                onClick={() => {
                  onToggleCourseSelect?.(selectedConflictCourse);
                  setSelectedConflictCourse(null);
                }}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
              >
                {selectedConflictCourse.courseCode} Dersi Kaldır
              </button>
              <button
                onClick={() => setSelectedConflictCourse(null)}
                className="px-4 py-1.5 text-xs font-bold bg-slate-800 dark:bg-zinc-700 text-white rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
