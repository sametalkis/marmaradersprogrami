/**
 * Worker-ortamı Excel parse yardımcısı
 *
 * src/utils/excelParser.ts'nin SheetJS kısmını base64 girdiyle sarmalar;
 * zaman/blok parse mantığı için doğrudan src/utils/excelParser.ts import edilir
 * (tek kaynak, kopya yok).
 */

import * as XLSX from 'xlsx';
import type { Course } from '../src/types/Course';
import { parseAllSchedules } from '../src/utils/excelParser';

/**
 * Base64 Excel dosyasını Course[]'a parse eder.
 * src/utils/excelParser.ts'deki parseExcelFile ile aynı sütun adlarını okur
 * ('Ders Kodu', 'Ders Adı', 'Öğretim Elemanı', 'Gün Saat Derslik', 'Kredi').
 */
export const parseExcelFileFromBase64 = async (fileBase64: string): Promise<Course[]> =>
  parseExcelFileFromBytes(Uint8Array.from(atob(fileBase64), ch => ch.charCodeAt(0)));

/**
 * Ham baytlardan Course[]'a parse eder (REST /api/upload akışı — baytlar
 * modelden geçmez, curl/HTTP ile doğrudan gelir).
 */
export const parseExcelFileFromBytes = async (bytes: Uint8Array): Promise<Course[]> => {
  const workbook = XLSX.read(bytes, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

  const courses: Course[] = [];
  rows.forEach((row, index) => {
    const courseCode = row['Ders Kodu'] || row['DersKodu'] || '';
    const courseName = row['Ders Adı'] || row['DersAdı'] || '';
    const instructor = row['Öğretim Elemanı'] || row['ÖğretimElemanı'] || '';
    const dayTimeLocation = row['Gün Saat Derslik'] || row['GünSaatDerslik'] || '';
    const credits = row['Kredi'];

    if (!courseCode || !courseName) return;

    const dayTimeLocationStr = String(dayTimeLocation).trim();
    courses.push({
      id: `${courseCode}-${index}`,
      courseCode: String(courseCode).trim(),
      courseName: String(courseName).trim(),
      instructor: String(instructor).trim(),
      dayTimeLocation: dayTimeLocationStr,
      schedules: parseAllSchedules(dayTimeLocationStr),
      credits: credits != null && credits !== '' ? Number(credits) || undefined : undefined,
      isSelected: false,
      isEligible: false,
    });
  });

  return courses;
};
