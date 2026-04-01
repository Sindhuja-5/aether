'use client';

import { useSidebar } from "@/context/SidebarContext";
import { usePathname } from "next/navigation";

export default function LayoutClient({ 
  children, 
  isLoggedIn 
}: { 
  children: React.ReactNode; 
  isLoggedIn: boolean 
}) {
  const { isCollapsed, isMobile } = useSidebar();
  const pathname = usePathname();
  
  // Special handling for settings page to match other pages' max-width
  const isSettingsPage = pathname === '/settings';

  const leftSpacing = isLoggedIn && !isMobile 
    ? (isCollapsed ? 'md:ml-20' : 'md:ml-64') 
    : '';

  const bottomPadding = isLoggedIn && isMobile ? 'pb-20' : 'pb-8';

  return (
    <main className={`flex-1 min-h-[calc(100vh-64px)] pt-8 px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out ${leftSpacing} ${bottomPadding}`}>
      <div className={(isLoggedIn && !isSettingsPage) ? 'max-w-5xl mx-auto' : 'max-w-6xl mx-auto'}>
        {children}
      </div>
    </main>
  );
}
