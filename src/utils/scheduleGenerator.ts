import type { Course, SchedulePreferences, ScheduleSuggestion, ParsedSchedule } from '../types/Course';
import { CourseTag, DAYS_OF_WEEK } from '../types/Course';
import { parseSchedule, checkTimeConflict } from './excelParser';

/**
 * Otomatik Ders Programı Oluşturucu
 * Backtracking + Scoring algoritması kullanır
 * 
 * ÖNEMLİ: Aynı dersin farklı section'ları (XXX111.1, XXX111.2) 
 * aynı ders olarak kabul edilir ve sadece biri seçilir.
 */

// Ders kodunun base kısmını çıkar (XXX111.1 → XXX111)
export const getBaseCourseCode = (courseCode: string): string => {
  // Son nokta ve sonrasını kaldır (section numarası)
  // Örn: "BUS3002.1" → "BUS3002"
  // Örn: "FNCE2004.2" → "FNCE2004"
  const match = courseCode.match(/^(.+)\.\d+$/);
  return match ? match[1] : courseCode;
};

// İki dersin aynı dersin farklı section'ları olup olmadığını kontrol et
export const isSameCourse = (course1: Course, course2: Course): boolean => {
  if (course1.id === course2.id) return false; // Aynı ders değil, aynı kayıt
  return getBaseCourseCode(course1.courseCode) === getBaseCourseCode(course2.courseCode);
};

// Kombinasyonda aynı dersin birden fazla section'ı var mı?
const hasDuplicateCourseSection = (courses: Course[]): boolean => {
  const baseCodes = new Set<string>();
  for (const course of courses) {
    const baseCode = getBaseCourseCode(course.courseCode);
    if (baseCodes.has(baseCode)) {
      return true;
    }
    baseCodes.add(baseCode);
  }
  return false;
};

// Sabit etiket mi kontrol et
const isBuiltInTag = (tag: string | undefined): tag is CourseTag => {
  return !!tag && Object.values(CourseTag).includes(tag as CourseTag);
};

// Dersleri etiketlere göre grupla (sabit etiketler)
const groupCoursesByBuiltInTag = (courses: Course[]): Map<CourseTag, Course[]> => {
  const grouped = new Map<CourseTag, Course[]>();
  
  Object.values(CourseTag).forEach(tag => {
    grouped.set(tag, []);
  });
  
  courses.forEach(course => {
    if (isBuiltInTag(course.tag)) {
      grouped.get(course.tag)?.push(course);
    }
  });
  
  return grouped;
};

// Dersleri özel etiketlere göre grupla
const groupCoursesByCustomTag = (courses: Course[]): Map<string, Course[]> => {
  const grouped = new Map<string, Course[]>();
  
  courses.forEach(course => {
    if (course.tag && !isBuiltInTag(course.tag)) {
      if (!grouped.has(course.tag)) {
        grouped.set(course.tag, []);
      }
      grouped.get(course.tag)?.push(course);
    }
  });
  
  return grouped;
};

// İki ders çakışıyor mu?
const coursesConflict = (course1: Course, course2: Course): boolean => {
  const schedules1 = course1.schedules || [parseSchedule(course1.dayTimeLocation)].filter(Boolean);
  const schedules2 = course2.schedules || [parseSchedule(course2.dayTimeLocation)].filter(Boolean);
  
  for (const s1 of schedules1) {
    for (const s2 of schedules2) {
      if (s1 && s2 && checkTimeConflict(s1, s2)) {
        return true;
      }
    }
  }
  return false;
};

// Kombinasyondaki toplam çakışma sayısı
const countConflictsInCombination = (courses: Course[]): number => {
  let conflicts = 0;
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      if (coursesConflict(courses[i], courses[j])) {
        conflicts++;
      }
    }
  }
  return conflicts;
};

// Kombinasyonu puanla (0 - 100 aralığında)
const scoreSchedule = (courses: Course[], preferences: SchedulePreferences): number => {
  let score = 100; // Mükemmel başlangıç puanı
  
  // 1. Çakışma cezası (Her çakışan ders çifti için -30 puan)
  const conflicts = countConflictsInCombination(courses);
  score -= conflicts * 30;
  
  // 2. Erken sabah dersi cezası (08:00 - 09:00 arası başlayan her ders için -8 puan)
  if (preferences.avoidEarlyMorning) {
    courses.forEach(course => {
      const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => {
        if (s) {
          const hour = parseInt(s.startTime.split(':')[0]);
          if (hour < 9) {
            score -= 8;
          }
        }
      });
    });
  }
  
  // 3. Kompakt program değerlendirmesi
  if (preferences.preferCompactSchedule) {
    const dayMap = new Map<string, ParsedSchedule[]>();
    
    courses.forEach(course => {
      const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
      schedules.forEach(s => {
        if (s) {
          if (!dayMap.has(s.day)) {
            dayMap.set(s.day, []);
          }
          dayMap.get(s.day)!.push(s);
        }
      });
    });
    
    // Gün sayısı değerlendirmesi (Fazla güne yayılma cezası)
    const usedDays = dayMap.size;
    if (usedDays >= 5) {
      score -= 12; // 5 güne yayılmışsa -12
    } else if (usedDays === 4) {
      score -= 5;  // 4 güne yayılmışsa -5
    }
    
    // Aynı gün içindeki dersler arası bekleme boşluğu cezası
    dayMap.forEach(schedules => {
      if (schedules.length > 1) {
        schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
        for (let i = 0; i < schedules.length - 1; i++) {
          const end = timeToMinutes(schedules[i].endTime);
          const start = timeToMinutes(schedules[i + 1].startTime);
          const gapMinutes = Math.max(0, start - end);
          if (gapMinutes > 120) {
            score -= 8; // 2 saatten fazla bekleme boşluğu
          } else if (gapMinutes > 60) {
            score -= 4; // 1 saatten fazla bekleme boşluğu
          }
        }
      }
    });
  }
  
  // Puan kesinlikle 0 ile 100 arasında sınırlandırılır
  return Math.min(100, Math.max(0, Math.round(score)));
};

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Kombinasyon özeti oluştur
const createSummary = (courses: Course[]): ScheduleSuggestion['summary'] => {
  const byTag: { [key in CourseTag]?: number } = {};
  const byCustomTag: { [tagId: string]: number } = {};
  const allDays = new Set<string>();
  let earliestStart = '23:59';
  let latestEnd = '00:00';
  
  courses.forEach(course => {
    if (course.tag) {
      if (isBuiltInTag(course.tag)) {
        // Sabit etiket
        byTag[course.tag] = (byTag[course.tag] || 0) + 1;
      } else {
        // Özel etiket
        byCustomTag[course.tag] = (byCustomTag[course.tag] || 0) + 1;
      }
    }
    
    const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
    schedules.forEach(s => {
      if (s) {
        allDays.add(s.day);
        if (s.startTime < earliestStart) earliestStart = s.startTime;
        if (s.endTime > latestEnd) latestEnd = s.endTime;
      }
    });
  });
  
  // Günleri sırala
  const days = DAYS_OF_WEEK.filter(d => allDays.has(d));
  
  return {
    totalCourses: courses.length,
    byTag,
    byCustomTag,
    days,
    earliestStart,
    latestEnd
  };
};

// Backtracking ile kombinasyonları bul
const findCombinations = (
  groupedBuiltIn: Map<CourseTag, Course[]>,
  groupedCustom: Map<string, Course[]>,
  preferences: SchedulePreferences,
  maxResults: number = 50
): Course[][] => {
  const results: Course[][] = [];
  
  // Sabit etiketler için gereksinimler
  const builtInRequirements = Object.values(CourseTag).map(tag => ({
    tagId: tag,
    required: preferences.requirements[tag],
    available: groupedBuiltIn.get(tag) || []
  })).filter(r => r.required > 0 && r.available.length > 0);
  
  // Özel etiketler için gereksinimler
  const customRequirements = Object.entries(preferences.customRequirements || {}).map(([tagId, required]) => ({
    tagId,
    required,
    available: groupedCustom.get(tagId) || []
  })).filter(r => r.required > 0 && r.available.length > 0);
  
  // Tüm gereksinimleri birleştir
  const requirements = [...builtInRequirements, ...customRequirements];
  
  // Recursive backtracking
  const backtrack = (
    tagIndex: number,
    currentCombination: Course[],
    usedBaseCodes: Set<string> // Kullanılan ders kodları (section olmadan)
  ) => {
    // Yeterli sonuç bulunduysa dur
    if (results.length >= maxResults * 3) return;
    
    // Tüm etiketler işlendi
    if (tagIndex >= requirements.length) {
      // Çakışma kontrolü
      const conflicts = countConflictsInCombination(currentCombination);
      if (!preferences.allowConflicts && conflicts > 0) return;
      if (conflicts > preferences.maxConflicts) return;
      
      // Aynı dersin farklı section'ları kontrolü (ekstra güvenlik)
      if (hasDuplicateCourseSection(currentCombination)) return;
      
      results.push([...currentCombination]);
      return;
    }
    
    const { required, available } = requirements[tagIndex];
    
    // Bu etiketten gerekli sayıda ders seç
    const selectFromTag = (
      start: number,
      selected: Course[],
      localUsedBaseCodes: Set<string>
    ) => {
      if (selected.length === required) {
        // Bu etiketten yeterli ders seçildi, sonraki etikete geç
        backtrack(
          tagIndex + 1,
          [...currentCombination, ...selected],
          localUsedBaseCodes
        );
        return;
      }
      
      for (let i = start; i < available.length; i++) {
        // Pruning: Kalan dersler yeterli mi?
        if (available.length - i < required - selected.length) break;
        
        const course = available[i];
        const baseCode = getBaseCourseCode(course.courseCode);
        
        // ⚠️ AYNI DERSİN FARKLI SECTION'I KONTROLÜ
        // Bu dersin base kodu zaten seçildiyse atla
        if (localUsedBaseCodes.has(baseCode)) {
          continue;
        }
        
        // Erken çakışma kontrolü (pruning)
        if (!preferences.allowConflicts) {
          const hasConflict = currentCombination.some(c => coursesConflict(c, course)) ||
                             selected.some(c => coursesConflict(c, course));
          if (hasConflict) continue;
        }
        
        // Bu dersi seç ve base kodunu işaretle
        const newUsedBaseCodes = new Set(localUsedBaseCodes);
        newUsedBaseCodes.add(baseCode);
        
        selectFromTag(i + 1, [...selected, course], newUsedBaseCodes);
      }
    };
    
    selectFromTag(0, [], usedBaseCodes);
  };
  
  backtrack(0, [], new Set());
  
  return results;
};

// Ana fonksiyon: Ders programı önerileri oluştur
export const generateScheduleSuggestions = (
  eligibleCourses: Course[],
  preferences: SchedulePreferences
): ScheduleSuggestion[] => {
  // Sadece etiketli dersleri kullan
  const taggedCourses = eligibleCourses.filter(c => c.tag);
  
  if (taggedCourses.length === 0) {
    return [];
  }
  
  // Dersleri etiketlere göre grupla (sabit ve özel ayrı)
  const groupedBuiltIn = groupCoursesByBuiltInTag(taggedCourses);
  const groupedCustom = groupCoursesByCustomTag(taggedCourses);
  
  // Kombinasyonları bul (daha fazla öneri için limit yükseltildi)
  const combinations = findCombinations(groupedBuiltIn, groupedCustom, preferences, 100);
  
  if (combinations.length === 0) {
    return [];
  }
  
  // Her kombinasyonu puanla ve suggestion'a dönüştür
  const suggestions: ScheduleSuggestion[] = combinations.map((courses, index) => ({
    id: `suggestion-${index}`,
    courses,
    score: scoreSchedule(courses, preferences),
    conflictCount: countConflictsInCombination(courses),
    summary: createSummary(courses)
  }));
  
  // Skora göre sırala ve tümünü döndür
  return suggestions.sort((a, b) => b.score - a.score);
};

// Varsayılan tercihler
export const defaultPreferences: SchedulePreferences = {
  requirements: {
    [CourseTag.MANDATORY]: 0,
    [CourseTag.ELECTIVE]: 0,
    [CourseTag.IMPORTANT]: 0,
    [CourseTag.OPTIONAL]: 0
  },
  customRequirements: {},
  allowConflicts: false,
  maxConflicts: 0,
  avoidEarlyMorning: false,
  preferCompactSchedule: true
};

// Uygun derslerden etiketli olanların sayısını hesapla (sabit etiketler)
// NOT: Farklı section'lar ayrı ayrı sayılır (kullanıcı istediği section'ı seçebilsin diye)
export const countTaggedCourses = (courses: Course[]): { [key in CourseTag]: number } => {
  const counts = {
    [CourseTag.MANDATORY]: 0,
    [CourseTag.ELECTIVE]: 0,
    [CourseTag.IMPORTANT]: 0,
    [CourseTag.OPTIONAL]: 0
  };
  
  courses.forEach(course => {
    if (isBuiltInTag(course.tag)) {
      counts[course.tag]++;
    }
  });
  
  return counts;
};

// Özel etiketlerin sayısını hesapla
export const countCustomTaggedCourses = (courses: Course[]): { [tagId: string]: number } => {
  const counts: { [tagId: string]: number } = {};
  
  courses.forEach(course => {
    if (course.tag && !isBuiltInTag(course.tag)) {
      counts[course.tag] = (counts[course.tag] || 0) + 1;
    }
  });
  
  return counts;
};

// Benzersiz ders sayısını hesapla (section'lar birleştirilmiş, sabit etiketler)
export const countUniqueCourses = (courses: Course[]): { [key in CourseTag]: number } => {
  const uniqueByTag: { [key in CourseTag]: Set<string> } = {
    [CourseTag.MANDATORY]: new Set(),
    [CourseTag.ELECTIVE]: new Set(),
    [CourseTag.IMPORTANT]: new Set(),
    [CourseTag.OPTIONAL]: new Set()
  };
  
  courses.forEach(course => {
    if (isBuiltInTag(course.tag)) {
      const baseCode = getBaseCourseCode(course.courseCode);
      uniqueByTag[course.tag].add(baseCode);
    }
  });
  
  return {
    [CourseTag.MANDATORY]: uniqueByTag[CourseTag.MANDATORY].size,
    [CourseTag.ELECTIVE]: uniqueByTag[CourseTag.ELECTIVE].size,
    [CourseTag.IMPORTANT]: uniqueByTag[CourseTag.IMPORTANT].size,
    [CourseTag.OPTIONAL]: uniqueByTag[CourseTag.OPTIONAL].size
  };
};

// Özel etiketlerin benzersiz ders sayısını hesapla
export const countUniqueCustomTaggedCourses = (courses: Course[]): { [tagId: string]: number } => {
  const uniqueByTag: { [tagId: string]: Set<string> } = {};
  
  courses.forEach(course => {
    if (course.tag && !isBuiltInTag(course.tag)) {
      if (!uniqueByTag[course.tag]) {
        uniqueByTag[course.tag] = new Set();
      }
      const baseCode = getBaseCourseCode(course.courseCode);
      uniqueByTag[course.tag].add(baseCode);
    }
  });
  
  const counts: { [tagId: string]: number } = {};
  Object.entries(uniqueByTag).forEach(([tagId, set]) => {
    counts[tagId] = set.size;
  });
  
  return counts;
};
