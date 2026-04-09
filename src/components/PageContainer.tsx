'use client';

import { useSidebar } from "@/context/SidebarContext";
import { ChevronLeft } from 'lucide-react';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: '5xl' | '6xl';
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onBack?: () => void;
}

export default function PageContainer({
  children,
  maxWidth = '5xl',
  title,
  subtitle,
  icon,
  action,
  onBack
}: PageContainerProps) {
  return (
    <div className={`max-w-${maxWidth} mx-auto pb-12 px-4 shadow-none md:shadow-none`}>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 pt-2">
        <div className="flex items-center space-x-1 min-w-0">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-primary mr-2"
              title="Go back"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="flex items-center space-x-4 min-w-0">
            {icon && (
              <div className="p-3 bg-primary/5 text-primary rounded-2xl shrink-0 border border-primary/10 shadow-sm">
                {icon}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              {title && (
                <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-none whitespace-nowrap">
                  {title}
                </h1>
              )}
              {subtitle && (
                <div className="text-xs font-bold text-muted-foreground pt-1.5 opacity-70">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
        </div>
        {action && (
          <div className="flex items-center space-x-3 shrink-0">
            {action}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
