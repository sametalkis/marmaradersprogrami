import * as XLSX from 'xlsx';
import type { Course, ExcelData, ParsedSchedule } from '../types/Course';
import { DAYS_OF_WEEK } from '../types/Course';

export const parseExcelFile = async (file: File): Promise<ExcelData> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // İlk sayfayı al
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    const courses: Course[] = [];
    const errors: string[] = [];
    
    jsonData.forEach((row: any, index: number) => {
      try {
        // Excel başlıklarına göre verileri al
        const courseCode = row['Ders Kodu'] || row['DersKodu'] || '';
        const courseName = row['Ders Adı'] || row['DersAdı'] || '';
        const instructor = row['Öğretim Elemanı'] || row['ÖğretimElemanı'] || '';
        const dayTimeLocation = row['Gün Saat Derslik'] || row['GünSaatDerslik'] || '';
        
        if (!courseCode || !courseName) {
          errors.push(`Satır ${index + 2}: Ders kodu veya ders adı eksik`);
          return;
        }
        
        const dayTimeLocationStr = dayTimeLocation.toString().trim();
        const schedules = parseAllSchedules(dayTimeLocationStr);
        
        const course: Course = {
          id: `${courseCode}-${index}`,
          courseCode: courseCode.toString().trim(),
          courseName: courseName.toString().trim(),
          instructor: instructor.toString().trim(),
          dayTimeLocation: dayTimeLocationStr,
          schedules: schedules,
          isSelected: false,
          isEligible: false  // Başlangıçta hiçbir ders uygun değil
        };
        
        courses.push(course);
      } catch (error) {
        errors.push(`Satır ${index + 2}: Veri işleme hatası - ${error}`);
      }
    });
    
    return { courses, errors };
  } catch (error) {
    throw new Error(`Excel dosyası okunamadı: ${error}`);
  }
};

export const parseSchedule = (dayTimeLocation: string): ParsedSchedule | null => {
  try {
    // Karmaşık format: "Pazartesi 09:30 - 10:20 [RTE.I1.Z01] Salı 13:00 - 13:50 [RTE.I2.232]" gibi
    // İlk schedule bloğunu al
    const firstSchedule = parseFirstScheduleBlock(dayTimeLocation);
    return firstSchedule;
  } catch (error) {
    console.error('Schedule parsing error:', error);
    return null;
  }
};

export const parseAllSchedules = (dayTimeLocation: string): ParsedSchedule[] => {
  try {
    const schedules: ParsedSchedule[] = [];
    
    // Regex ile tüm "Gün SS:DD - SS:DD [Derslik]" pattern'larını bul
    const pattern = /(Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\[([^\]]+)\]/g;
    let match;
    const dayGroups: { [day: string]: { times: { start: string; end: string }[]; classroom: string } } = {};
    
    // Tüm match'leri topla ve güne göre grupla
    while ((match = pattern.exec(dayTimeLocation)) !== null) {
      const [, day, startTime, endTime, classroom] = match;
      
      // Gün adını kontrol et
      if (DAYS_OF_WEEK.includes(day as any)) {
        if (!dayGroups[day]) {
          dayGroups[day] = { times: [], classroom };
        }
        dayGroups[day].times.push({ start: startTime, end: endTime });
      }
    }
    
    // Her gün için en erken başlangıç ve en geç bitiş saatini bul
    Object.entries(dayGroups).forEach(([day, group]) => {
      const allTimes = group.times;
      if (allTimes.length > 0) {
        // En erken başlangıç saati
        const earliestStart = allTimes.reduce((earliest, time) => 
          time.start < earliest ? time.start : earliest, allTimes[0].start);
        
        // En geç bitiş saati  
        const latestEnd = allTimes.reduce((latest, time) => 
          time.end > latest ? time.end : latest, allTimes[0].end);
        
        schedules.push({
          day,
          startTime: earliestStart,
          endTime: latestEnd,
          classroom: group.classroom
        });
      }
    });
    
    return schedules;
  } catch (error) {
    console.error('All schedules parsing error:', error);
    return [];
  }
};

const parseFirstScheduleBlock = (dayTimeLocation: string): ParsedSchedule | null => {
  try {
    // İlk schedule bloğunu bul
    const pattern = /(Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\[([^\]]+)\]/;
    const match = dayTimeLocation.match(pattern);
    
    if (!match) return null;
    
    const [, day, startTime, endTime, classroom] = match;
    
    // Gün adını kontrol et
    if (!DAYS_OF_WEEK.includes(day as any)) return null;
    
    return {
      day,
      startTime,
      endTime,
      classroom
    };
  } catch (error) {
    console.error('First schedule parsing error:', error);
    return null;
  }
};

export const checkTimeConflict = (schedule1: ParsedSchedule, schedule2: ParsedSchedule): boolean => {
  // Farklı günlerse çakışma yok
  if (schedule1.day !== schedule2.day) return false;
  
  // Saat çakışmasını kontrol et
  const start1 = timeToMinutes(schedule1.startTime);
  const end1 = timeToMinutes(schedule1.endTime);
  const start2 = timeToMinutes(schedule2.startTime);
  const end2 = timeToMinutes(schedule2.endTime);
  
  return !(end1 <= start2 || end2 <= start1);
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
