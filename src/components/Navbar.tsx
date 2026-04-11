"use client"

import Link from 'next/link';
import { PenSquare, LogOut, Search, BookOpen, Settings, LayoutDashboard, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNavigationGuard } from '@/context/NavigationGuardContext';

export default function Navbar({ user: initialUser }: { user: any }) {
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirmNavigation } = useNavigationGuard();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync avatar when settings update (Issue #11)
  useEffect(() => {
    if (!initialUser) return;
    const fetchUser = async (shouldRefresh = false) => {
      const res = await fetch('/api/user');
      if (!res.ok) return;
      const data = await res.json();
      if (data && !data.error) {
        setUser({ ...initialUser, name: data.penName || data.firstName + ' ' + data.lastName, picture: data.profilePicture });
        if (shouldRefresh) router.refresh();
      }
    };
    fetchUser(false);

    const handleUpdate = () => fetchUser(true);
    window.addEventListener('user-updated', handleUpdate);
    return () => window.removeEventListener('user-updated', handleUpdate);
  }, [initialUser?.email, router]);

  const handleSearch = (val: string) => {
    setSearchValue(val);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = searchValue.trim();
      confirmNavigation(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'A';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <header className={`sticky top-0 z-[100] w-full transition-all duration-300 ${scrolled ? 'bg-background/80 backdrop-blur-xl py-3 border-b border-border shadow-sm' : 'bg-transparent py-5'
      }`}>
      <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <button onClick={() => confirmNavigation('/')} className="flex items-center space-x-2 group shrink-0 border-none bg-transparent cursor-pointer">
          <img
            src="/logo.svg"
            alt="Aether"
            className="w-9 h-9 rounded-full object-cover"
          />
          <span className="text-xl font-black text-foreground tracking-tighter pt-0.5">
            Aether
          </span>
        </button>

        {/* Search */}
        <div className="flex-1 max-w-xl px-12 hidden sm:block">
          <div className="relative group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search ideas, topics, or authors..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full bg-secondary/50 border border-border/50 h-11 pl-11 pr-4 rounded-xl font-bold text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3 shrink-0">
          {!user ? (
            <Button asChild size="sm">
              <a href="/auth/login">Join Now</a>
            </Button>
          ) : (
            <div className="flex items-center space-x-3">
              <Button onClick={() => confirmNavigation('/blog/new')} variant="ghost" size="icon" className="text-muted-foreground hover:text-primary cursor-pointer" title="New Story">
                <PenSquare size={18} strokeWidth={2.5} />
              </Button>

              <div className="h-6 w-[1px] bg-border/40 mx-1 hidden sm:block" />

              <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
                  <Avatar className="h-9 w-9 border-2 border-transparent hover:border-primary/20 transition-all shadow-sm">
                    <AvatarImage src={user.picture || undefined} className="object-cover" />
                    <AvatarFallback className="bg-primary text-white font-bold text-xs">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2 rounded-2xl p-2 shadow-xl border-border/40 bg-background/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="px-3 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-foreground tracking-tight truncate">{user.name}</span>
                      <span className="text-[10px] font-bold text-muted-foreground truncate opacity-70">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/40" />
                  
                  <DropdownMenuItem onClick={() => confirmNavigation('/')} className="rounded-xl cursor-pointer py-2.5 font-bold text-xs focus:bg-primary/5 focus:text-primary transition-all">
                    <LayoutDashboard className="mr-3 h-4 w-4" />
                    <span>Feed</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => confirmNavigation('/my-blogs')} className="rounded-xl cursor-pointer py-2.5 font-bold text-xs focus:bg-primary/5 focus:text-primary transition-all">
                    <BookOpen className="mr-3 h-4 w-4" />
                    <span>My Stories</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => confirmNavigation('/favorites')} className="rounded-xl cursor-pointer py-2.5 font-bold text-xs focus:bg-primary/5 focus:text-primary transition-all">
                    <Heart className="mr-3 h-4 w-4" />
                    <span>Favorites</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => confirmNavigation('/settings')} className="rounded-xl cursor-pointer py-2.5 font-bold text-xs focus:bg-primary/5 focus:text-primary transition-all">
                    <Settings className="mr-3 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border/40" />
                  
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5 font-bold text-xs text-destructive focus:bg-destructive/5 focus:text-destructive transition-all">
                    <a href="/auth/logout" className="flex items-center w-full">
                      <LogOut className="mr-3 h-4 w-4" />
                      <span>Sign Out</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
