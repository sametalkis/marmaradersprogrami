import type { Course, ParsedSchedule } from '../types/Course';
import { parseSchedule, checkTimeConflict } from './excelParser';

// Ders renkleri - her ders için yüksek kontrastlı zengin renk paleti
export const COURSE_COLORS = [
  { bg: 'bg-violet-600', text: 'text-white', light: 'bg-violet-100' },
  { bg: 'bg-emerald-600', text: 'text-white', light: 'bg-emerald-100' },
  { bg: 'bg-amber-600', text: 'text-white', light: 'bg-amber-100' },
  { bg: 'bg-rose-600', text: 'text-white', light: 'bg-rose-100' },
  { bg: 'bg-cyan-600', text: 'text-white', light: 'bg-cyan-100' },
  { bg: 'bg-fuchsia-600', text: 'text-white', light: 'bg-fuchsia-100' },
  { bg: 'bg-lime-600', text: 'text-white', light: 'bg-lime-100' },
  { bg: 'bg-orange-600', text: 'text-white', light: 'bg-orange-100' },
  { bg: 'bg-teal-600', text: 'text-white', light: 'bg-teal-100' },
  { bg: 'bg-indigo-600', text: 'text-white', light: 'bg-indigo-100' },
] as const;

export type CourseColor = typeof COURSE_COLORS[number];

export interface ScheduleItem {
  course: Course;
  schedule: ParsedSchedule;
  stackIndex: number;
  stackSize: number;
  hasConflict: boolean;
}

/**
 * Saat string'ini dakikaya çevirir (ör: "08:30" -> 510)
 */
export const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Marmara 50 dk ders bloklarında :50 bitiş süresini ilgili saat dilimi sonuna yuvarlar
 */
export const endTimeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  if (m >= 45 && m <= 55) {
    return (h + 1) * 60;
  }
  return h * 60 + m;
};

/**
 * Belirli bir gün için ders kartlarının çakışma gruplarını ve stack pozisyonlarını hesaplar
 */
export const getScheduleItemsForDay = (
  selectedCourses: Course[],
  day: string
): ScheduleItem[] => {
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

/**
 * Her derse tutarlı renk atayan map oluşturur
 */
export const buildCourseColorMap = (
  courses: Course[]
): Map<string, CourseColor> => {
  const map = new Map<string, CourseColor>();
  courses.forEach((course, index) => {
    map.set(course.id, COURSE_COLORS[index % COURSE_COLORS.length]);
  });
  return map;
};
