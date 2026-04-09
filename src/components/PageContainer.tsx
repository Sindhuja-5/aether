'use client';
import React from 'react';
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
    <div className="w-full pb-12 px-4 shadow-none md:shadow-none">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6 pt-2">
        <div className="flex items-center space-x-1 min-w-0">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-primary mr-2 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="flex items-center space-x-4 min-w-0">
            {icon && (
              <div className="p-3 bg-primary/5 text-primary rounded-2xl shrink-0 border border-primary/10 shadow-sm flex items-center justify-center">
                {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground font-medium truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {action && (
          <div className="flex items-center flex-wrap gap-3 mt-2 sm:mt-0">
            {action}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
