import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AccordionPanelProps {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const AccordionPanel: React.FC<AccordionPanelProps> = ({
  title,
  count,
  isOpen,
  onToggle,
  children,
  icon,
  badge
}) => {
  return (
    <div className="border-b border-slate-200 dark:border-zinc-900 last:border-b-0">
      {/* Header - Tıklanabilir */}
      <div
        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer ${
          isOpen ? 'bg-slate-50 dark:bg-zinc-900/40' : ''
        }`}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Chevron */}
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
            <ChevronDown className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
          </div>
          
          {/* Icon */}
          {icon && (
            <div className="text-slate-500 dark:text-zinc-400">
              {icon}
            </div>
          )}
          
          {/* Title */}
          <span className="font-semibold text-slate-700 dark:text-zinc-200">{title}</span>
          
          {/* Count Badge */}
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-full">
            {count}
          </span>
        </div>
        
        {/* Extra Badge - Button dışında */}
        {badge && (
          <div className="flex-shrink-0 ml-2">
            {badge}
          </div>
        )}
        
        {/* Right side indicator */}
        {!isOpen && !badge && (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </div>
      
      {/* Content - Collapsible */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[60vh] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="overflow-y-auto max-h-[60vh] px-2 pb-2 scroll-smooth">
          {children}
        </div>
      </div>
    </div>
  );
};
