export interface Course {
  id: string;
  courseCode: string;
  courseName: string;
  instructor: string;
  dayTimeLocation: string; // Karmaşık format: "Pazartesi 09:30 - 10:20 [RTE.I1.Z01] Salı 13:00..."
  schedules?: ParsedSchedule[]; // Parse edilmiş tüm zamanlar
  credits?: number;
  isSelected?: boolean;
  isEligible?: boolean;
  tag?: CourseTag | string; // Sabit etiket veya özel etiket ID'si
}

// Özel etiket için interface
export interface CustomTag {
  id: string;
  name: string;
  emoji: string;
  color: string; // Tailwind color class (bg-xxx-500)
}

// Özel etiketler için renk paleti
export const TAG_COLOR_PALETTE = [
  { id: 'red', bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  { id: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { id: 'amber', bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  { id: 'yellow', bg: 'bg-yellow-500', light: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  { id: 'lime', bg: 'bg-lime-500', light: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200' },
  { id: 'green', bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  { id: 'emerald', bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  { id: 'teal', bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
  { id: 'cyan', bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  { id: 'sky', bg: 'bg-sky-500', light: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200' },
  { id: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { id: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  { id: 'violet', bg: 'bg-violet-500', light: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
  { id: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  { id: 'fuchsia', bg: 'bg-fuchsia-500', light: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-200' },
  { id: 'pink', bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  { id: 'rose', bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  { id: 'slate', bg: 'bg-slate-500', light: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
] as const;

// Emoji paleti
export const TAG_EMOJI_PALETTE = [
  '📚', '📖', '✏️', '🎓', '💼', '⭐', '🔥', '💡', '🎯', '🏆',
  '❤️', '💙', '💚', '💛', '💜', '🧡', '🤍', '🖤', '💎', '🌟',
  '📝', '📌', '🔖', '🏷️', '🎨', '🎭', '🎵', '🎬', '💻', '🔬'
] as const;

export const CourseTag = {
  MANDATORY: 'mandatory',    // Zorunlu
  ELECTIVE: 'elective',     // Seçmeli
  IMPORTANT: 'important',   // Önemli
  OPTIONAL: 'optional'      // İsteğe bağlı
} as const;
export type CourseTag = typeof CourseTag[keyof typeof CourseTag];

export const TAG_COLORS = {
  [CourseTag.MANDATORY]: 'bg-red-100 text-red-800 border-red-200',
  [CourseTag.ELECTIVE]: 'bg-blue-100 text-blue-800 border-blue-200', 
  [CourseTag.IMPORTANT]: 'bg-orange-100 text-orange-800 border-orange-200',
  [CourseTag.OPTIONAL]: 'bg-gray-100 text-gray-800 border-gray-200'
};

export const TAG_LABELS = {
  [CourseTag.MANDATORY]: 'Zorunlu',
  [CourseTag.ELECTIVE]: 'Seçmeli',
  [CourseTag.IMPORTANT]: 'Önemli',
  [CourseTag.OPTIONAL]: 'İsteğe Bağlı'
};

// Etiket rozetindeki renkli nokta
export const TAG_DOTS = {
  [CourseTag.MANDATORY]: 'bg-red-500',
  [CourseTag.ELECTIVE]: 'bg-blue-500',
  [CourseTag.IMPORTANT]: 'bg-amber-500',
  [CourseTag.OPTIONAL]: 'bg-slate-400'
};

export interface ParsedSchedule {
  day: string;
  startTime: string;
  endTime: string;
  classroom: string;
}

export interface ScheduleConflict {
  course1: Course;
  course2: Course;
  conflictReason: string;
}

export const CourseStatus = {
  ALL: 'all',
  ELIGIBLE: 'eligible', 
  SELECTED: 'selected'
} as const;
export type CourseStatus = typeof CourseStatus[keyof typeof CourseStatus];

export interface ExcelData {
  courses: Course[];
  errors: string[];
}

export const DAYS_OF_WEEK = [
  'Pazartesi',
  'Salı', 
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar'
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Otomatik program oluşturucu için tipler
export interface SchedulePreferences {
  requirements: {
    [CourseTag.MANDATORY]: number;
    [CourseTag.ELECTIVE]: number;
    [CourseTag.IMPORTANT]: number;
    [CourseTag.OPTIONAL]: number;
  };
  customRequirements: { [tagId: string]: number };  // Özel etiketler için gereksinimler
  allowConflicts: boolean;
  maxConflicts: number;
  avoidEarlyMorning: boolean;  // 08:00-09:00 arası derslerden kaçın
  preferCompactSchedule: boolean;  // Dersler arası boşluk az olsun
}

export interface ScheduleSuggestion {
  id: string;
  courses: Course[];
  score: number;
  conflictCount: number;
  summary: {
    totalCourses: number;
    byTag: { [key in CourseTag]?: number };
    byCustomTag: { [tagId: string]: number };  // Özel etiket sayıları
    days: string[];
    earliestStart: string;
    latestEnd: string;
  };
}

// Alternatif program senaryosu / taslağı
export interface ScheduleScenario {
  id: string;
  name: string;
  courseIds: string[];
  createdAt: number;
}

