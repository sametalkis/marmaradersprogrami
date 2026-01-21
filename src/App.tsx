import { useState, useCallback } from 'react';
import { Download, FileText, AlertTriangle, Wand2, BookOpen, CheckCircle, List, Upload, Tag } from 'lucide-react';
import type { Course, ExcelData, ScheduleConflict, CustomTag } from './types/Course';
import { CourseStatus, CourseTag } from './types/Course';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ExcelUploader } from './components/ExcelUploader';
import { CourseList } from './components/CourseList';
import { ScheduleViewer } from './components/ScheduleViewer';
import { ConfirmModal } from './components/ConfirmModal';
import { AutoScheduleModal } from './components/AutoScheduleModal';
import { AccordionPanel } from './components/AccordionPanel';
import { TagManager } from './components/TagManager';
import { canAddCourse, findScheduleConflicts } from './utils/scheduleManager';
import { exportToPDF, exportToExcel, generateScheduleSummary, downloadTextFile } from './utils/exportUtils';
import './App.css';

function App() {
  const [courses, setCourses] = useLocalStorage<Course[]>('marmara-courses', []);
  const [customTags, setCustomTags] = useLocalStorage<CustomTag[]>('marmara-custom-tags', []);
  const [openAccordion, setOpenAccordion] = useState<'all' | 'eligible' | 'selected' | 'tags' | null>('all');
  const [isExporting, setIsExporting] = useState(false);
  
  // Çakışma modal state'leri
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<ScheduleConflict[]>([]);
  
  // Otomatik program modal state'i
  const [isAutoScheduleModalOpen, setIsAutoScheduleModalOpen] = useState(false);

  const handleDataLoaded = useCallback((data: ExcelData) => {
    if (data.errors.length > 0) {
      console.warn('Excel parsing errors:', data.errors);
    }
    setCourses(data.courses);
    setOpenAccordion('all');
  }, [setCourses]);

  // Zorla ekleme - çakışmaya rağmen dersi ekle
  const handleForceAdd = useCallback(() => {
    if (!pendingCourse) return;
    
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.id === pendingCourse.id 
          ? { ...c, isSelected: true, isEligible: false }
          : c
      )
    );
    
    setPendingCourse(null);
    setPendingConflicts([]);
  }, [pendingCourse, setCourses]);

  // Otomatik program önerisini uygula
  const handleApplySuggestion = useCallback((suggestedCourses: Course[]) => {
    const suggestedIds = new Set(suggestedCourses.map(c => c.id));
    
    setCourses(prevCourses => 
      prevCourses.map(c => {
        if (suggestedIds.has(c.id)) {
          return { ...c, isSelected: true, isEligible: false };
        } else if (c.isSelected) {
          return { ...c, isSelected: false, isEligible: true };
        }
        return c;
      })
    );
    
    setOpenAccordion('selected');
  }, [setCourses]);

  const handleToggleSelect = useCallback((course: Course) => {
    if (course.isSelected) {
      setCourses(prevCourses => 
        prevCourses.map(c => 
          c.id === course.id 
            ? { ...c, isSelected: false, isEligible: true }
            : c
        )
      );
      return;
    }
    
    if (course.isEligible) {
      const { canAdd, conflicts: courseConflicts } = canAddCourse(courses, course);
      
      if (canAdd) {
        setCourses(prevCourses => 
          prevCourses.map(c => 
            c.id === course.id 
              ? { ...c, isSelected: true, isEligible: false }
              : c
          )
        );
      } else {
        setPendingCourse(course);
        setPendingConflicts(courseConflicts);
        setIsConflictModalOpen(true);
      }
      return;
    }
    
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.id === course.id 
          ? { ...c, isEligible: true, isSelected: false }
          : c
      )
    );
  }, [courses, setCourses]);

  const handleMoveToEligible = useCallback((course: Course) => {
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.id === course.id 
          ? { ...c, isSelected: false, isEligible: c.isSelected ? true : false }
          : c
      )
    );
  }, [setCourses]);

  const handleTagChange = useCallback((course: Course, tag: CourseTag | string | undefined) => {
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.id === course.id 
          ? { ...c, tag }
          : c
      )
    );
  }, [setCourses]);

  // Özel etiket yönetimi
  const handleAddCustomTag = useCallback((tag: CustomTag) => {
    setCustomTags(prev => [...prev, tag]);
  }, [setCustomTags]);

  const handleDeleteCustomTag = useCallback((tagId: string) => {
    // Etiketi sil
    setCustomTags(prev => prev.filter(t => t.id !== tagId));
    // Bu etiketi kullanan derslerden kaldır
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.tag === tagId ? { ...c, tag: undefined } : c
      )
    );
  }, [setCustomTags, setCourses]);

  const handleUpdateCustomTag = useCallback((tag: CustomTag) => {
    setCustomTags(prev => prev.map(t => t.id === tag.id ? tag : t));
  }, [setCustomTags]);

  const handleClearData = useCallback(() => {
    if (confirm('Tüm veriler silinecek. Emin misiniz?')) {
      setCourses([]);
    }
  }, [setCourses]);

  const conflicts = findScheduleConflicts(courses);
  const conflictMessages = conflicts.map(conflict => ({
    courseId: conflict.course1.id,
    message: conflict.conflictReason
  }));

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF('schedule-viewer', 'marmara-ders-programi.pdf', courses);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF export işlemi başarısız oldu.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(courses, 'secilen-dersler.xlsx');
    } catch (error) {
      alert('Excel export işlemi başarısız oldu.');
    }
  };

  const handleExportText = () => {
    try {
      const summary = generateScheduleSummary(courses);
      downloadTextFile(summary, 'ders-programi.txt');
    } catch (error) {
      alert('Text export işlemi başarısız oldu.');
    }
  };

  const handleCloseModal = useCallback(() => {
    setIsConflictModalOpen(false);
    setPendingCourse(null);
    setPendingConflicts([]);
  }, []);

  const selectedCount = courses.filter(c => c.isSelected).length;
  const eligibleCount = courses.filter(c => c.isEligible && !c.isSelected).length;
  const eligibleCourses = courses.filter(c => c.isEligible && !c.isSelected);

  // Henüz veri yüklenmemişse
  if (courses.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Marmara Üniversitesi
            </h1>
            <p className="text-lg text-slate-600">Ders Programı Oluşturucu</p>
          </div>
          <ExcelUploader onDataLoaded={handleDataLoaded} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Modals */}
      <ConfirmModal
        isOpen={isConflictModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleForceAdd}
        course={pendingCourse}
        conflicts={pendingConflicts}
      />
      <AutoScheduleModal
        isOpen={isAutoScheduleModalOpen}
        onClose={() => setIsAutoScheduleModalOpen(false)}
        eligibleCourses={eligibleCourses}
        customTags={customTags}
        onApplySuggestion={handleApplySuggestion}
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 flex-shrink-0">
        <div className="px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">
                  Marmara Ders Programı
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {courses.length} ders yüklendi • {selectedCount} seçili
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {eligibleCount > 0 && (
                <button
                  onClick={() => setIsAutoScheduleModalOpen(true)}
                  className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm"
                >
                  <Wand2 className="h-4 w-4 mr-1.5" />
                  Otomatik
                </button>
              )}
              {selectedCount > 0 && (
                <>
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    title="PDF İndir"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden md:inline ml-1.5">PDF</span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700"
                    title="Excel İndir"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden md:inline ml-1.5">Excel</span>
                  </button>
                  <button
                    onClick={handleExportText}
                    className="hidden lg:inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg text-slate-700 bg-slate-200 hover:bg-slate-300"
                    title="Metin İndir"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                onClick={handleClearData}
                className="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50"
                title="Yeni Excel Yükle"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Split Panel */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sol Panel - Ders Listeleri */}
        <aside className="w-full lg:w-[400px] xl:w-[450px] bg-white border-r border-slate-200 flex flex-col overflow-hidden order-2 lg:order-1">
          {/* Accordion Panels */}
          <div className="flex-1 overflow-y-auto">
            {/* Tüm Dersler */}
            <AccordionPanel
              title="Tüm Dersler"
              count={courses.length}
              isOpen={openAccordion === 'all'}
              onToggle={() => setOpenAccordion(openAccordion === 'all' ? null : 'all')}
              icon={<List className="h-4 w-4" />}
            >
              <CourseList
                courses={courses}
                title=""
                status={CourseStatus.ALL}
                onToggleSelect={handleToggleSelect}
                onMoveToEligible={handleMoveToEligible}
                onTagChange={handleTagChange}
                customTags={customTags}
                conflicts={conflictMessages}
                compact
              />
            </AccordionPanel>

            {/* Uygun Dersler */}
            <AccordionPanel
              title="Uygun Dersler"
              count={eligibleCount}
              isOpen={openAccordion === 'eligible'}
              onToggle={() => setOpenAccordion(openAccordion === 'eligible' ? null : 'eligible')}
              icon={<BookOpen className="h-4 w-4" />}
              badge={
                eligibleCount > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAutoScheduleModalOpen(true);
                    }}
                    className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full hover:bg-violet-200"
                  >
                    ✨ Otomatik
                  </button>
                ) : null
              }
            >
              <CourseList
                courses={courses}
                title=""
                status={CourseStatus.ELIGIBLE}
                onToggleSelect={handleToggleSelect}
                onMoveToEligible={handleMoveToEligible}
                onTagChange={handleTagChange}
                customTags={customTags}
                conflicts={conflictMessages}
                compact
              />
            </AccordionPanel>

            {/* Seçilen Dersler */}
            <AccordionPanel
              title="Seçilen Dersler"
              count={selectedCount}
              isOpen={openAccordion === 'selected'}
              onToggle={() => setOpenAccordion(openAccordion === 'selected' ? null : 'selected')}
              icon={<CheckCircle className="h-4 w-4" />}
              badge={
                conflicts.length > 0 ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    {conflicts.length}
                  </span>
                ) : null
              }
            >
              <CourseList
                courses={courses}
                title=""
                status={CourseStatus.SELECTED}
                onToggleSelect={handleToggleSelect}
                onMoveToEligible={handleMoveToEligible}
                onTagChange={handleTagChange}
                customTags={customTags}
                conflicts={conflictMessages}
                compact
              />
            </AccordionPanel>

            {/* Özel Etiketler */}
            <AccordionPanel
              title="Özel Etiketler"
              count={customTags.length}
              isOpen={openAccordion === 'tags'}
              onToggle={() => setOpenAccordion(openAccordion === 'tags' ? null : 'tags')}
              icon={<Tag className="h-4 w-4" />}
            >
              <div className="p-3">
                <TagManager
                  customTags={customTags}
                  onAddTag={handleAddCustomTag}
                  onDeleteTag={handleDeleteCustomTag}
                  onUpdateTag={handleUpdateCustomTag}
                />
              </div>
            </AccordionPanel>
          </div>

          {/* Bottom Action - Mobile Only */}
          <div className="lg:hidden p-3 border-t border-slate-200 bg-slate-50">
            {eligibleCount > 0 && (
              <button
                onClick={() => setIsAutoScheduleModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                <Wand2 className="h-4 w-4" />
                Otomatik Program Oluştur
              </button>
            )}
          </div>
        </aside>

        {/* Sağ Panel - Haftalık Program */}
        <section className="flex-1 overflow-y-auto p-4 lg:p-6 order-1 lg:order-2 bg-slate-100">
          <div id="schedule-viewer">
            {selectedCount > 0 ? (
              <ScheduleViewer courses={courses} customTags={customTags} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center py-12 px-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-slate-200 rounded-2xl flex items-center justify-center">
                    <BookOpen className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Henüz Ders Seçilmedi
                  </h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Sol panelden dersleri "Uygun Dersler"e ekle, sonra "Seçilen Dersler"e taşı.
                    Veya otomatik program oluştur!
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App
