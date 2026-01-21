import React, { useState, useMemo } from 'react';
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
}

export const CourseList: React.FC<CourseListProps> = ({
  courses,
  title,
  status,
  onToggleSelect,
  onMoveToEligible,
  onTagChange,
  customTags = [],
  showActions = true,
  conflicts = [],
  compact = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'instructor'>('code');
  const [filterTag, setFilterTag] = useState<CourseTag | string | 'all' | 'untagged'>('all');

  // Özel etiket bilgisini al
  const getCustomTagInfo = (tagId: string) => {
    return customTags.find(t => t.id === tagId);
  };

  const getCustomTagColor = (colorId: string) => {
    return TAG_COLOR_PALETTE.find(c => c.id === colorId);
  };

  // Filtreleme ve sıralama
  const filteredAndSortedCourses = useMemo(() => {
    let filtered = courses;

    // Status'a göre filtrele
    switch (status) {
      case CourseStatus.ELIGIBLE:
        filtered = courses.filter(course => course.isEligible && !course.isSelected);
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

  // Kompakt mod
  if (compact) {
    return (
      <div className="bg-white">
        {/* Kompakt Filtreler */}
        <div className="px-2 py-2 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 space-y-2">
          {/* Arama ve Sıralama */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'code' | 'name' | 'instructor')}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  ? 'bg-slate-700 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                    compact
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal mod (eski görünüm)
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Başlık */}
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BookOpen className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <span className="ml-2 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm">
                {filteredAndSortedCourses.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Arama */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Ders kodu, adı veya öğretim elemanı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Sıralama */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'code' | 'name' | 'instructor')}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="code">Ders Kodu</option>
              <option value="name">Ders Adı</option>
              <option value="instructor">Öğretim Elemanı</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ders Listesi */}
      <div className="p-6">
        {filteredAndSortedCourses.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Arama kriterlerine uygun ders bulunamadı.' : 'Henüz ders bulunmuyor.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
