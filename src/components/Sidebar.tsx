'use client';

import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Heart, PenSquare, Settings, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { useState } from 'react';
import { useNavigationGuard } from '@/context/NavigationGuardContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar, isMobile } = useSidebar();
  const { confirmNavigation } = useNavigationGuard();
  const [showUpsell, setShowUpsell] = useState(true);

  const navItems = [
    { name: 'Feed', href: '/', icon: LayoutDashboard },
    { name: 'My Stories', href: '/my-blogs', icon: BookOpen },
    { name: 'Favorites', href: '/favorites', icon: Heart },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  if (isMobile) {
    return (
      <nav className="fixed border-t border-border/50 bottom-0 left-0 right-0 min-h-[calc(64px+env(safe-area-inset-bottom))] bg-white/90 backdrop-blur-xl flex items-center justify-around z-50 shadow-[0_-1px_10px_rgba(0,0,0,0.05)] px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <button key={item.name} onClick={() => confirmNavigation(item.href)} className={`flex flex-col items-center justify-center space-y-1 p-2 rounded-xl transition-all duration-200 cursor-pointer border-none bg-transparent ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <item.icon size={20} />
              <span className="text-[10px] font-bold tracking-tight uppercase">{item.name}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <aside className={`hidden md:flex flex-col fixed left-0 top-16 bottom-0 bg-white border-r border-gray-100 py-6 px-3 z-40 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <button onClick={toggleSidebar} className="absolute -right-3 top-4 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors z-50 cursor-pointer">
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <button key={item.name} onClick={() => confirmNavigation(item.href)} className={`w-full flex items-center rounded-xl transition-all duration-200 group relative border-none bg-transparent cursor-pointer ${isCollapsed ? 'justify-center p-3' : 'space-x-3 px-3 py-2.5'} ${isActive ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`} title={isCollapsed ? item.name : ''}>
              <item.icon size={18} className={`transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-900'}`} />
              {!isCollapsed && <span className="text-sm whitespace-nowrap">{item.name}</span>}
              {isCollapsed && <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100]">{item.name}</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
