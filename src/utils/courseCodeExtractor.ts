import type { Course } from '../types/Course';

export interface ExtractedCourseMatch {
  rawCode: string;         // Örn: "ACC3041"
  normalizedCode: string;  // Örn: "ACC3041"
  matchedCourses: Course[]; // Sistemdeki karşılık gelen tüm section'lar (örn: ACC3041.1, ACC3041.2)
  isMatched: boolean;
}

export interface ExtractionResult {
  totalExtractedCodes: number;
  matchedCodes: ExtractedCourseMatch[];
  unmatchedCodes: string[];
  totalMatchedCourses: number;
  allMatchedCourseIds: string[];
}

/**
 * Serbest metinden (Word, PDF, web, müfredat vb.) Marmara ve genel üniversite ders kodlarını tespit eder.
 * Örnek eşleşmeler: ACC3041, MIS 3021, PROD3001, QTDS4054, LAW3071, STAT4094, CSE101.1 vb.
 */
export function extractCourseCodes(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  // 2 ila 6 harfli bölüm kodu + opsiyonel boşluk/tire + 3 ila 4 basamaklı sayı + opsiyonel nokta section
  const regex = /\b([A-Za-zÇĞİÖŞÜçğıöşü]{2,6})[\s\-_]*([0-9]{3,4})(?:\.([0-9]+))?\b/g;
  
  const foundCodes = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const dept = match[1].trim().toUpperCase();
    const num = match[2].trim();
    // Tam taban kod örn: "ACC3041"
    const normalizedCode = `${dept}${num}`;
    foundCodes.add(normalizedCode);
  }

  return Array.from(foundCodes);
}

/**
 * Çıkarılan ders kodlarını mevcut ders veritabanı (courses) ile eşleştirir.
 */
export function matchCoursesWithCodes(extractedCodes: string[], courses: Course[]): ExtractionResult {
  const matchedCodes: ExtractedCourseMatch[] = [];
  const unmatchedCodes: string[] = [];
  const allMatchedCourseIdsSet = new Set<string>();

  // Sistemdeki dersleri normalize edilmiş taban kodlarına göre haritalandır
  // Örn: "ACC3041.1" -> baseCode: "ACC3041"
  const courseMap = new Map<string, Course[]>();

  courses.forEach(c => {
    // Section kısmını at (.1, .2 vb.) ve boşlukları kaldır
    const baseCode = c.courseCode
      .split('.')[0]
      .replace(/[\s\-_]/g, '')
      .toUpperCase();
    
    // Tam kodu da kontrol için ekle
    const fullCode = c.courseCode.replace(/[\s\-_]/g, '').toUpperCase();

    if (!courseMap.has(baseCode)) {
      courseMap.set(baseCode, []);
    }
    courseMap.get(baseCode)!.push(c);

    if (fullCode !== baseCode) {
      if (!courseMap.has(fullCode)) {
        courseMap.set(fullCode, []);
      }
      // Tekrarsız ekle
      if (!courseMap.get(fullCode)!.some(existing => existing.id === c.id)) {
        courseMap.get(fullCode)!.push(c);
      }
    }
  });

  extractedCodes.forEach(code => {
    const normalized = code.replace(/[\s\-_]/g, '').toUpperCase();
    const matches = courseMap.get(normalized) || [];

    if (matches.length > 0) {
      // Tekrarları filtrele
      const uniqueMatches: Course[] = [];
      matches.forEach(m => {
        if (!uniqueMatches.some(u => u.id === m.id)) {
          uniqueMatches.push(m);
          allMatchedCourseIdsSet.add(m.id);
        }
      });

      matchedCodes.push({
        rawCode: code,
        normalizedCode: normalized,
        matchedCourses: uniqueMatches,
        isMatched: true
      });
    } else {
      unmatchedCodes.push(code);
    }
  });

  return {
    totalExtractedCodes: extractedCodes.length,
    matchedCodes,
    unmatchedCodes,
    totalMatchedCourses: allMatchedCourseIdsSet.size,
    allMatchedCourseIds: Array.from(allMatchedCourseIdsSet)
  };
}
