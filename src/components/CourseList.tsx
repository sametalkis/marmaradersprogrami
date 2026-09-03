import { useState, useMemo } from 'react';
import { Search, BookOpen, Tag } from 'lucide-react';
import type { Course, CustomTag } from '../types/Course';
import { CourseStatus, CourseTag, TAG_LABELS, TAG_COLOR_PALETTE } from '../types/Course';
import { CourseCard } from './CourseCard';

interface CourseListProps {
  courses: Course[];
  title: string;
  status: CourseStatus;
  onToggleSelect?: (course: Course) => void;
  onMoveToEligible?: (course: Course) => void;
  onTagChange?: (course: Course, tag: CourseTag | string | undefined) => void;
  customTags?: CustomTag[];
  showActions?: boolean;
  conflicts?: { courseId: string; message: string }[];
  compact?: boolean;
  onHoverCourse?: (course: Course) => void;
  onLeaveCourse?: () => void;
}

export const CourseList = ({
  courses,
  status,
  onToggleSelect,
  onMoveToEligible,
  onTagChange,
  customTags = [],
  showActions = true,
  conflicts = [],
  onHoverCourse,
  onLeaveCourse
}: CourseListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'instructor'>('code');
  const [filterTag, setFilterTag] = useState<CourseTag | string | 'all' | 'untagged'>('all');

  const getCustomTagColor = (colorId: string) => {
    return TAG_COLOR_PALETTE.find(c => c.id === colorId);
  };

  // Filtreleme ve sıralama
  const filteredAndSortedCourses = useMemo(() => {
    let filtered = courses;

    // Status'a göre filtrele
    switch (status) {
      case CourseStatus.ELIGIBLE:
        filtered = courses.filter(course => course.isEligible);
        break;
      case CourseStatus.SELECTED:
        filtered = courses.filter(course => course.isSelected);
        break;
      case CourseStatus.ALL:
      default:
        // Tüm dersler
        break;
    }

    // Arama terimine göre filtrele
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Etikete göre filtrele
    if (filterTag === 'untagged') {
      filtered = filtered.filter(course => !course.tag);
    } else if (filterTag !== 'all') {
      filtered = filtered.filter(course => course.tag === filterTag);
    }

    // Sırala
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.courseName.localeCompare(b.courseName, 'tr');
        case 'instructor':
          return a.instructor.localeCompare(b.instructor, 'tr');
        case 'code':
        default:
          return a.courseCode.localeCompare(b.courseCode);
      }
    });

    return filtered;
  }, [courses, status, searchTerm, sortBy, filterTag]);

  // Çakışma kontrolü
  const getConflictForCourse = (courseId: string) => {
    return conflicts.find(conflict => conflict.courseId === courseId);
  };

  return (
      <div className="bg-white dark:bg-black">
        {/* Kompakt Filtreler */}
        <div className="px-2 py-2 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/90 dark:bg-black/95 backdrop-blur-md sticky top-0 z-10 space-y-2">
          {/* Arama ve Sıralama */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'code' | 'name' | 'instructor')}
              className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="code">Kod</option>
              <option value="name">Ad</option>
              <option value="instructor">Hoca</option>
            </select>
          </div>
          
          {/* Etiket Filtreleri */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterTag('all')}
              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                filterTag === 'all' 
                  ? 'bg-slate-700 dark:bg-zinc-200 text-white dark:text-zinc-900 font-bold' 
                  : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800'
              }`}
            >
              Tümü
            </button>
            {Object.values(CourseTag).map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  filterTag === tag 
                    ? tag === CourseTag.MANDATORY ? 'bg-red-500 text-white' :
                      tag === CourseTag.ELECTIVE ? 'bg-blue-500 text-white' :
                      tag === CourseTag.IMPORTANT ? 'bg-amber-500 text-white' :
                      'bg-slate-500 text-white'
                    : tag === CourseTag.MANDATORY ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                      tag === CourseTag.ELECTIVE ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                      tag === CourseTag.IMPORTANT ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                      'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
            {/* Özel Etiketler */}
            {customTags.map(tag => {
              const colorStyle = getCustomTagColor(tag.color);
              const isActive = filterTag === tag.id;
              return (
                <button
                  key={tag.id}
                  onClick={() => setFilterTag(isActive ? 'all' : tag.id)}
                  className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    isActive 
                      ? `${colorStyle?.bg || 'bg-slate-500'} text-white`
                      : `${colorStyle?.light || 'bg-slate-100'} ${colorStyle?.text || 'text-slate-700'} hover:opacity-80`
                  }`}
                >
                  {tag.emoji} {tag.name}
                </button>
              );
            })}
            <button
              onClick={() => setFilterTag(filterTag === 'untagged' ? 'all' : 'untagged')}
              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                filterTag === 'untagged' 
                  ? 'bg-slate-600 text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Tag className="h-3 w-3 inline mr-0.5" />
              Etiketsiz
            </button>
          </div>
        </div>

        {/* Kompakt Ders Listesi */}
        <div className="p-2">
          {filteredAndSortedCourses.length === 0 ? (
            <div className="text-center py-6">
              <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">
                {searchTerm ? 'Sonuç yok' : 'Ders yok'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAndSortedCourses.map((course) => {
                const conflict = getConflictForCourse(course.id);
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onToggleSelect={onToggleSelect}
                    onMoveToEligible={onMoveToEligible}
                    onTagChange={onTagChange}
                    customTags={customTags}
                    showActions={showActions}
                    hasConflict={!!conflict}
                    conflictMessage={conflict?.message}
                    onHover={onHoverCourse}
                    onLeave={onLeaveCourse}
                    compact
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
};
