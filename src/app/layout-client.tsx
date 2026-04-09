'use client';

import { useSidebar } from "@/context/SidebarContext";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function LayoutClient({ 
  children, 
  isLoggedIn 
}: { 
  children: React.ReactNode; 
  isLoggedIn: boolean 
}) {
  const { isCollapsed, isMobile } = useSidebar();
  const pathname = usePathname();
  
  // Global scroll restoration fix - ensure we always start at top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Special handling for settings page to match other pages' max-width
  const isSettingsPage = pathname === '/settings';

  const leftSpacing = isLoggedIn && !isMobile 
    ? (isCollapsed ? 'md:ml-20' : 'md:ml-64') 
    : '';

  const bottomPadding = isLoggedIn && isMobile 
    ? 'pb-[calc(80px+env(safe-area-inset-bottom))]' 
    : 'pb-8';

  const maxWidthClass = isCollapsed ? 'max-w-7xl' : 'max-w-5xl';

  return (
    <main className={`flex-1 min-h-[calc(100vh-64px)] pt-2 px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out overflow-x-hidden ${leftSpacing} ${bottomPadding}`}>
      <div className={`${maxWidthClass} mx-auto w-full transition-all duration-300`}>
        {children}
      </div>
    </main>
  );
}
