import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { Course, ParsedSchedule } from '../types/Course';
import { parseAllSchedules } from './excelParser';
import { DAYS_OF_WEEK } from '../types/Course';
import { getScheduleItemsForDay, timeToMinutes, endTimeToMinutes } from './scheduleRenderUtils';

/*
 * PDF çıktısı artık ekrandaki DOM'un ekran görüntüsü ALINARAK değil, ders verisinden
 * doğrudan bir Canvas üzerine çizilerek üretilir. Böylece:
 *  - Mobilde gizli olan masaüstü ızgarasını klonlama hilesine gerek kalmaz (mobilde birebir çalışır),
 *  - Tailwind sınıflarının html2canvas tarafından yanlış ölçülmesi sonucu oluşan iç içe/yamuk
 *    metin problemi tamamen ortadan kalkar (tüm yerleşim bizim kontrolümüzde),
 *  - Çıktı her cihazda piksel piksel aynıdır.
 * Türkçe karakterler canvas fillText ile sistem fontuyla sorunsuz basılır.
 */

// COURSE_COLORS ile birebir aynı sıraya sahip canvas uyumlu hex paleti
const COURSE_HEX = [
  '#7c3aed', // violet-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#0891b2', // cyan-600
  '#c026d3', // fuchsia-600
  '#65a30d', // lime-600
  '#ea580c', // orange-600
  '#0d9488', // teal-600
  '#4f46e5', // indigo-600
] as const;

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const MONO_STACK = `'SF Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace`;

// Yerleşim sabitleri (mantıksal piksel; çıktı SCALE kat büyütülerek basılır)
const SCALE = 3;          // ~300 DPI baskı keskinliği
const CANVAS_W = 1600;
const MARGIN = 32;
const HEADER_H = 88;
const DAY_HEADER_H = 40;
const TIME_COL_W = 118;
const HOUR_H = 72;
const START_HOUR = 8;

const INK = '#0f172a';      // slate-900
const GRID_LINE = '#e2e8f0'; // slate-200
const ROW_ALT = '#f8fafc';   // slate-50
const MUTED = '#64748b';     // slate-500
const CONFLICT = '#ef4444';  // red-500

/** Verinin tek kaynağı: her dersin tüm zamanlarını normalize eder */
const getCourseSchedules = (course: Course): ParsedSchedule[] => {
  return (course.schedules && course.schedules.length > 0)
    ? course.schedules
    : parseAllSchedules(course.dayTimeLocation);
};

/** Kelime kelyme satır sarmalama; maxLines'ı aşarsa son satırı ... ile kısaltır */
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // Taşma varsa son satırı elipsle kes
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last.trimEnd() + '…';
  }
  return lines;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

/** Programı yüksek çözünürlüklü canvas'a çizer; data URL ve mantıksal boyutlarını döner */
const renderScheduleCanvas = (courses: Course[]): { dataUrl: string; width: number; height: number } => {
  const selected = courses.filter(c => c.isSelected);
  if (selected.length === 0) {
    throw new Error('PDF için seçili ders bulunamadı');
  }

  // Gün bazlı dersler ve saat aralığı
  const itemsByDay = DAYS_OF_WEEK.map(day => getScheduleItemsForDay(selected, day));
  const nonEmpty = itemsByDay.map((items, i) => ({ items, day: DAYS_OF_WEEK[i] })).filter(d => d.items.length > 0);

  let maxEndHour = 17;
  selected.forEach(course => {
    getCourseSchedules(course).forEach(s => {
      if (s?.endTime) {
        const [h, m] = s.endTime.split(':').map(Number);
        const endH = m > 0 ? h + 1 : h;
        if (endH > maxEndHour) maxEndHour = endH;
      }
    });
  });
  maxEndHour = Math.min(Math.max(maxEndHour, 18), 23);

  // Görüntülenecek günler: dersi olan günler; hiç ders yoksa hafta içi
  const days = nonEmpty.length > 0 ? nonEmpty.map(d => d.day) : DAYS_OF_WEEK.slice(0, 5);
  const dayItems = days.map(day => getScheduleItemsForDay(selected, day));

  // Renk eşlemesi: ScheduleViewer ile aynı (sıra tabanlı) atama
  const colorOf = new Map<string, string>();
  selected.forEach((course, index) => colorOf.set(course.id, COURSE_HEX[index % COURSE_HEX.length]));

  // Canvas boyutları
  const hourCount = maxEndHour - START_HOUR; // çizilen satır sayısı
  const gridH = hourCount * HOUR_H;
  const legendRows = Math.ceil(selected.length / 7); // satır başına ~7 rozet
  const LEGEND_H = selected.length > 0 ? 28 + legendRows * 30 : 0;
  const totalH = MARGIN + HEADER_H + DAY_HEADER_H + gridH + 14 + LEGEND_H + MARGIN;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W * SCALE;
  canvas.height = totalH * SCALE;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Zemin
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, totalH);

  // ----- Başlık -----
  let y = MARGIN;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `800 30px ${FONT_STACK}`;
  ctx.fillText('Haftalık Ders Programı', MARGIN, y + 30);

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.font = `600 15px ${FONT_STACK}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(`${selected.length} ders  •  ${dateStr}  •  Marmara Üniversitesi`, MARGIN, y + 56);

  // Sağ üstte toplam ders/çakışma rozeti
  const gridW = CANVAS_W - MARGIN * 2 - TIME_COL_W;
  ctx.font = `700 15px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.fillText('Marmara Üniversitesi', CANVAS_W - MARGIN, y + 30);
  ctx.textAlign = 'left';

  y += HEADER_H;

  // ----- Gün başlıkları -----
  const gridX = MARGIN + TIME_COL_W;
  const dayW = gridW / days.length;

  ctx.fillStyle = INK;
  roundRect(ctx, MARGIN, y, TIME_COL_W + gridW, DAY_HEADER_H, 10);
  ctx.fill();

  ctx.font = `700 15px ${FONT_STACK}`;
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('SAAT / GÜN', MARGIN + TIME_COL_W / 2, y + DAY_HEADER_H / 2 + 5);

  days.forEach((day, i) => {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 17px ${FONT_STACK}`;
    ctx.fillText(day, gridX + dayW * i + dayW / 2, y + DAY_HEADER_H / 2 + 6);
  });
  ctx.textAlign = 'left';
  y += DAY_HEADER_H;

  // ----- Izgara zemini ve saat ekseni -----
  for (let r = 0; r < hourCount; r++) {
    const rowY = y + r * HOUR_H;
    if (r % 2 === 1) {
      ctx.fillStyle = ROW_ALT;
      ctx.fillRect(gridX, rowY, gridW, HOUR_H);
    }
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, rowY + 0.5);
    ctx.lineTo(MARGIN + TIME_COL_W + gridW, rowY + 0.5);
    ctx.stroke();

    const hour = START_HOUR + r;
    ctx.font = `600 12px ${MONO_STACK}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    const hh = hour.toString().padStart(2, '0');
    ctx.fillText(`${hh}:00 - ${hh}:50`, MARGIN + TIME_COL_W / 2, rowY + HOUR_H / 2 + 4);
    ctx.textAlign = 'left';
  }

  // Alt ve dikey çizgiler
  const gridBottom = y + gridH;
  ctx.strokeStyle = GRID_LINE;
  ctx.beginPath();
  ctx.moveTo(MARGIN, gridBottom + 0.5);
  ctx.lineTo(MARGIN + TIME_COL_W + gridW, gridBottom + 0.5);
  ctx.stroke();

  for (let i = 0; i <= days.length; i++) {
    const lineX = (i === 0 ? MARGIN : gridX + dayW * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(lineX, y);
    ctx.lineTo(lineX, gridBottom);
    ctx.stroke();
  }

  // ----- Ders blokları -----
  const pad = 4; // bloklar arası nefes payı
  dayItems.forEach((items, dayIdx) => {
    const colX = gridX + dayW * dayIdx;

    items.forEach(({ course, schedule, stackIndex, stackSize, hasConflict }) => {
      const startMin = timeToMinutes(schedule.startTime);
      const endMin = endTimeToMinutes(schedule.endTime);
      const dayStartMin = START_HOUR * 60;

      const top = y + ((startMin - dayStartMin) / 60) * HOUR_H;
      const height = Math.max(((endMin - startMin) / 60) * HOUR_H - pad * 2, 34);

      const slotW = dayW / stackSize;
      const x = colX + stackIndex * slotW + pad;
      const w = slotW - pad * 2;

      const hex = colorOf.get(course.id) || COURSE_HEX[0];
      ctx.fillStyle = hex;
      roundRect(ctx, x, top + pad, w, height, 10);
      ctx.fill();

      if (hasConflict) {
        ctx.strokeStyle = CONFLICT;
        ctx.lineWidth = 2.5;
        roundRect(ctx, x + 1.5, top + pad + 1.5, w - 3, height - 3, 8);
        ctx.stroke();
      }

      // İçerik yerleşimi
      const innerX = x + 10;
      const innerW = w - 20;
      const contentTop = top + pad + 10;

      ctx.save();
      ctx.beginPath();
      roundRect(ctx, x, top + pad, w, height, 10);
      ctx.clip();

      // Ders kodu (her zaman tam görünür)
      ctx.font = `800 15px ${FONT_STACK}`;
      ctx.fillStyle = '#ffffff';
      const code = ctx.measureText(course.courseCode).width > innerW
        ? course.courseCode.slice(0, 14)
        : course.courseCode;
      ctx.fillText(code, innerX, contentTop + 12);

      // Saat (kodun altında, her blokta)
      let cursorY = contentTop + 30;
      ctx.font = `700 11px ${MONO_STACK}`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(`${schedule.startTime}-${schedule.endTime}`, innerX, cursorY);

      // Ders adı: yüksekliğe göre 1-3 satır sarmala
      cursorY += 16;
      const maxNameLines = height > 150 ? 3 : height > 100 ? 2 : 1;
      if (height > 60) {
        ctx.font = `600 12px ${FONT_STACK}`;
        const nameLines = wrapText(ctx, course.courseName, innerW, maxNameLines);
        nameLines.forEach((line, li) => {
          ctx.fillText(line, innerX, cursorY + li * 15);
        });
        cursorY += nameLines.length * 15;
      }

      // Hoca (sadece uzun bloklarda)
      if (height > 170 && course.instructor) {
        ctx.font = `500 11px ${FONT_STACK}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const [instrLine] = wrapText(ctx, course.instructor, innerW, 1);
        ctx.fillText(instrLine, innerX, cursorY + 2);
      }

      // Derslik: bloğun alt sağ köşesine yasla
      if (schedule.classroom) {
        ctx.font = `700 11px ${FONT_STACK}`;
        const room = schedule.classroom;
        const roomW = ctx.measureText(room).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        roundRect(ctx, x + w - roomW - 8, top + pad + height - 24, roomW, 17, 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(room, x + w - roomW / 2 - 8, top + pad + height - 11.5);
        ctx.textAlign = 'left';
      }

      ctx.restore();
    });
  });

  // ----- Legend (ders renk anahtarı) -----
  let ly = gridBottom + 14 + 18;
  ctx.font = `700 13px ${FONT_STACK}`;
  ctx.fillStyle = INK;
  ctx.fillText('Dersler', MARGIN, ly);
  ly += 12;

  const chipH = 24;
  let chipX = MARGIN;
  selected.forEach(course => {
    const label = course.courseCode;
    ctx.font = `700 12.5px ${FONT_STACK}`;
    const dotAndGap = 16;
    const chipW = ctx.measureText(label).width + dotAndGap + 20;
    if (chipX + chipW > CANVAS_W - MARGIN) {
      chipX = MARGIN;
      ly += chipH + 6;
    }
    ctx.fillStyle = '#f1f5f9';
    roundRect(ctx, chipX, ly, chipW, chipH, 12);
    ctx.fill();
    ctx.fillStyle = colorOf.get(course.id) || COURSE_HEX[0];
    ctx.beginPath();
    ctx.arc(chipX + 12, ly + chipH / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(label, chipX + dotAndGap + 6, ly + chipH / 2 + 4.5);
    chipX += chipW + 8;
  });

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: CANVAS_W, height: totalH };
};

export const exportToPDF = async (
  _elementId: string = 'schedule-viewer',
  filename: string = 'marmara-ders-programi.pdf',
  courses?: Course[]
) => {
  try {
    const courseData = courses || (window as any).__SCHEDULE_COURSES__ as Course[] | undefined;
    if (!courseData || courseData.filter(c => c.isSelected).length === 0) {
      throw new Error('Program için seçili ders bulunamadı');
    }

    const { dataUrl, width, height } = renderScheduleCanvas(courseData);

    // Haftalık ders programı HER ZAMAN yatay (landscape) A4
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const margin = 6;
    const maxW = pdf.internal.pageSize.getWidth() - margin * 2;   // 285mm
    const maxH = pdf.internal.pageSize.getHeight() - margin * 2;  // 198mm

    let finalW = maxW;
    let finalH = (height * finalW) / width;
    if (finalH > maxH) {
      finalH = maxH;
      finalW = (width * finalH) / height;
    }

    // Sayfada ortala (canvas oranı A4'e yakınsa neredeyse tam sayfa olur)
    const posX = (pdf.internal.pageSize.getWidth() - finalW) / 2;
    const posY = (pdf.internal.pageSize.getHeight() - finalH) / 2;

    pdf.addImage(dataUrl, 'JPEG', posX, posY, finalW, finalH, undefined, 'FAST');
    pdf.save(filename);
  } catch (error) {
    console.error('PDF export error:', error);
    throw error instanceof Error && error.message.startsWith('PDF için')
      ? error
      : new Error('PDF oluşturulurken bir hata oluştu');
  }
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
