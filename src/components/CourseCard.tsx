import React, { useState } from 'react';
import { Clock, User, MapPin, Plus, Minus, AlertTriangle, Tag, ChevronDown } from 'lucide-react';
import type { Course, CustomTag } from '../types/Course';
import { CourseTag, TAG_COLORS, TAG_LABELS, TAG_COLOR_PALETTE } from '../types/Course';
import { parseSchedule } from '../utils/excelParser';

interface CourseCardProps {
  course: Course;
  onToggleSelect?: (course: Course) => void;
  onMoveToEligible?: (course: Course) => void;
  onTagChange?: (course: Course, tag: CourseTag | string | undefined) => void;
  customTags?: CustomTag[];
  showActions?: boolean;
  hasConflict?: boolean;
  conflictMessage?: string;
  compact?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onToggleSelect,
  onMoveToEligible,
  onTagChange,
  customTags = [],
  showActions = true,
  hasConflict = false,
  conflictMessage,
  compact = false
}) => {
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const schedules = course.schedules || [parseSchedule(course.dayTimeLocation)].filter(Boolean);
  const firstSchedule = schedules[0];

  // Etiket bilgisini al (sabit veya özel)
  const isBuiltInTag = (tag: string | undefined): tag is CourseTag => {
    return Object.values(CourseTag).includes(tag as CourseTag);
  };

  const getTagInfo = () => {
    if (!course.tag) return null;
    
    if (isBuiltInTag(course.tag)) {
      return {
        label: TAG_LABELS[course.tag],
        emoji: TAG_LABELS[course.tag].split(' ')[0],
        name: TAG_LABELS[course.tag].split(' ')[1],
        colorClass: TAG_COLORS[course.tag],
        bgColor: course.tag === CourseTag.MANDATORY ? 'bg-red-500' :
                 course.tag === CourseTag.ELECTIVE ? 'bg-blue-500' :
                 course.tag === CourseTag.IMPORTANT ? 'bg-amber-500' : 'bg-slate-400'
      };
    }
    
    // Özel etiket
    const customTag = customTags.find(t => t.id === course.tag);
    if (customTag) {
      const colorStyle = TAG_COLOR_PALETTE.find(c => c.id === customTag.color);
      return {
        label: `${customTag.emoji} ${customTag.name}`,
        emoji: customTag.emoji,
        name: customTag.name,
        colorClass: `${colorStyle?.light || 'bg-slate-100'} ${colorStyle?.text || 'text-slate-800'} ${colorStyle?.border || 'border-slate-200'}`,
        bgColor: colorStyle?.bg || 'bg-slate-500'
      };
    }
    
    return null;
  };

  const tagInfo = getTagInfo();

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect) {
      onToggleSelect(course);
    }
  };

  const handleMoveToEligible = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMoveToEligible) {
      onMoveToEligible(course);
    }
  };

  const handleTagChange = (tag: CourseTag | string | undefined) => {
    if (onTagChange) {
      onTagChange(course, tag);
    }
    setShowTagDropdown(false);
  };

  // Kompakt görünüm
  if (compact) {
    return (
      <div 
        className={`
          bg-white rounded-lg border p-3 transition-all hover:shadow-sm cursor-pointer
          ${hasConflict ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'}
          ${course.isSelected ? 'ring-2 ring-indigo-500 border-indigo-300' : ''}
        `}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Ana Satır */}
        <div className="flex items-center gap-3">
          {/* Tag Rengi */}
          {tagInfo && (
            <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${tagInfo.bgColor}`} />
          )}
          
          {/* İçerik */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800">{course.courseCode}</span>
              {tagInfo && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${tagInfo.colorClass}`}>
                  {tagInfo.emoji}
                </span>
              )}
              {hasConflict && (
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-slate-600 truncate">{course.courseName}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              {firstSchedule && (
                <span>{firstSchedule.day.substring(0, 3)} {firstSchedule.startTime}</span>
              )}
              {schedules.length > 1 && (
                <span className="text-indigo-600">+{schedules.length - 1}</span>
              )}
            </div>
          </div>
          
          {/* Aksiyonlar */}
          {showActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {course.isSelected ? (
                <button
                  onClick={handleSelect}
                  className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Çıkar"
                >
                  <Minus className="h-4 w-4" />
                </button>
              ) : course.isEligible ? (
                <>
                  <button
                    onClick={handleMoveToEligible}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Geri"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleSelect}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                    title="Seç"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleSelect}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                  title="Uygun Derslere Ekle"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              
              {/* Tag Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTagDropdown(!showTagDropdown);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Etiket"
                >
                  <Tag className="h-3.5 w-3.5" />
                </button>
                
                {showTagDropdown && (
                  <div 
                    className="absolute right-0 bottom-full mb-2 z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-40 max-h-64 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleTagChange(undefined)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100"
                    >
                      ❌ Kaldır
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <div className="px-2 py-1 text-[10px] font-medium text-slate-400 uppercase">Sabit Etiketler</div>
                    {Object.values(CourseTag).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagChange(tag)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 ${course.tag === tag ? 'bg-slate-50 font-medium' : ''}`}
                      >
                        {TAG_LABELS[tag]}
                      </button>
                    ))}
                    {customTags.length > 0 && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <div className="px-2 py-1 text-[10px] font-medium text-slate-400 uppercase">Özel Etiketler</div>
                        {customTags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => handleTagChange(tag.id)}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 ${course.tag === tag.id ? 'bg-slate-50 font-medium' : ''}`}
                          >
                            {tag.emoji} {tag.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>
          )}
        </div>
        
        {/* Genişletilmiş Detaylar */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1.5">
            <div className="flex items-center text-slate-600">
              <User className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
              <span className="truncate">{course.instructor || 'Belirtilmemiş'}</span>
            </div>
            {schedules.map((schedule, index) => (
              <div key={index} className="flex items-center text-slate-600">
                <Clock className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                <span>{schedule.day} {schedule.startTime}-{schedule.endTime}</span>
                <MapPin className="h-3 w-3 mx-1.5 flex-shrink-0" />
                <span className="truncate">{schedule.classroom}</span>
              </div>
            ))}
            {hasConflict && conflictMessage && (
              <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-red-700 text-[11px]">
                ⚠️ {conflictMessage}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Normal görünüm (eski)
  return (
    <div className={`
      bg-white rounded-lg border p-4 shadow-sm transition-all hover:shadow-md
      ${hasConflict ? 'border-red-300 bg-red-50' : 'border-gray-200'}
      ${course.isSelected ? 'ring-2 ring-blue-500' : ''}
    `}>
      {/* Başlık */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900 mb-1">
            {course.courseCode}
          </h3>
          <p className="text-gray-700 text-sm font-medium">
            {course.courseName}
          </p>
        </div>
        
        {showActions && (
          <div className="flex space-x-2">
            {course.isSelected ? (
              <button
                onClick={handleSelect}
                className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                title="Uygun derslere geri gönder"
              >
                <Minus className="h-4 w-4" />
              </button>
            ) : course.isEligible ? (
              <>
                <button
                  onClick={handleMoveToEligible}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  title="Tüm derslere geri gönder"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSelect}
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                  title="Seçilen derslere ekle"
                  disabled={hasConflict}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleSelect}
                className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                title="Uygun derslere ekle"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ders Bilgileri */}
      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <User className="h-4 w-4 mr-2" />
          <span>{course.instructor || 'Belirtilmemiş'}</span>
        </div>

        {firstSchedule ? (
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            <span>{firstSchedule.day} {firstSchedule.startTime}-{firstSchedule.endTime}</span>
            {schedules.length > 1 && (
              <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                +{schedules.length - 1} daha
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            <span>Çoklu program</span>
          </div>
        )}

        {firstSchedule && (
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            <span>{firstSchedule.classroom}</span>
          </div>
        )}

        {schedules.length > 1 && (
          <div className="mt-2 text-xs text-gray-500">
            <div className="font-medium mb-1">Diğer günler:</div>
            <div className="space-y-1">
              {schedules.slice(1, 4).map((schedule, index) => (
                <div key={index} className="flex items-center">
                  <span>{schedule.day} {schedule.startTime}-{schedule.endTime} [{schedule.classroom}]</span>
                </div>
              ))}
              {schedules.length > 4 && (
                <div className="text-blue-600">... ve {schedules.length - 4} gün daha</div>
              )}
            </div>
          </div>
        )}

        {course.credits && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Kredi:</span> {course.credits}
          </div>
        )}
      </div>

      {hasConflict && conflictMessage && (
        <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded flex items-start">
          <AlertTriangle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700">{conflictMessage}</p>
        </div>
      )}

      <div className="mt-3 flex justify-between items-center">
        <div className="flex space-x-2">
          <div className={`
            inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
            ${course.isSelected 
              ? 'bg-blue-100 text-blue-800' 
              : course.isEligible 
              ? 'bg-orange-100 text-orange-800'
              : 'bg-gray-100 text-gray-800'
            }
          `}>
            {course.isSelected ? '✓ Seçildi' : course.isEligible ? '📋 Uygun' : '📚 Tüm Dersler'}
          </div>
          
          {tagInfo && (
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${tagInfo.colorClass}`}>
              {tagInfo.label}
            </div>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowTagDropdown(!showTagDropdown)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Ders etiketi ekle/değiştir"
          >
            <Tag className="h-4 w-4" />
          </button>
          
          {showTagDropdown && (
            <div className="absolute right-0 bottom-full mb-2 z-50 bg-white border border-gray-200 rounded-md shadow-xl py-1 w-44 max-h-64 overflow-y-auto">
              <button
                onClick={() => handleTagChange(undefined)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
              >
                ❌ Etiket Kaldır
              </button>
              <div className="border-t border-gray-100 my-1" />
              <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase">Sabit Etiketler</div>
              {Object.values(CourseTag).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagChange(tag)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 ${course.tag === tag ? 'bg-gray-50 font-medium' : ''}`}
                >
                  {TAG_LABELS[tag]}
                </button>
              ))}
              {customTags.length > 0 && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase">Özel Etiketler</div>
                  {customTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleTagChange(tag.id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 ${course.tag === tag.id ? 'bg-gray-50 font-medium' : ''}`}
                    >
                      {tag.emoji} {tag.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
