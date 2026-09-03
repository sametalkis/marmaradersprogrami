import type { Course, ParsedSchedule } from '../types/Course';
import { parseAllSchedules } from './excelParser';
import { downloadTextFile } from './exportUtils';

/**
 * .ics (iCalendar) dışa aktarma yardımcıları.
 * Seçili dersler, dönem başlangıç tarihinden itibaren haftalık tekrarlayan
 * (RRULE:FREQ=WEEKLY;COUNT=N) takvim etkinliklerine dönüştürülür.
 * Saatler FLOATING (saat dilimsiz) olarak yazılır; böylece Google/Apple
 * takvimleri etkinliği kullanıcının kendi saat dilimine yerleştirir.
 */

/** Türkçe gün adı -> iCalendar BYDAY kodu (DAYS_OF_WEEK index sırasıyla uyumlu) */
export const TURKISH_DAY_TO_BYDAY: Record<string, string> = {
  'Pazartesi': 'MO',
  'Salı': 'TU',
  'Çarşamba': 'WE',
  'Perşembe': 'TH',
  'Cuma': 'FR',
  'Cumartesi': 'SA',
  'Pazar': 'SU',
};

/** BYDAY kodu -> haftanın pazartesi bazlı gün ofseti (MO=0) */
const BYDAY_OFFSET: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

export interface IcsExportOptions {
  /** Dönemin ilk Pazartesi'si, 'YYYY-MM-DD' */
  semesterStartDate: string;
  /** Kaç hafta tekrarlanacak (varsayılan 14) */
  weekCount: number;
}

const DEFAULT_WEEK_COUNT = 14;

/** 'YYYY-MM-DD' -> o haftanın Pazartesi'sine normalize edilmiş Date (UTC-tabanlı, saat kayması olmadan) */
const parseToMonday = (dateStr: string): Date => {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  const base = new Date(Date.UTC(
    Number.isFinite(y) ? y : new Date().getFullYear(),
    (Number.isFinite(m) ? m : new Date().getMonth() + 1) - 1,
    Number.isFinite(d) ? d : 1
  ));
  const dow = base.getUTCDay(); // 0=Pazar
  const offset = (dow === 0 ? 6 : dow - 1); // Pazartesi = 0
  base.setUTCDate(base.getUTCDate() - offset);
  return base;
};

/** Date + gün ofseti + 'HH:MM' -> 'YYYYMMDDTHHMMSS' (floating local time) */
const formatFloating = (monday: Date, dayOffset: number, time: string): string => {
  const [h = 0, m = 0] = (time || '00:00').split(':').map(Number);
  const date = new Date(monday.getTime());
  date.setUTCDate(date.getUTCDate() + dayOffset);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(h)}${pad(m)}00`;
};

/** Metin değerlerindeki özel karakterleri RFC 5545'e göre kaçırır */
const escapeIcsText = (text: string): string =>
  (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Geçerli bir 'HH:MM' saati mi? */
const isValidTime = (time: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(time || '');

/** Her dersin tüm zamanlarını normalize eder (schedules yoksa fallback parse) */
const getCourseSchedules = (course: Course): ParsedSchedule[] =>
  course.schedules && course.schedules.length > 0
    ? course.schedules
    : parseAllSchedules(course.dayTimeLocation);

export const buildIcsContent = (
  courses: Course[],
  options: IcsExportOptions
): { ics: string; added: number; skipped: string[] } => {
  const weekCount = Math.min(Math.max(Math.round(options.weekCount) || DEFAULT_WEEK_COUNT, 1), 365);
  const monday = parseToMonday(options.semesterStartDate);

  const dtstamp = (() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  })();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marmara Ders Programi//Ders Programi Export//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const skipped: string[] = [];
  let added = 0;

  courses.forEach(course => {
    const schedules = getCourseSchedules(course);
    const validSchedules = schedules.filter(
      s => s && TURKISH_DAY_TO_BYDAY[s.day] && isValidTime(s.startTime) && isValidTime(s.endTime)
    );

    if (validSchedules.length === 0) {
      skipped.push(course.courseCode);
      return;
    }

    validSchedules.forEach(schedule => {
      const byday = TURKISH_DAY_TO_BYDAY[schedule.day];
      const dayOffset = BYDAY_OFFSET[byday];
      const dtstart = formatFloating(monday, dayOffset, schedule.startTime);
      const dtend = formatFloating(monday, dayOffset, schedule.endTime);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${course.id}-${schedule.day}-${schedule.startTime}@marmaradersprogrami`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
      lines.push(`RRULE:FREQ=WEEKLY;COUNT=${weekCount}`);
      lines.push(`SUMMARY:${escapeIcsText(`${course.courseCode} - ${course.courseName}`)}`);
      if (schedule.classroom) {
        lines.push(`LOCATION:${escapeIcsText(schedule.classroom)}`);
      }
      if (course.instructor) {
        lines.push(`DESCRIPTION:${escapeIcsText(course.instructor)}`);
      }
      lines.push('END:VEVENT');
      added += 1;
    });
  });

  lines.push('END:VCALENDAR');

  return { ics: lines.join('\r\n') + '\r\n', added, skipped };
};

/** Seçili dersleri .ics olarak indirir */
export const exportToIcs = (
  courses: Course[],
  options: IcsExportOptions,
  filename: string = 'ders-programi.ics'
): { added: number; skipped: string[] } => {
  const { ics, added, skipped } = buildIcsContent(courses, options);
  downloadTextFile(ics, filename);
  return { added, skipped };
};
