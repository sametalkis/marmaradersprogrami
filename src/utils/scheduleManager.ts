import type { Course, ScheduleConflict, ParsedSchedule } from '../types/Course';
import { parseSchedule, checkTimeConflict } from './excelParser';

export const findScheduleConflicts = (courses: Course[]): ScheduleConflict[] => {
  const conflicts: ScheduleConflict[] = [];
  const selectedCourses = courses.filter(course => course.isSelected);
  
  for (let i = 0; i < selectedCourses.length; i++) {
    for (let j = i + 1; j < selectedCourses.length; j++) {
      const course1 = selectedCourses[i];
      const course2 = selectedCourses[j];
      
      // Her ders için tüm schedule'ları kontrol et
      const schedules1 = course1.schedules || [parseSchedule(course1.dayTimeLocation)].filter(Boolean);
      const schedules2 = course2.schedules || [parseSchedule(course2.dayTimeLocation)].filter(Boolean);
      
      for (const schedule1 of schedules1) {
        for (const schedule2 of schedules2) {
          if (schedule1 && schedule2 && checkTimeConflict(schedule1, schedule2)) {
            conflicts.push({
              course1,
              course2,
              conflictReason: `${schedule1.day} günü saat çakışması (${schedule1.startTime}-${schedule1.endTime} ile ${schedule2.startTime}-${schedule2.endTime})`
            });
            break; // İlk çakışmada dur
          }
        }
      }
    }
  }
  
  return conflicts;
};

export const canAddCourse = (courses: Course[], newCourse: Course): { canAdd: boolean; conflicts: ScheduleConflict[] } => {
  const selectedCourses = courses.filter(course => course.isSelected);
  const conflicts: ScheduleConflict[] = [];
  
  const newSchedules = newCourse.schedules || [parseSchedule(newCourse.dayTimeLocation)].filter(Boolean);
  
  for (const selectedCourse of selectedCourses) {
    const selectedSchedules = selectedCourse.schedules || [parseSchedule(selectedCourse.dayTimeLocation)].filter(Boolean);
    
    for (const newSchedule of newSchedules) {
      for (const selectedSchedule of selectedSchedules) {
        if (newSchedule && selectedSchedule && checkTimeConflict(newSchedule, selectedSchedule)) {
          conflicts.push({
            course1: newCourse,
            course2: selectedCourse,
            conflictReason: `${newSchedule.day} günü saat çakışması (${newSchedule.startTime}-${newSchedule.endTime})`
          });
        }
      }
    }
  }
  
  return { canAdd: conflicts.length === 0, conflicts };
};

export const getWeeklySchedule = (courses: Course[]) => {
  const selectedCourses = courses.filter(course => course.isSelected);
  const weeklySchedule: { [day: string]: { [time: string]: Course } } = {};
  
  selectedCourses.forEach(course => {
    const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
    
    schedules.forEach(schedule => {
      if (schedule) {
        if (!weeklySchedule[schedule.day]) {
          weeklySchedule[schedule.day] = {};
        }
        weeklySchedule[schedule.day][schedule.startTime] = course;
      }
    });
  });
  
  return weeklySchedule;
};

export const calculateTotalCredits = (courses: Course[]): number => {
  return courses
    .filter(course => course.isSelected)
    .reduce((total, course) => total + (course.credits || 0), 0);
};
