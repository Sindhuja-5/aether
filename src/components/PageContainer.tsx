'use client';
import React from 'react';
import { useSidebar } from "@/context/SidebarContext";
import { ChevronLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

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
      <header className="flex flex-row items-center justify-between flex-wrap gap-x-4 gap-y-3 mb-6 pt-2">
        <div className="flex items-center space-x-1 min-w-0">
          {onBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack} 
              className="h-10 w-10 -ml-2 rounded-full hover:bg-secondary cursor-pointer shrink-0"
            >
              <ChevronLeft size={24} />
            </Button>
          )}
          {icon && <div className="text-primary hidden sm:block">{icon}</div>}
          <div className="min-w-0">
            {title && (
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate px-1">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate px-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && (
          <div className="flex items-center flex-wrap gap-2">
            {action}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
