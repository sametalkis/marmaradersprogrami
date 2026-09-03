import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Calendar, Download, FileText, FileCode2, Wand2, BookOpen, CheckCircle, List,
  Tag, Sun, Moon, Search, Undo2, Redo2, PanelLeftClose, PanelLeftOpen, Trash2, ClipboardPaste
} from 'lucide-react';
import type { Course, ExcelData, ScheduleConflict, CustomTag, ScheduleScenario } from './types/Course';
import { CourseStatus, CourseTag } from './types/Course';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ExcelUploader } from './components/ExcelUploader';
import { CourseList } from './components/CourseList';
import { ScheduleViewer } from './components/ScheduleViewer';
import { ConfirmModal } from './components/ConfirmModal';
import { AutoScheduleModal } from './components/AutoScheduleModal';
import { TagManager } from './components/TagManager';
import { CommandPalette } from './components/CommandPalette';
import { BatchImportModal } from './components/BatchImportModal';
import { canAddCourse, findScheduleConflicts } from './utils/scheduleManager';
import { exportToPDF, exportToExcel, generateScheduleSummary, downloadTextFile } from './utils/exportUtils';
import './App.css';

function App() {
  const [courses, setCourses] = useLocalStorage<Course[]>('marmara-courses', []);
  const [customTags, setCustomTags] = useLocalStorage<CustomTag[]>('marmara-custom-tags', []);
  const [activeTab, setActiveTab] = useState<'all' | 'selected' | 'eligible' | 'tags'>('all');
  const [mobileTab, setMobileTab] = useState<'schedule' | 'all' | 'eligible' | 'selected' | 'tags'>('schedule');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hoveredCourse, setHoveredCourse] = useState<Course | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('marmara-theme', 'light');

  // Senaryo / Preset Deck Durumu
  const [scenarios, setScenarios] = useLocalStorage<ScheduleScenario[]>('marmara-scenarios', [
    { id: 'default', name: 'Taslak 1', courseIds: [], createdAt: Date.now() }
  ]);
  const [activeScenarioId, setActiveScenarioId] = useLocalStorage<string>('marmara-active-scenario', 'default');

  // Undo / Redo Geçmişi
  const [history, setHistory] = useState<Course[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Smooth lag-free theme switcher: keeps the toggle slider animated via GPU transform, while suppressing background reflow jank on the rest of the page
  const handleSetTheme = useCallback((newTheme: 'light' | 'dark') => {
    if (newTheme === theme) return;

    // Inject temporary transition suppressor style that spares the toggle button
    const css = document.createElement('style');
    css.appendChild(
      document.createTextNode(
        `body *:not([data-theme-anim], [data-theme-anim] *){-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`
      )
    );
    document.head.appendChild(css);

    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Remove suppressor on next animation frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (document.head.contains(css)) {
          document.head.removeChild(css);
        }
      });
    });
  }, [theme, setTheme]);

  // Initial sync on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);
  
  // Çakışma modal state'leri
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<ScheduleConflict[]>([]);
  
  // Otomatik program modal state'i
  const [isAutoScheduleModalOpen, setIsAutoScheduleModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);

  // Undo / Redo yönetimi
  const pushToHistory = useCallback((currentCourses: Course[]) => {
    setHistory(prev => {
      const updated = prev.slice(0, historyIndex + 1);
      return [...updated, currentCourses].slice(-30);
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex < 0 || history.length === 0) return;
    const prevCourses = history[historyIndex];
    if (!prevCourses) return;

    setCourses(prevCourses);
    setHistoryIndex(prev => prev - 1);
  }, [historyIndex, history, setCourses]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextCourses = history[historyIndex + 1];
    if (!nextCourses) return;

    setCourses(nextCourses);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex, history, setCourses]);

  // Global Klavye Kısayolları (⌘K, ⌘Z, ⌘⇧Z, /)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      if (!isInput && e.key === '/') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  // Eski bug'dan kalan: tüm derslerin otomatik isEligible: true olma durumunu tek seferlik temizle
  useEffect(() => {
    if (courses.length > 0 && courses.every(c => c.isEligible && !c.isSelected)) {
      setCourses(prev => prev.map(c => ({ ...c, isEligible: false })));
    }
  }, []);

  // Aktif senaryo derslerini senkronize et
  useEffect(() => {
    if (courses.length === 0) return;
    const selectedIds = courses.filter(c => c.isSelected).map(c => c.id);
    setScenarios(prev => prev.map(sc => sc.id === activeScenarioId ? { ...sc, courseIds: selectedIds } : sc));
  }, [courses, activeScenarioId, setScenarios]);

  // Senaryo Seç / Ekle / Sil
  const handleSelectScenario = useCallback((scenarioId: string) => {
    const target = scenarios.find(s => s.id === scenarioId);
    if (!target) return;

    pushToHistory(courses);
    setActiveScenarioId(scenarioId);
    const selectedSet = new Set(target.courseIds);
    setCourses(prev => prev.map(c => ({
      ...c,
      isSelected: selectedSet.has(c.id)
    })));
  }, [scenarios, courses, pushToHistory, setActiveScenarioId, setCourses]);

  const handleAddScenario = useCallback(() => {
    const newId = `scenario-${Date.now()}`;
    const newName = `Taslak ${scenarios.length + 1}`;
    const newScenario: ScheduleScenario = {
      id: newId,
      name: newName,
      courseIds: [],
      createdAt: Date.now()
    };
    pushToHistory(courses);
    setScenarios(prev => [...prev, newScenario]);
    setActiveScenarioId(newId);
    setCourses(prev => prev.map(c => ({ ...c, isSelected: false })));
  }, [scenarios.length, courses, pushToHistory, setScenarios, setActiveScenarioId, setCourses]);

  const handleDeleteScenario = useCallback((scenarioId: string) => {
    if (scenarios.length <= 1) return;
    const remaining = scenarios.filter(s => s.id !== scenarioId);
    setScenarios(remaining);
    if (activeScenarioId === scenarioId) {
      handleSelectScenario(remaining[0].id);
    }
  }, [scenarios, activeScenarioId, setScenarios, handleSelectScenario]);

  const handleRenameScenario = useCallback((scenarioId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setScenarios(prev => prev.map(sc => sc.id === scenarioId ? { ...sc, name: trimmed } : sc));
  }, [setScenarios]);

  const handleDataLoaded = useCallback((data: ExcelData) => {
    if (data.errors.length > 0) {
      console.warn('Excel parsing errors:', data.errors);
    }
    pushToHistory(courses);
    const initialCourses = data.courses.map(c => ({
      ...c,
      isSelected: false,
      isEligible: false
    }));
    setCourses(initialCourses);
    setActiveTab('all');
  }, [courses, pushToHistory, setCourses]);

  // Zorla ekleme - çakışmaya rağmen dersi ekle
  const handleForceAdd = useCallback(() => {
    if (!pendingCourse) return;
    
    pushToHistory(courses);
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.id === pendingCourse.id 
          ? { ...c, isSelected: true, isEligible: true }
          : c
      )
    );
    
    setPendingCourse(null);
    setPendingConflicts([]);
  }, [pendingCourse, courses, pushToHistory, setCourses]);

  // Otomatik program önerisini uygula veya doğrudan yeni/mevcut taslağa aktar
  const handleApplySuggestion = useCallback((suggestedCourses: Course[], targetScenarioId?: string, newScenarioName?: string) => {
    const suggestedIds = new Set(suggestedCourses.map(c => c.id));
    pushToHistory(courses);

    if (newScenarioName) {
      // 1. Yeni bir taslak oluştur ve doğrudan ona aktar
      const newId = `scenario-${Date.now()}`;
      const newScenario: ScheduleScenario = {
        id: newId,
        name: newScenarioName,
        courseIds: Array.from(suggestedIds),
        createdAt: Date.now()
      };
      setScenarios(prev => [...prev, newScenario]);
      setActiveScenarioId(newId);
    } else if (targetScenarioId && targetScenarioId !== activeScenarioId) {
      // 2. Belirtilen başka bir mevcut taslağa aktar
      setScenarios(prev =>
        prev.map(sc => sc.id === targetScenarioId ? { ...sc, courseIds: Array.from(suggestedIds) } : sc)
      );
      setActiveScenarioId(targetScenarioId);
    } else {
      // 3. Mevcut aktif taslağa aktar
      setScenarios(prev =>
        prev.map(sc => sc.id === activeScenarioId ? { ...sc, courseIds: Array.from(suggestedIds) } : sc)
      );
    }

    // Seçili dersleri güncelle (Uygunluk havuzu ASLA bozulmaz!)
    setCourses(prevCourses => 
      prevCourses.map(c => {
        if (suggestedIds.has(c.id)) {
          return { ...c, isSelected: true, isEligible: true };
        } else if (c.isSelected) {
          return { ...c, isSelected: false };
        }
        return c;
      })
    );
    
    // Masaüstünde seçilenlere, mobilde ise takvime geç
    setActiveTab('selected');
    setMobileTab('schedule');
  }, [courses, activeScenarioId, pushToHistory, setScenarios, setActiveScenarioId, setCourses, setActiveTab, setMobileTab]);

  const handleToggleSelect = useCallback((course: Course) => {
    pushToHistory(courses);
    if (course.isSelected) {
      // Programdan kaldır (Uygun havuzunda kalmaya devam eder)
      setCourses(prevCourses => 
        prevCourses.map(c => 
          c.id === course.id 
            ? { ...c, isSelected: false }
            : c
        )
      );
      return;
    }
    
    // Programa ekle (Çakışma kontrolü yap)
    const { canAdd, conflicts: courseConflicts } = canAddCourse(courses, course);
    
    if (canAdd) {
      setCourses(prevCourses => 
        prevCourses.map(c => 
          c.id === course.id 
            ? { ...c, isSelected: true, isEligible: true }
            : c
        )
      );
    } else {
      setPendingCourse(course);
      setPendingConflicts(courseConflicts);
      setIsConflictModalOpen(true);
    }
  }, [courses, pushToHistory, setCourses]);

  const handleMoveToEligible = useCallback((course: Course) => {
    pushToHistory(courses);
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.id === course.id 
          ? { 
              ...c, 
              isEligible: !c.isEligible, 
              isSelected: c.isEligible ? false : c.isSelected 
            }
          : c
      )
    );
  }, [courses, pushToHistory, setCourses]);

  const handleBatchAddToEligible = useCallback((courseIds: string[], assignTag?: CourseTag | string) => {
    if (courseIds.length === 0) return;
    pushToHistory(courses);
    const idSet = new Set(courseIds);
    setCourses(prevCourses =>
      prevCourses.map(c => {
        if (idSet.has(c.id)) {
          return {
            ...c,
            isEligible: true,
            ...(assignTag !== undefined ? { tag: assignTag as CourseTag } : {})
          };
        }
        return c;
      })
    );
  }, [courses, pushToHistory, setCourses]);

  const handleTagChange = useCallback((course: Course, tag: CourseTag | string | undefined) => {
    pushToHistory(courses);
    setCourses(prevCourses => 
      prevCourses.map(c => 
        c.id === course.id 
          ? { ...c, tag }
          : c
      )
    );
  }, [courses, pushToHistory, setCourses]);

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
    setIsClearConfirmOpen(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    // 1. Tüm state'leri fabrika ayarlarına sıfırla
    setCourses([]);
    setCustomTags([]);
    setScenarios([
      { id: 'default', name: 'Taslak 1', courseIds: [], createdAt: Date.now() }
    ]);
    setActiveScenarioId('default');
    setHistory([]);
    setHistoryIndex(-1);
    setHoveredCourse(null);
    setPendingCourse(null);
    setPendingConflicts([]);
    setIsClearConfirmOpen(false);

    // 2. LocalStorage'daki tüm marmara verilerini kalıcı olarak temizle
    try {
      window.localStorage.removeItem('marmara-courses');
      window.localStorage.removeItem('marmara-custom-tags');
      window.localStorage.removeItem('marmara-scenarios');
      window.localStorage.removeItem('marmara-active-scenario');
    } catch (e) {
      console.error('LocalStorage temizleme hatası:', e);
    }
  }, [setCourses, setCustomTags, setScenarios, setActiveScenarioId]);

  const conflicts = findScheduleConflicts(courses);
  const conflictMessages = useMemo(() => {
    const list: { courseId: string; message: string }[] = [];
    
    // 1. Seçili dersler arasındaki mevcut çakışmalar (her iki ders için de)
    conflicts.forEach(c => {
      list.push({ courseId: c.course1.id, message: `${c.course2.courseCode} ile çakışıyor: ${c.conflictReason}` });
      list.push({ courseId: c.course2.id, message: `${c.course1.courseCode} ile çakışıyor: ${c.conflictReason}` });
    });

    // 2. Seçili olmayan derslerin seçili olanlarla potansiyel çakışması
    const selected = courses.filter(c => c.isSelected);
    if (selected.length > 0) {
      courses.filter(c => !c.isSelected).forEach(unselected => {
        const { canAdd, conflicts: prospective } = canAddCourse(courses, unselected);
        if (!canAdd && prospective.length > 0) {
          const other = prospective[0].course1.id === unselected.id ? prospective[0].course2 : prospective[0].course1;
          list.push({
            courseId: unselected.id,
            message: `${other.courseCode} ile çakışır (${prospective[0].conflictReason})`
          });
        }
      });
    }

    return list;
  }, [conflicts, courses]);

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
  const eligibleCourses = courses.filter(c => c.isEligible);
  const eligibleCount = eligibleCourses.length;

  if (courses.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 relative flex items-center justify-center p-4 overflow-hidden transition-colors duration-300">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-violet-600/5 dark:bg-violet-600/15 rounded-full blur-[110px] pointer-events-none" />

        <div className="max-w-xl w-full relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
              <BookOpen className="w-3.5 h-3.5" />
              Marmara Üniversitesi
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
              Ders Programı Oluşturucu
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base max-w-md mx-auto">
              Excel listenizi yükleyin, haftalık ders programınız saniyeler içinde hazır olsun.
            </p>
          </div>
          <ExcelUploader onDataLoaded={handleDataLoaded} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col transition-colors duration-300">
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
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onApplyToScenario={handleApplySuggestion}
      />

      {/* Clear Data Confirmation Modal */}
      {isClearConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="clear-modal-title"
          onClick={() => setIsClearConfirmOpen(false)}
        >
          <div 
            className="relative bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-zinc-800/80 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center border border-red-200 dark:border-red-900/50 shadow-inner">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 id="clear-modal-title" className="text-lg font-extrabold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">
                Tüm Verileri Sıfırla
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Yüklenen Excel listesi, oluşturulan tüm taslaklar, etiketler ve takvim seçimleri kalıcı olarak silinecektir.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-900/80 border-t border-slate-200 dark:border-zinc-800/80 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:scale-98 rounded-xl transition-all shadow-md shadow-red-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Her Şeyi Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-black shadow-sm border-b border-slate-200 dark:border-zinc-900 flex-shrink-0 transition-colors pt-[env(safe-area-inset-top,0px)]">
        <div className="px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 sm:p-2 bg-slate-900 dark:bg-zinc-900 text-white rounded-lg border border-transparent dark:border-zinc-800 flex-shrink-0">
                <BookOpen className="h-4 sm:h-5 w-4 sm:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  Marmara Ders Programı
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:block font-medium truncate">
                  {courses.length} ders yüklendi • {selectedCount} seçili
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Spotlight Command Palette Trigger (Desktop/Tablet) */}
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 transition-colors cursor-pointer shadow-2xs"
                title="Hızlı Ders Ara (⌘K veya /)"
              >
                <Search className="h-3.5 w-3.5 text-indigo-500" />
                <span className="font-bold">Ders Ara</span>
                <kbd className="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] leading-none font-mono bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-slate-500 dark:text-zinc-400">
                  ⌘K
                </kbd>
              </button>

              {/* Undo / Redo Buttons */}
              <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex < 0}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Geri Al (⌘Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="İleri Al (⌘⇧Z)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sidebar Collapse Toggle (Desktop) */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 border border-slate-200 dark:border-zinc-800 transition-colors cursor-pointer"
                title={isSidebarCollapsed ? "Ders Panelini Aç" : "Ders Panelini Gizle (Geniş Takvim)"}
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>

              {eligibleCount > 0 && (
                <button
                  onClick={() => setIsAutoScheduleModalOpen(true)}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-white bg-slate-900 dark:bg-zinc-800 border border-transparent hover:bg-slate-800 dark:hover:bg-zinc-700 transition-colors shadow-sm cursor-pointer active:scale-95"
                  title="Otomatik Program Sihirbazı"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Sihirbaz</span>
                </button>
              )}

              {selectedCount > 0 && (
                <div className="hidden md:flex items-center gap-1.5">
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl text-white bg-blue-600 border border-transparent hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                    title="PDF İndir"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl text-white bg-emerald-600 border border-transparent hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer shadow-xs active:scale-95"
                    title="Excel İndir"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={handleExportText}
                    className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl text-slate-700 dark:text-zinc-300 bg-slate-200/80 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 border border-transparent cursor-pointer active:scale-95"
                    title="Metin Olarak İndir"
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    <span>Metin</span>
                  </button>
                </div>
              )}

              {/* Icon-Only Sun/Moon OLED Theme Toggle Switch */}
              <div 
                data-html2canvas-ignore="true" 
                data-theme-anim="true" 
                className="relative flex items-center bg-slate-200/90 dark:bg-zinc-900 p-[2px] rounded-full border border-slate-300 dark:border-zinc-800 shadow-inner select-none w-[56px] h-[30px] flex-shrink-0" 
                role="radiogroup" 
                aria-label="Tema seçimi"
              >
                <div
                  data-theme-anim="true"
                  className="absolute top-[2px] left-[2px] w-[26px] h-[26px] bg-white dark:bg-zinc-800 rounded-full shadow pointer-events-none transition-transform duration-200 ease-out"
                  style={{
                    transform: theme === 'dark' ? 'translateX(26px)' : 'translateX(0px)',
                  }}
                />
                <button
                  onClick={() => handleSetTheme('light')}
                  className={`relative z-10 w-[26px] h-[26px] flex items-center justify-center rounded-full outline-none transition-colors duration-200 cursor-pointer ${
                    theme === 'light' ? 'text-amber-500 font-bold' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                  }`}
                  title="Aydınlık Tema"
                  role="radio"
                  aria-checked={theme === 'light'}
                  aria-label="Aydınlık tema"
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleSetTheme('dark')}
                  className={`relative z-10 w-[26px] h-[26px] flex items-center justify-center rounded-full outline-none transition-colors duration-200 cursor-pointer ${
                    theme === 'dark' ? 'text-indigo-400 font-bold' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                  }`}
                  title="OLED Karanlık Tema"
                  role="radio"
                  aria-checked={theme === 'dark'}
                  aria-label="Karanlık tema"
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Toplu Ders Ekle (Akıllı Yapıştır) */}
              <button
                onClick={() => setIsBatchImportOpen(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 border border-indigo-200/80 dark:border-indigo-800/60 transition-all cursor-pointer shadow-2xs flex-shrink-0 active:scale-95"
                title="Metin yapıştırarak ders kodlarını topluca uyguna ekle"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Toplu Ekle</span>
              </button>

              {/* Sıfırla Butonu */}
              <button
                onClick={handleClearData}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl text-red-600 dark:text-red-400 bg-red-50/70 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-200/80 dark:border-red-900/60 transition-all cursor-pointer shadow-2xs flex-shrink-0"
                title="Tüm verileri temizle ve yeni Excel yükle"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sıfırla</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Split Panel */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Sol Panel - Workspace Ders Listesi (Desktop) */}
        {!isSidebarCollapsed && (
          <aside className="hidden lg:flex w-[410px] xl:w-[460px] h-full min-h-0 bg-white dark:bg-black border-r border-slate-200 dark:border-zinc-900 flex-col overflow-hidden transition-all duration-200">
            {/* Segmented Tab Bar */}
            <div className="p-3 border-b border-slate-200 dark:border-zinc-900 bg-slate-50/70 dark:bg-zinc-950/70 flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-zinc-800'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900/50'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Tümü</span>
                <span className="inline-flex items-center justify-center min-w-[18px] text-[10px] leading-none px-1.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 font-mono">
                  {courses.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('eligible')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'eligible'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-zinc-800'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900/50'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Uygun</span>
                <span className={`inline-flex items-center justify-center min-w-[18px] text-[10px] leading-none px-1.5 py-1 rounded-full font-mono ${
                  eligibleCount > 0 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold' : 'bg-slate-100 dark:bg-zinc-800'
                }`}>
                  {eligibleCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('selected')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
                  activeTab === 'selected'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-zinc-800'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900/50'
                }`}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Seçilen</span>
                <span className={`inline-flex items-center justify-center min-w-[18px] text-[10px] leading-none px-1.5 py-1 rounded-full font-mono ${
                  selectedCount > 0 ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold' : 'bg-slate-100 dark:bg-zinc-800'
                }`}>
                  {selectedCount}
                </span>
                {conflicts.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-1.5 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('tags')}
                className={`flex items-center justify-center p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'tags'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-zinc-800'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900/50'
                }`}
                title="Özel Etiket Yönetimi"
              >
                <Tag className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Tab İçeriği */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scroll-smooth">
              {activeTab === 'all' && (
                <CourseList
                  courses={courses}
                  title=""
                  status={CourseStatus.ALL}
                  onToggleSelect={handleToggleSelect}
                  onMoveToEligible={handleMoveToEligible}
                  onTagChange={handleTagChange}
                  customTags={customTags}
                  conflicts={conflictMessages}
                  onHoverCourse={setHoveredCourse}
                  onLeaveCourse={() => setHoveredCourse(null)}
                  compact
                />
              )}

              {activeTab === 'eligible' && (
                <div className="space-y-3">
                  {eligibleCount > 0 ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50">
                      <div>
                        <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                          {eligibleCount} ders uygun havuzunda
                        </p>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                          Otomatik sihirbaz ile en iyi kombinasyonu bulun
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setIsBatchImportOpen(true)}
                          className="p-1.5 text-xs font-bold bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-2xs transition-all cursor-pointer"
                          title="Metinden Yeni Dersler Ekle"
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setIsAutoScheduleModalOpen(true)}
                          className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          Sihirbaz
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                      <BookOpen className="h-8 w-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Henüz Uygun Ders Eklenmedi</p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 max-w-[240px] mx-auto">
                        <strong>Tümü</strong> sekmesinden almayı düşündüğün derslerin yanındaki <strong>+</strong> butonuna basarak bu havuza toplayabilirsin.
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <button
                          onClick={() => setActiveTab('all')}
                          className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          Tüm Dersler →
                        </button>
                        <button
                          onClick={() => setIsBatchImportOpen(true)}
                          className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ClipboardPaste className="h-3 w-3" />
                          Metinden Toplu Ekle
                        </button>
                      </div>
                    </div>
                  )}

                  <CourseList
                    courses={courses}
                    title=""
                    status={CourseStatus.ELIGIBLE}
                    onToggleSelect={handleToggleSelect}
                    onMoveToEligible={handleMoveToEligible}
                    onTagChange={handleTagChange}
                    customTags={customTags}
                    conflicts={conflictMessages}
                    onHoverCourse={setHoveredCourse}
                    onLeaveCourse={() => setHoveredCourse(null)}
                    compact
                  />
                </div>
              )}

              {activeTab === 'selected' && (
                <CourseList
                  courses={courses}
                  title=""
                  status={CourseStatus.SELECTED}
                  onToggleSelect={handleToggleSelect}
                  onMoveToEligible={handleMoveToEligible}
                  onTagChange={handleTagChange}
                  customTags={customTags}
                  conflicts={conflictMessages}
                  onHoverCourse={setHoveredCourse}
                  onLeaveCourse={() => setHoveredCourse(null)}
                  compact
                />
              )}

              {activeTab === 'tags' && (
                <TagManager
                  customTags={customTags}
                  onAddTag={handleAddCustomTag}
                  onDeleteTag={handleDeleteCustomTag}
                  onUpdateTag={handleUpdateCustomTag}
                />
              )}
            </div>
          </aside>
        )}

        {/* Sağ Panel - Haftalık Program (Desktop Canvas) */}
        <section className="hidden lg:flex flex-1 min-h-0 h-full overflow-y-auto p-4 lg:p-6 bg-slate-100 dark:bg-black transition-colors duration-300 pb-6">
          <div id="schedule-viewer" className="w-full">
            <ScheduleViewer
              courses={courses}
              customTags={customTags}
              hoveredCourse={hoveredCourse}
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              onSelectScenario={handleSelectScenario}
              onAddScenario={handleAddScenario}
              onDeleteScenario={handleDeleteScenario}
              onRenameScenario={handleRenameScenario}
              onToggleCourseSelect={handleToggleSelect}
            />
          </div>
        </section>

        {/* Mobil Tam Sayfa Görünümleri (Drawer ve mükerrer başlıklar kaldırıldı) */}
        <div className="lg:hidden flex-1 min-h-0 flex flex-col overflow-hidden relative">
          {mobileTab === 'schedule' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 pb-24 bg-slate-100 dark:bg-black space-y-2.5">
              {/* Mobil Hızlı Dışa Aktarma ve Bilgi Çubuğu */}
              <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-850 shadow-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-black text-slate-800 dark:text-zinc-100 truncate">
                    {selectedCount} Ders Seçili
                  </span>
                  {selectedCount > 0 && (
                    <span className="inline-flex items-center justify-center text-[10px] leading-none px-1.5 py-1 rounded-full font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black border border-indigo-200/60 dark:border-indigo-800/50 flex-shrink-0">
                      {courses.filter(c => c.isSelected).reduce((sum, c) => sum + (c.credits || 0), 0)} AKTS
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selectedCount > 0 && (
                    <>
                      <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95 transition-all"
                        title="PDF Olarak İndir"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </button>
                      <button
                        onClick={handleExportExcel}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer shadow-xs active:scale-95 transition-all"
                        title="Excel Olarak İndir"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Excel</span>
                      </button>
                    </>
                  )}
                  {eligibleCount > 0 && (
                    <button
                      onClick={() => setIsAutoScheduleModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl text-white bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 active:bg-slate-700 cursor-pointer shadow-xs active:scale-95 transition-all"
                      title="Otomatik Sihirbaz"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>Sihirbaz</span>
                    </button>
                  )}
                </div>
              </div>

              <div id="schedule-viewer">
                <ScheduleViewer
                  courses={courses}
                  customTags={customTags}
                  hoveredCourse={hoveredCourse}
                  scenarios={scenarios}
                  activeScenarioId={activeScenarioId}
                  onSelectScenario={handleSelectScenario}
                  onAddScenario={handleAddScenario}
                  onDeleteScenario={handleDeleteScenario}
                  onRenameScenario={handleRenameScenario}
                  onToggleCourseSelect={handleToggleSelect}
                />
              </div>
            </div>
          )}

          {mobileTab === 'all' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24 bg-white dark:bg-black">
              <CourseList
                courses={courses}
                title=""
                status={CourseStatus.ALL}
                onToggleSelect={handleToggleSelect}
                onMoveToEligible={handleMoveToEligible}
                onTagChange={handleTagChange}
                customTags={customTags}
                conflicts={conflictMessages}
                onHoverCourse={setHoveredCourse}
                onLeaveCourse={() => setHoveredCourse(null)}
                compact
              />
            </div>
          )}

          {mobileTab === 'eligible' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24 bg-white dark:bg-black space-y-3">
              {eligibleCount > 0 ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50">
                  <div>
                    <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      {eligibleCount} ders uygun havuzunda
                    </p>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                      Otomatik sihirbaz ile en iyi kombinasyonu bulun
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsBatchImportOpen(true)}
                      className="p-1.5 text-xs font-bold bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-2xs transition-all cursor-pointer"
                      title="Metinden Yeni Dersler Ekle"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setIsAutoScheduleModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      Sihirbaz
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                  <BookOpen className="h-8 w-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Henüz Uygun Ders Eklenmedi</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 max-w-[240px] mx-auto">
                    <strong>Tümü</strong> sekmesinden almayı düşündüğün derslerin yanındaki <strong>+</strong> butonuna basarak bu havuza toplayabilirsin.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={() => setMobileTab('all')}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      Tüm Dersler →
                    </button>
                    <button
                      onClick={() => setIsBatchImportOpen(true)}
                      className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ClipboardPaste className="h-3 w-3" />
                      Metinden Toplu Ekle
                    </button>
                  </div>
                </div>
              )}

              <CourseList
                courses={courses}
                title=""
                status={CourseStatus.ELIGIBLE}
                onToggleSelect={handleToggleSelect}
                onMoveToEligible={handleMoveToEligible}
                onTagChange={handleTagChange}
                customTags={customTags}
                conflicts={conflictMessages}
                onHoverCourse={setHoveredCourse}
                onLeaveCourse={() => setHoveredCourse(null)}
                compact
              />
            </div>
          )}

          {mobileTab === 'selected' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24 bg-white dark:bg-black">
              <CourseList
                courses={courses}
                title=""
                status={CourseStatus.SELECTED}
                onToggleSelect={handleToggleSelect}
                onMoveToEligible={handleMoveToEligible}
                onTagChange={handleTagChange}
                customTags={customTags}
                conflicts={conflictMessages}
                onHoverCourse={setHoveredCourse}
                onLeaveCourse={() => setHoveredCourse(null)}
                compact
              />
            </div>
          )}

          {mobileTab === 'tags' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24 bg-white dark:bg-black">
              <TagManager
                customTags={customTags}
                onAddTag={handleAddCustomTag}
                onDeleteTag={handleDeleteCustomTag}
                onUpdateTag={handleUpdateCustomTag}
              />
            </div>
          )}
        </div>

        {/* Mobilde Altta Yüzen Minimalist Kapsül Gezinme Çubuğu (Görseldeki Tasarım) */}
        <nav 
          aria-label="Mobil Sayfa Gezinme"
          className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#16171b]/95 dark:bg-[#121316]/95 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_16px_45px_rgba(0,0,0,0.7)] p-1.5 flex items-center gap-1 sm:gap-2 select-none"
        >
          {/* 1. Program */}
          <button
            onClick={() => setMobileTab('schedule')}
            className={`transition-all duration-200 cursor-pointer flex items-center justify-center ${
              mobileTab === 'schedule'
                ? 'w-16 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 active:scale-95'
                : 'w-11 h-10 rounded-full text-zinc-500 hover:text-zinc-300 active:scale-90'
            }`}
            title="Ders Programı Takvimi"
            aria-label="Ders Programı"
          >
            <Calendar className={`h-5 w-5 ${mobileTab === 'schedule' ? 'stroke-[2.5]' : 'stroke-[1.9]'}`} />
          </button>

          {/* 2. Tüm Dersler */}
          <button
            onClick={() => setMobileTab('all')}
            className={`transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
              mobileTab === 'all'
                ? 'w-16 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 active:scale-95'
                : 'w-11 h-10 rounded-full text-zinc-500 hover:text-zinc-300 active:scale-90'
            }`}
            title="Tüm Dersler"
            aria-label="Tüm Dersler"
          >
            <List className={`h-5 w-5 ${mobileTab === 'all' ? 'stroke-[2.5]' : 'stroke-[1.9]'}`} />
            {mobileTab !== 'all' && courses.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 absolute top-2 right-2.5" />
            )}
          </button>

          {/* 3. Uygun Dersler */}
          <button
            onClick={() => setMobileTab('eligible')}
            className={`transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
              mobileTab === 'eligible'
                ? 'w-16 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 active:scale-95'
                : 'w-11 h-10 rounded-full text-zinc-500 hover:text-zinc-300 active:scale-90'
            }`}
            title="Uygun Dersler"
            aria-label="Uygun Dersler"
          >
            <BookOpen className={`h-5 w-5 ${mobileTab === 'eligible' ? 'stroke-[2.5]' : 'stroke-[1.9]'}`} />
            {mobileTab !== 'eligible' && eligibleCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-2 right-2.5 animate-pulse" />
            )}
          </button>

          {/* 4. Seçilen Dersler */}
          <button
            onClick={() => setMobileTab('selected')}
            className={`transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
              mobileTab === 'selected'
                ? 'w-16 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 active:scale-95'
                : 'w-11 h-10 rounded-full text-zinc-500 hover:text-zinc-300 active:scale-90'
            }`}
            title="Seçilen Dersler"
            aria-label="Seçilen Dersler"
          >
            <CheckCircle className={`h-5 w-5 ${mobileTab === 'selected' ? 'stroke-[2.5]' : 'stroke-[1.9]'}`} />
            {mobileTab !== 'selected' && (
              conflicts.length > 0 ? (
                <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-2 animate-pulse" />
              ) : selectedCount > 0 ? (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 absolute top-2 right-2.5" />
              ) : null
            )}
          </button>

          {/* 5. Etiketler */}
          <button
            onClick={() => setMobileTab('tags')}
            className={`transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
              mobileTab === 'tags'
                ? 'w-16 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 active:scale-95'
                : 'w-11 h-10 rounded-full text-zinc-500 hover:text-zinc-300 active:scale-90'
            }`}
            title="Etiketler"
            aria-label="Etiketler"
          >
            <Tag className={`h-5 w-5 ${mobileTab === 'tags' ? 'stroke-[2.5]' : 'stroke-[1.9]'}`} />
          </button>
        </nav>
      </main>

      {/* Spotlight Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        courses={courses}
        onToggleSelect={handleToggleSelect}
        onMoveToEligible={handleMoveToEligible}
        onTagChange={handleTagChange}
        customTags={customTags}
        conflicts={conflictMessages}
      />

      {/* Metinden Toplu Ders Ekleme Modalı */}
      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        courses={courses}
        onBatchAddToEligible={handleBatchAddToEligible}
        customTags={customTags}
      />
    </div>
  );
}

export default App;
