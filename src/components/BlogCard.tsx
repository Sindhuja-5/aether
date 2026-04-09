'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Heart, Loader2, Edit2, Trash2, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface BlogCardProps {
  blog: any;
  onDelete?: (id: string) => void;
  hideStatusBadge?: boolean;
  hideAuthorActions?: boolean;
}

export default function BlogCard({ blog, onDelete, hideStatusBadge, hideAuthorActions = false }: BlogCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/user')
      .then(res => res.ok ? res.json() : null)
      .then(user => {
        if (user && !user.error) {
          setIsLoggedIn(true);
          setCurrentUser(user);
          // Check if viewing user is the author
          const authorId = blog.authorId?._id || blog.authorId;
          const currentUserId = user.id || user.sub || user._id; // Cover multiple ID formats
          if (authorId === currentUserId) {
            setIsAuthor(true);
          }

          fetch('/api/favorites')
            .then(res => res.json())
            .then(favs => {
              if (Array.isArray(favs)) {
                setIsFavorited(favs.some(f => (f.blogId?._id || f.blogId) === blog._id));
              }
            });
        }
      });
  }, [blog._id, blog.authorId]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      toast.warning('Join Aether to favorite stories.');
      return;
    }

    setFavLoading(true);
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: blog._id })
      });
      const data = await res.json();
      setIsFavorited(data.favorited);
      toast.success(data.favorited ? 'Added to favorites' : 'Removed from favorites');
    } catch { toast.error('An error occurred'); }
    finally { setFavLoading(false); }
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const destination = `/blog/${blog._id}`;

  return (
    <Link href={destination} className="block group h-full">
      <div className="aether-card aether-card-hover p-4 sm:p-5 relative overflow-hidden flex flex-col h-full transition-all duration-500 bg-white group-hover:border-primary/20">
        {/* Header: Pure Author Info */}
        <div className="flex items-center space-x-4 min-w-0 mb-4 relative z-20">
          <Avatar className="h-8 w-8 border border-border/50 shrink-0 rounded-full">
            <AvatarImage src={blog.authorId?.profilePicture || undefined} className="object-cover rounded-full" />
            <AvatarFallback className="bg-primary text-white font-bold text-[10px] rounded-full">
              {getInitials(blog.authorId?.penName || blog.authorId?.firstName || 'A')}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-[11px] font-black text-foreground tracking-tight leading-none pt-0.5 truncate group-hover:text-primary transition-colors">
              {blog.authorId?.penName || 'Anonymous'}
            </p>
            <p className="text-[10px] font-medium text-muted-foreground leading-none">
              {format(new Date(blog.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1">
            <div className="aspect-[3/2] w-full overflow-hidden rounded-lg mb-4 bg-secondary/50 shadow-sm border border-border/50 relative">
              {blog.previewImage ? (
                <img
                  src={blog.previewImage}
                  alt={blog.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/10 via-background to-secondary/30 flex items-center justify-center relative overflow-hidden">
                  {/* Modern geometric detail */}
                  <BookOpen size={18} className="text-primary/20 transition-transform duration-500 group-hover:scale-110 group-hover:text-primary/30" strokeWidth={1.5} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {(blog.tags && blog.tags.length > 0) && (
                blog.tags.slice(0, 2).map((tag: string) => (
                  <span key={tag} className="text-[10px] font-bold px-2 py-0.5 bg-primary/5 text-primary rounded-md">
                    {tag}
                  </span>
                ))
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-black text-foreground mb-4 line-clamp-3 group-hover:text-primary transition-all tracking-tight leading-snug">
              {blog.title}
            </h2>
          </div>

          {/* Footer: States & Actions */}
          {(isAuthor || isLoggedIn) && (
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40">
              <div className="flex items-center space-x-2">
                {isAuthor && !hideStatusBadge && (
                  <div className={`px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-tight ${blog.status === 'published' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                    {blog.status === 'published' ? 'Published' : 'Draft'}
                  </div>
                )}
                {isAuthor && !hideAuthorActions && (
                  <div className="flex items-center space-x-1" onClick={(e) => e.preventDefault()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer hover:bg-secondary transition-all" onClick={(e) => { e.stopPropagation(); router.push(`/blog/${blog._id}`); }}>
                      <Edit2 size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer text-destructive hover:bg-destructive/5 hover:text-destructive transition-all" onClick={(e) => { e.stopPropagation(); onDelete?.(blog._id); }}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>

              {isLoggedIn && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  className={`h-9 w-9 cursor-pointer rounded-xl transition-all active:scale-90 ${isFavorited ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-primary hover:bg-secondary'
                    }`}
                >
                  {favLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Heart size={18} fill={isFavorited ? "currentColor" : "none"} strokeWidth={2.5} />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
