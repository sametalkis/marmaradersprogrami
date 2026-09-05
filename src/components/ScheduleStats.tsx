import React, { useMemo } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import type { Course } from '../types/Course';
import { DAYS_OF_WEEK } from '../types/Course';
import { parseAllSchedules } from '../utils/excelParser';
import { timeToMinutes, endTimeToMinutes } from '../utils/scheduleRenderUtils';
import { useLocalStorage } from '../hooks/useLocalStorage';

export interface DailyMinutes {
  day: string;
  minutes: number;
}

export interface ScheduleStats {
  totalWeeklyMinutes: number;
  totalCredits: number;
  courseCount: number;
  usedDays: string[];
  freeDays: string[];
  earliestStart: string;
  latestEnd: string;
  dailyMinutes: DailyMinutes[];
}

/**
 * Haftalık ders programı istatistiklerini hesaplar.
 * NOT: Çakışan (aynı saat dilimine denk gelen) ders saatleri ayrı ayrı toplanır;
 * yani toplam süre, takvimdeki görsel kaplama süresinden fazla görünebilir.
 * Bitiş saatleri Marmara'nın 50 dk blok şemasına göre endTimeToMinutes ile
 * :50'den sonraki tam saate yuvarlanır (takvimde göründüğü gibi).
 */
export const computeScheduleStats = (selectedCourses: Course[]): ScheduleStats => {
  const dailyMinutes: DailyMinutes[] = DAYS_OF_WEEK.map(day => ({ day, minutes: 0 }));
  const dailyMap = new Map(dailyMinutes.map(d => [d.day, d]));

  let totalWeeklyMinutes = 0;
  let totalCredits = 0;
  let earliestStartMin = Infinity;
  let latestEndMin = -Infinity;
  let earliestStart = '--:--';
  let latestEnd = '--:--';
  const usedDaysSet = new Set<string>();

  selectedCourses.forEach(course => {
    totalCredits += course.credits ?? 0;

    const schedules = (course.schedules && course.schedules.length > 0)
      ? course.schedules
      : parseAllSchedules(course.dayTimeLocation);

    schedules.forEach(s => {
      const startMin = timeToMinutes(s.startTime);
      const endMin = endTimeToMinutes(s.endTime);
      const duration = Math.max(endMin - startMin, 0);

      totalWeeklyMinutes += duration;

      if (startMin < earliestStartMin) {
        earliestStartMin = startMin;
        earliestStart = s.startTime;
      }
      if (endMin > latestEndMin) {
        latestEndMin = endMin;
        latestEnd = s.endTime;
      }

      const dayEntry = dailyMap.get(s.day);
      if (dayEntry) {
        dayEntry.minutes += duration;
        usedDaysSet.add(s.day);
      }
    });
  });

  const usedDays = DAYS_OF_WEEK.filter(day => usedDaysSet.has(day));
  const freeDays = DAYS_OF_WEEK.filter(day => !usedDaysSet.has(day));

  return {
    totalWeeklyMinutes,
    totalCredits,
    courseCount: selectedCourses.length,
    usedDays,
    freeDays,
    earliestStart,
    latestEnd,
    dailyMinutes
  };
};

/**
 * Dakikayı Türkçe biçimde gösterir: "4s 30dk" gibi.
 */
const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}s`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}dk`);
  return parts.join(' ');
};

export const ScheduleStats: React.FC<{ courses: Course[] }> = ({ courses }) => {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>('marmara-stats-open', true);

  const stats = useMemo(() => computeScheduleStats(courses), [courses]);

  if (courses.length === 0) return null;

  const maxMinutes = Math.max(...stats.dailyMinutes.map(d => d.minutes), 1);

  const summaryItems: { label: string; value: string }[] = [
    { label: 'Toplam Haftalık Ders', value: formatDuration(stats.totalWeeklyMinutes) },
    { label: 'Toplam AKTS', value: `${stats.totalCredits}` },
    { label: 'Ders Sayısı', value: `${stats.courseCount}` },
    { label: 'Dolu Gün', value: `${stats.usedDays.length}` },
    { label: 'Boş Gün', value: stats.freeDays.length > 0 ? stats.freeDays.join(', ') : 'Yok' },
    { label: 'En Erken Başlangıç', value: stats.earliestStart },
    { label: 'En Geç Bitiş', value: stats.latestEnd }
  ];

  return (
    <div className="mx-4 lg:mx-6 mt-4 rounded-2xl border border-slate-200 dark:border-zinc-900 bg-slate-50 dark:bg-zinc-950/60 overflow-hidden">
      {/* Başlık (aç/kapa) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer select-none"
        aria-expanded={isOpen}
        aria-label="Haftalık istatistik panelini aç/kapat"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-zinc-100">
          <span className="p-1.5 rounded-lg bg-accent-100 dark:bg-accent-950/60 text-accent-600 dark:text-accent-400">
            <BarChart3 className="h-4 w-4" />
          </span>
          Haftalık İstatistikler
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
            {formatDuration(stats.totalWeeklyMinutes)}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>

      {/* İçerik */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 pt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Özet Bilgiler */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
            {summaryItems.map(item => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 truncate">
                  {item.label}
                </div>
                <div className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 mt-0.5 truncate" title={item.value}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Günlük Dağılım Bar Grafiği (saf div) */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
              Günlük Ders Süresi
            </div>
            <div className="flex items-end gap-1.5 h-28 bg-slate-100 dark:bg-zinc-900 rounded-lg p-2">
              {stats.dailyMinutes.map(({ day, minutes }) => {
                const heightPercent = (minutes / maxMinutes) * 100;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                    <div
                      className={`w-full max-w-[36px] rounded-t-md bg-accent-500 transition-all duration-300 ${
                        minutes === 0 ? 'bg-slate-200 dark:bg-zinc-800' : 'bg-accent-500'
                      }`}
                      style={{ height: `${minutes === 0 ? 2 : Math.max(heightPercent, 4)}%` }}
                      title={`${day}: ${formatDuration(minutes)}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {stats.dailyMinutes.map(({ day }) => (
                <div key={day} className="flex-1 text-center text-[9px] font-bold text-slate-400 dark:text-zinc-500 truncate min-w-0">
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
