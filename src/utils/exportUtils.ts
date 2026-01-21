import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { Course, ParsedSchedule } from '../types/Course';
import { parseAllSchedules } from './excelParser';
import { DAYS_OF_WEEK } from '../types/Course';

// Renk paleti
const COURSE_COLORS = [
  { r: 139, g: 92, b: 246 },   // violet
  { r: 16, g: 185, b: 129 },   // emerald
  { r: 245, g: 158, b: 11 },   // amber
  { r: 244, g: 63, b: 94 },    // rose
  { r: 6, g: 182, b: 212 },    // cyan
  { r: 217, g: 70, b: 239 },   // fuchsia
  { r: 132, g: 204, b: 22 },   // lime
  { r: 249, g: 115, b: 22 },   // orange
  { r: 20, g: 184, b: 166 },   // teal
  { r: 99, g: 102, b: 241 },   // indigo
];

export const exportToPDF = async (_elementId: string, filename: string = 'ders-programi.pdf', courses?: Course[]) => {
  // courses parametresi yoksa window'dan al (eski uyumluluk için)
  const allCourses = courses || (window as any).__SCHEDULE_COURSES__ || [];
  const selectedCourses = allCourses.filter((c: Course) => c.isSelected);
  
  if (selectedCourses.length === 0) {
    throw new Error('Seçili ders bulunamadı');
  }

  const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 15;
  
  // Font ayarları - Türkçe karakter desteği için
  pdf.setFont('helvetica');
  
  // Başlık
  pdf.setFillColor(79, 70, 229); // indigo-600
  pdf.rect(0, 0, pageWidth, 25, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('MARMARA UNIVERSITESI DERS PROGRAMI', pageWidth / 2, 16, { align: 'center' });
  
  // Alt başlık
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const today = new Date().toLocaleDateString('tr-TR');
  pdf.text(`Olusturulma Tarihi: ${today} | Toplam ${selectedCourses.length} Ders`, pageWidth / 2, 22, { align: 'center' });
  
  // Haftalık program tablosu
  const tableTop = 35;
  const dayColumnWidth = 25;
  const hourCount = 11; // 08:00 - 18:00
  const hourWidth = (pageWidth - margin * 2 - dayColumnWidth) / hourCount;
  const rowHeight = 18;
  
  // Günleri sadece ders olanlar için filtrele
  const daysWithCourses = new Set<string>();
  selectedCourses.forEach((course: Course) => {
    const schedules = course.schedules || parseAllSchedules(course.dayTimeLocation);
    schedules.forEach(s => s && daysWithCourses.add(s.day));
  });
  const activeDays = DAYS_OF_WEEK.filter(day => 
    daysWithCourses.has(day) || ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma'].includes(day)
  );
  
  // Saat başlıkları
  pdf.setFillColor(241, 245, 249); // slate-100
  pdf.rect(margin, tableTop, pageWidth - margin * 2, 8, 'F');
  
  pdf.setTextColor(71, 85, 105); // slate-600
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  
  // Sol üst köşe - "Saat" yazısı
  pdf.text('Saat', margin + 2, tableTop + 5.5);
  
  // Saat başlıkları
  for (let h = 8; h <= 18; h++) {
    const x = margin + dayColumnWidth + (h - 8) * hourWidth;
    pdf.text(`${h.toString().padStart(2, '0')}:00`, x + hourWidth / 2, tableTop + 5.5, { align: 'center' });
  }
  
  // Çizgi
  pdf.setDrawColor(203, 213, 225); // slate-300
  pdf.line(margin, tableTop + 8, pageWidth - margin, tableTop + 8);
  
  // Her ders için renk ata
  const courseColorMap = new Map<string, typeof COURSE_COLORS[0]>();
  selectedCourses.forEach((course: Course, index: number) => {
    courseColorMap.set(course.id, COURSE_COLORS[index % COURSE_COLORS.length]);
  });
  
  // Günler ve dersler
  let currentY = tableTop + 10;
  
  activeDays.forEach((day, dayIndex) => {
    // Gün arka planı (alternatif)
    if (dayIndex % 2 === 0) {
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, 'F');
    }
    
    // Gün adı
    pdf.setTextColor(51, 65, 85); // slate-700
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    // Türkçe karakterleri ASCII'ye çevir
    const dayName = day
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'O')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C');
    
    pdf.text(dayName.substring(0, 3), margin + 2, currentY + rowHeight / 2 + 1);
    
    // Bu günün dersleri
    const daySchedules: { course: Course; schedule: ParsedSchedule }[] = selectedCourses.flatMap((course: Course) => {
      const schedules = course.schedules || parseAllSchedules(course.dayTimeLocation);
      return schedules
        .filter((s): s is ParsedSchedule => s !== null && s.day === day)
        .map(s => ({ course, schedule: s }));
    });
    
    // Dersleri çiz
    daySchedules.forEach(({ course, schedule }: { course: Course; schedule: ParsedSchedule }) => {
      const startHour = parseInt(schedule.startTime.split(':')[0]);
      const startMin = parseInt(schedule.startTime.split(':')[1]);
      const endHour = parseInt(schedule.endTime.split(':')[0]);
      const endMin = parseInt(schedule.endTime.split(':')[1]);
      
      const startX = margin + dayColumnWidth + (startHour - 8 + startMin / 60) * hourWidth;
      const endX = margin + dayColumnWidth + (endHour - 8 + endMin / 60) * hourWidth;
      const width = endX - startX;
      
      const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
      
      // Ders bloğu
      pdf.setFillColor(color.r, color.g, color.b);
      pdf.roundedRect(startX + 1, currentY + 1, width - 2, rowHeight - 2, 2, 2, 'F');
      
      // Ders kodu
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      
      const courseCode = course.courseCode
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'I')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 'S')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'U')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'O')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'C');
      
      if (width > 20) {
        pdf.text(courseCode, startX + 3, currentY + 6);
        
        // Saat bilgisi
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${schedule.startTime}-${schedule.endTime}`, startX + 3, currentY + 10);
        
        // Derslik
        if (width > 35) {
          const classroom = schedule.classroom
            .replace(/ı/g, 'i')
            .replace(/İ/g, 'I')
            .replace(/ş/g, 's')
            .replace(/Ş/g, 'S')
            .replace(/ğ/g, 'g')
            .replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u')
            .replace(/Ü/g, 'U')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'O')
            .replace(/ç/g, 'c')
            .replace(/Ç/g, 'C');
          pdf.text(classroom.substring(0, 12), startX + 3, currentY + 14);
        }
      } else {
        // Dar blok - sadece kod
        pdf.text(courseCode.substring(0, 6), startX + 2, currentY + rowHeight / 2 + 1);
      }
    });
    
    // Satır çizgisi
    pdf.setDrawColor(226, 232, 240); // slate-200
    pdf.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);
    
    currentY += rowHeight;
  });
  
  // Ders listesi tablosu
  currentY += 10;
  
  // Eğer sayfa taşıyorsa yeni sayfa
  if (currentY + 50 > pageHeight) {
    pdf.addPage();
    currentY = margin;
  }
  
  // Ders listesi başlığı
  pdf.setFillColor(241, 245, 249);
  pdf.rect(margin, currentY, pageWidth - margin * 2, 8, 'F');
  
  pdf.setTextColor(51, 65, 85);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SECILEN DERSLER', margin + 5, currentY + 5.5);
  
  currentY += 12;
  
  // Tablo başlıkları
  const colWidths = [25, 70, 50, 35, 30, 35];
  const headers = ['Kod', 'Ders Adi', 'Ogretim Elemani', 'Gun', 'Saat', 'Derslik'];
  
  pdf.setFillColor(79, 70, 229);
  pdf.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  
  let colX = margin + 2;
  headers.forEach((header, i) => {
    pdf.text(header, colX, currentY + 5);
    colX += colWidths[i];
  });
  
  currentY += 9;
  
  // Ders satırları
  pdf.setFont('helvetica', 'normal');
  
  selectedCourses.forEach((course: Course, index: number) => {
    // Sayfa kontrolü
    if (currentY + 8 > pageHeight - margin) {
      pdf.addPage();
      currentY = margin;
    }
    
    // Alternatif satır rengi
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
    }
    
    const schedules = course.schedules || parseAllSchedules(course.dayTimeLocation);
    const schedule = schedules[0];
    const color = courseColorMap.get(course.id) || COURSE_COLORS[0];
    
    // Renk göstergesi
    pdf.setFillColor(color.r, color.g, color.b);
    pdf.circle(margin + 3, currentY + 3.5, 2, 'F');
    
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(7);
    
    // Türkçe karakterleri ASCII'ye çevir
    const sanitize = (text: string) => text
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'O')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C');
    
    colX = margin + 7;
    const rowData = [
      sanitize(course.courseCode),
      sanitize(course.courseName).substring(0, 35),
      sanitize(course.instructor).substring(0, 25),
      schedule ? sanitize(schedule.day).substring(0, 3) : '-',
      schedule ? `${schedule.startTime}-${schedule.endTime}` : '-',
      schedule ? sanitize(schedule.classroom).substring(0, 15) : '-'
    ];
    
    rowData.forEach((data, i) => {
      pdf.text(data, colX, currentY + 5);
      colX += colWidths[i];
    });
    
    currentY += 7;
  });
  
  // Alt bilgi
  pdf.setDrawColor(203, 213, 225);
  pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.setFontSize(8);
  pdf.text('Marmara Universitesi Ders Programi Uygulamasi', margin, pageHeight - 6);
  pdf.text(`Sayfa 1`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  
  pdf.save(filename);
};

// Global courses referansı için App.tsx'te set edilecek
export const setScheduleCourses = (courses: Course[]) => {
  (window as any).__SCHEDULE_COURSES__ = courses;
};

export const exportToExcel = (courses: Course[], filename: string = 'secilen-dersler.xlsx') => {
  try {
    const selectedCourses = courses.filter(course => course.isSelected);
    
    const excelData = selectedCourses.map(course => {
      const schedules = course.schedules || parseAllSchedules(course.dayTimeLocation);
      const allDays = schedules.map(s => s?.day).filter(Boolean).join(', ');
      const allTimes = schedules.map(s => s ? `${s.startTime}-${s.endTime}` : '').filter(Boolean).join(', ');
      const allRooms = schedules.map(s => s?.classroom).filter(Boolean).join(', ');
      
      return {
        'Ders Kodu': course.courseCode,
        'Ders Adı': course.courseName,
        'Öğretim Elemanı': course.instructor,
        'Gün': allDays,
        'Saat': allTimes,
        'Derslik': allRooms,
        'Tam Bilgi': course.dayTimeLocation,
        'Kredi': course.credits || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    
    // Kolon genişliklerini ayarla
    const colWidths = [
      { wch: 12 }, // Ders Kodu
      { wch: 40 }, // Ders Adı
      { wch: 30 }, // Öğretim Elemanı
      { wch: 20 }, // Gün
      { wch: 20 }, // Saat
      { wch: 20 }, // Derslik
      { wch: 50 }, // Tam Bilgi
      { wch: 8 }   // Kredi
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Seçilen Dersler');
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Excel export error:', error);
    throw new Error('Excel dosyası oluşturulurken bir hata oluştu');
  }
};

export const generateScheduleSummary = (courses: Course[]): string => {
  const selectedCourses = courses.filter(course => course.isSelected);
  
  let summary = 'MARMARA ÜNİVERSİTESİ DERS PROGRAMI\n';
  summary += '='.repeat(50) + '\n\n';
  
  summary += `Toplam Ders Sayısı: ${selectedCourses.length}\n`;
  summary += `Toplam Kredi: ${selectedCourses.reduce((total, course) => total + (course.credits || 0), 0)}\n\n`;
  
  // Günlere göre gruplanmış dersler
  const dayGroups: { [day: string]: { course: Course; schedule: any }[] } = {};
  
  selectedCourses.forEach(course => {
    const schedules = course.schedules || parseAllSchedules(course.dayTimeLocation);
    schedules.forEach(schedule => {
      if (schedule) {
        const day = schedule.day;
        if (!dayGroups[day]) {
          dayGroups[day] = [];
        }
        dayGroups[day].push({ course, schedule });
      }
    });
  });

  // Günleri sırala
  const orderedDays = DAYS_OF_WEEK.filter(day => dayGroups[day]);
  
  orderedDays.forEach(day => {
    summary += `${day.toUpperCase()}\n`;
    summary += '-'.repeat(30) + '\n';
    
    dayGroups[day]
      .sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))
      .forEach(({ course, schedule }) => {
        const timeInfo = `${schedule.startTime}-${schedule.endTime}`;
        const classroom = schedule.classroom;
        
        summary += `${timeInfo} | ${course.courseCode} - ${course.courseName}\n`;
        summary += `         | ${course.instructor} | ${classroom}\n\n`;
      });
  });

  return summary;
};

export const downloadTextFile = (content: string, filename: string = 'ders-programi.txt') => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(link.href);
};
