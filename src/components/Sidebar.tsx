'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Heart, PenSquare, Settings, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar, isMobile } = useSidebar();
  const [showUpsell, setShowUpsell] = useState(true);

  const navItems = [
    { name: 'Feed', href: '/', icon: LayoutDashboard },
    { name: 'My Stories', href: '/my-blogs', icon: BookOpen },
    { name: 'Favorites', href: '/favorites', icon: Heart },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around z-50 shadow-lg px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href} className={`flex flex-col items-center justify-center space-y-1 p-2 rounded-xl transition-all duration-200 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <aside className={`hidden md:flex flex-col fixed left-0 top-16 bottom-0 bg-white border-r border-gray-100 py-6 px-3 z-40 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <button onClick={toggleSidebar} className="absolute -right-3 top-4 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors z-50">
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href} className={`flex items-center rounded-xl transition-all duration-200 group relative ${isCollapsed ? 'justify-center p-3' : 'space-x-3 px-3 py-2.5'} ${isActive ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`} title={isCollapsed ? item.name : ''}>
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-900'}`} />
              {!isCollapsed && <span className="text-sm whitespace-nowrap">{item.name}</span>}
              {isCollapsed && <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100]">{item.name}</span>}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
