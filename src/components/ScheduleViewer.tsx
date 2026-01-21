import React, { useMemo } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import type { Course, ParsedSchedule, CustomTag } from '../types/Course';
import { DAYS_OF_WEEK, CourseTag, TAG_LABELS, TAG_COLOR_PALETTE } from '../types/Course';
import { findScheduleConflicts } from '../utils/scheduleManager';
import { parseSchedule, checkTimeConflict } from '../utils/excelParser';

interface ScheduleViewerProps {
  courses: Course[];
  customTags?: CustomTag[];
}

// Ders renkleri - her ders için farklı renk
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

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({ courses, customTags = [] }) => {
  const conflicts = findScheduleConflicts(courses);
  const selectedCourses = courses.filter(c => c.isSelected);
  
  // Her derse bir renk ata
  const courseColorMap = useMemo(() => {
    const map = new Map<string, typeof COURSE_COLORS[0]>();
    selectedCourses.forEach((course, index) => {
      map.set(course.id, COURSE_COLORS[index % COURSE_COLORS.length]);
    });
    return map;
  }, [selectedCourses]);

  // Saat aralığı: 08:00 - 18:00 (saatlik)
  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8, 9, 10, ..., 18

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

  // Çakışan dersleri grupla ve stack pozisyonlarını hesapla
  const getScheduleItemsForDay = (day: string): ScheduleItem[] => {
    // Bu günün tüm schedule'larını topla
    const daySchedules: { course: Course; schedule: ParsedSchedule }[] = [];
    
    selectedCourses.forEach(course => {
      const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => {
        if (s && s.day === day) {
          daySchedules.push({ course, schedule: s });
        }
      });
    });

    // Her schedule için çakışma gruplarını bul
    const result: ScheduleItem[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < daySchedules.length; i++) {
      if (processed.has(i)) continue;

      const current = daySchedules[i];
      const conflictGroup: number[] = [i];
      
      // Bu schedule ile çakışan diğerlerini bul
      for (let j = 0; j < daySchedules.length; j++) {
        if (i === j || processed.has(j)) continue;
        
        const other = daySchedules[j];
        if (checkTimeConflict(current.schedule, other.schedule)) {
          conflictGroup.push(j);
        }
      }

      // Grubu işle
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

  // Günleri sadece ders olanlar için filtrele (Cumartesi/Pazar boşsa gösterme)
  const daysWithCourses = useMemo(() => {
    const daysSet = new Set<string>();
    selectedCourses.forEach(course => {
      const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => s && daysSet.add(s.day));
    });
    return DAYS_OF_WEEK.filter(day => daysSet.has(day) || ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'].includes(day));
  }, [selectedCourses]);

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
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Başlık */}
      <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Haftalık Ders Programı</h2>
              <p className="text-indigo-200 text-sm">{selectedCourses.length} ders seçili</p>
            </div>
          </div>
          {conflicts.length > 0 && (
            <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-200" />
              <span className="text-red-100 font-medium">{conflicts.length} Çakışma</span>
            </div>
          )}
        </div>
      </div>

      {/* Çakışma Uyarıları */}
      {conflicts.length > 0 && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
          <div className="flex flex-wrap gap-2">
            {conflicts.map((conflict, index) => (
              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {conflict.course1.courseCode} ↔ {conflict.course2.courseCode}: {conflict.conflictReason}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Program Grid */}
      <div className="p-4 lg:p-6">
        {/* Saat başlıkları */}
        <div className="flex mb-2">
          <div className="w-24 flex-shrink-0"></div>
          <div className="flex-1 flex">
            {hours.map(hour => (
              <div 
                key={hour} 
                className="flex-1 text-center text-xs font-semibold text-slate-500"
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>

        {/* Günler ve dersler */}
        <div className="space-y-2">
          {daysWithCourses.map(day => {
            const scheduleItems = getScheduleItemsForDay(day);

            return (
              <div key={day} className="flex items-stretch">
                {/* Gün etiketi */}
                <div className="w-24 flex-shrink-0 flex items-center">
                  <span className="text-sm font-bold text-slate-700 bg-slate-200/50 px-3 py-2 rounded-lg w-full text-center">
                    {day.substring(0, 3)}
                  </span>
                </div>
                
                {/* Ders alanı */}
                <div className="flex-1 relative bg-slate-100/50 rounded-lg min-h-[80px] border border-slate-200/50">
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
                        className={`absolute ${hasConflict ? 'ring-2 ring-red-400 ring-offset-1' : ''} ${color.bg} ${color.text} rounded-lg shadow-md overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02] hover:z-20 cursor-pointer group`}
                        style={{ 
                          left: style.left, 
                          width: style.width,
                          top: `calc(${style.top} + 4px)`,
                          height: `calc(${style.height} - 8px)`
                        }}
                        title={`${course.courseCode} - ${course.courseName}\n${course.instructor}\n${schedule.startTime}-${schedule.endTime}\n${schedule.classroom}${hasConflict ? '\n⚠️ Çakışma var!' : ''}`}
                      >
                        <div className={`${isCompact ? 'p-1' : 'p-2'} h-full flex flex-col justify-center overflow-hidden`}>
                          <div className={`font-bold ${isCompact ? 'text-[10px]' : 'text-xs'} leading-tight truncate`}>
                            {course.courseCode}
                          </div>
                          {!isCompact && (
                            <>
                              <div className="text-[10px] opacity-95 truncate leading-tight font-medium">
                                {course.courseName}
                              </div>
                              <div className="text-[9px] opacity-80 truncate leading-tight">
                                {course.instructor}
                              </div>
                            </>
                          )}
                          <div className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} opacity-70 truncate leading-tight ${isCompact ? '' : 'mt-0.5'}`}>
                            {schedule.startTime}-{schedule.endTime} | {schedule.classroom}
                          </div>
                        </div>
                        {hasConflict && (
                          <div className="absolute top-0.5 right-0.5">
                            <AlertTriangle className={`${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-yellow-300`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ders Listesi Legend - Kompakt */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex flex-wrap gap-2">
            {selectedCourses.map(course => {
              const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
              const hasAnyConflict = conflicts.some(c => c.course1.id === course.id || c.course2.id === course.id);
              
              return (
                <div 
                  key={course.id} 
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${hasAnyConflict ? 'bg-red-100 text-red-700' : `${color.light} text-slate-700`}`}
                  title={`${course.courseName}\n${course.instructor}`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasAnyConflict ? 'bg-red-500' : color.bg}`}></div>
                  <span className="font-semibold">{course.courseCode}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alt bilgi */}
      <div className="px-6 py-4 bg-slate-100 border-t border-slate-200">
        <div className="flex items-center justify-between text-sm flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-slate-600">
              <span className="font-semibold text-slate-800">{selectedCourses.length}</span> ders
            </span>
            <span className={conflicts.length > 0 ? 'text-red-600' : 'text-emerald-600'}>
              <span className="font-semibold">{conflicts.length}</span> çakışma
            </span>
            
            {/* Etiket bazlı sayılar */}
            <div className="flex items-center gap-2 border-l border-slate-300 pl-4 flex-wrap">
              {/* Sabit etiketler */}
              {Object.entries(tagCounts.builtIn).map(([tag, count]) => {
                const tagKey = tag as CourseTag;
                const label = TAG_LABELS[tagKey];
                const emoji = label.split(' ')[0];
                const name = label.split(' ')[1];
                
                return (
                  <span 
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700"
                    title={label}
                  >
                    <span>{emoji}</span>
                    <span className="font-semibold">{count}</span>
                    <span className="text-slate-500 hidden sm:inline">{name}</span>
                  </span>
                );
              })}
              {/* Özel etiketler */}
              {Object.entries(tagCounts.custom).map(([tagId, count]) => {
                const customTag = getCustomTagInfo(tagId);
                if (!customTag) return null;
                
                const colorStyle = TAG_COLOR_PALETTE.find(c => c.id === customTag.color);
                
                return (
                  <span 
                    key={tagId}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorStyle?.light || 'bg-white'} ${colorStyle?.text || 'text-slate-700'} ${colorStyle?.border || 'border-slate-200'}`}
                    title={`${customTag.emoji} ${customTag.name}`}
                  >
                    <span>{customTag.emoji}</span>
                    <span className="font-semibold">{count}</span>
                    <span className="hidden sm:inline">{customTag.name}</span>
                  </span>
                );
              })}
              {Object.keys(tagCounts.builtIn).length === 0 && Object.keys(tagCounts.custom).length === 0 && (
                <span className="text-xs text-slate-400 italic">Etiket yok</span>
              )}
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            conflicts.length > 0 
              ? 'bg-red-100 text-red-700' 
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {conflicts.length > 0 ? '⚠️ Düzenleme Gerekli' : '✓ Program Hazır'}
          </div>
        </div>
      </div>
    </div>
  );
};
