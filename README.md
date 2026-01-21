# Marmara Üniversitesi Ders Programı Uygulaması

Marmara Üniversitesi öğrencileri için sunulan dersler Excel dosyasından kişisel ders programı oluşturma uygulaması.

## Özellikler

### 📚 Excel Dosyası Yükleme
- Drag & Drop veya file picker ile Excel yükleme
- Otomatik veri parse etme
- Hata kontrolü ve bilgilendirme

### 📖 Üç Ana Bölüm
1. **Tüm Sunulan Dersler** - Excel'den gelen tüm dersler
2. **Almaya Uygun Dersler** - Seçilmeye hazır dersler
3. **Seçilen Dersler** - Final ders programınız

### 🕒 Akıllı Çakışma Kontrolü
- Otomatik saat çakışması tespiti
- Görsel uyarılar
- Çakışan derslerin listesi

### 📅 Program Görselleştirme
- Haftalık takvim görünümü
- Renkli ders bloklarının
- Responsive tasarım

### 💾 Veri Saklama
- LocalStorage ile otomatik kayıt
- Tarayıcı kapatılsa bile veriler korunur
- Sıfırdan başlama seçeneği

### 📄 Export Seçenekleri
- **PDF Export** - Program takvimini PDF olarak indir
- **Excel Export** - Seçilen dersleri Excel dosyası olarak kaydet  
- **Metin Export** - Basit metin formatında özet

## Teknolojiler

- **React 18** - Modern UI framework
- **TypeScript** - Type-safe geliştirme
- **Vite** - Hızlı build tool
- **Tailwind CSS** - Utility-first CSS
- **SheetJS** - Excel dosyası okuma
- **jsPDF** - PDF oluşturma
- **Lucide React** - İkonlar

## Kurulum

### Gereksinimler
- Node.js 18+ 
- npm veya yarn

### Adımlar

1. **Projeyi klonlayın**
   ```bash
   git clone <repository-url>
   cd marmara-schedule-app
   ```

2. **Bağımlılıkları yükleyin**
   ```bash
   npm install
   ```

3. **Geliştirme server'ını başlatın**
   ```bash
   npm run dev
   ```

4. **Tarayıcıda açın**
   ```
   http://localhost:5173
   ```

## Kullanım

### 1. Excel Dosyası Hazırlama
Excel dosyanızda şu başlıklar olmalı:
- **Ders Kodu** - Dersin kodu (örn: BIL101)
- **Ders Adı** - Dersin tam adı
- **Öğretim Elemanı** - Dersi veren hoca
- **Gün Saat Derslik** - "Pazartesi 09:00-10:50 A-101" formatında

### 2. Dosya Yükleme
- Uygulamayı açın
- Excel dosyasını sürükleyip bırakın veya "Dosya Seç" butonunu kullanın
- Veriler otomatik olarak işlenecek

### 3. Ders Seçimi
- **Tüm Dersler** sekmesinden derslere bakın
- **+** butonuna tıklayarak dersleri **Uygun Dersler**'e ekleyin
- **Uygun Dersler**'den **+** ile **Seçilen Dersler**'e taşıyın
- Çakışma varsa uyarı alacaksınız

### 4. Program Görüntüleme
- **Program Görünümü** sekmesinde haftalık programınızı görün
- Çakışmalar kırmızı renkle işaretlenir
- Export butonları ile programınızı kaydedin

## Excel Dosyası Formatı

| Ders Kodu | Ders Adı | Öğretim Elemanı | Gün Saat Derslik |
|-----------|----------|-----------------|-------------------|
| BIL101 | Bilgisayar Programlama | Dr. Ahmet YILMAZ | Pazartesi 09:00-10:50 A-101 |
| MAT102 | Matematik II | Prof. Dr. Ayşe KAYA | Salı 13:00-14:50 B-205 |

## Özellik Detayları

### Çakışma Kontrolü
- Aynı gün ve saatteki dersler otomatik tespit edilir
- Seçim yapmadan önce uyarı verilir
- Çakışan dersler görsel olarak işaretlenir

### Responsive Tasarım
- Mobil cihazlarda da rahatlıkla kullanılabilir
- Tablet ve desktop için optimize edilmiş
- Touch-friendly arayüz

### Erişilebilirlik
- Klavye navigasyonu desteği
- Screen reader uyumlu
- High contrast mod desteği

## Geliştirme

### Projeyi Geliştirmek
```bash
npm run dev     # Geliştirme server'ı
npm run build   # Production build
npm run preview # Build önizleme
npm run lint    # Kod kontrolü
```

### Klasör Yapısı
```
src/
├── components/          # React bileşenleri
│   ├── ExcelUploader.tsx
│   ├── CourseList.tsx
│   ├── CourseCard.tsx
│   └── ScheduleViewer.tsx
├── hooks/              # Custom hooks
│   └── useLocalStorage.ts
├── types/              # TypeScript türleri
│   └── Course.ts
├── utils/              # Utility fonksiyonları
│   ├── excelParser.ts
│   ├── scheduleManager.ts
│   └── exportUtils.ts
└── App.tsx             # Ana component
```

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## Destek

Sorularınız için:
- GitHub Issues
- E-posta: [email]

---

**Marmara Üniversitesi öğrencileri için geliştirilmiştir. 🎓**