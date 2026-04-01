'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Heart, Loader2, Edit2, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function BlogCard({ blog, onDelete, hideStatusBadge }: { blog: any, onDelete?: (id: string) => void, hideStatusBadge?: boolean }) {
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
      <div className="aether-card aether-card-hover p-6 relative overflow-hidden flex flex-col h-full transition-all duration-500 bg-white group-hover:border-primary/20">
        {/* Header: Pure Author Info */}
        <div className="flex items-center space-x-3 min-w-0 mb-5 relative z-20">
          <Avatar className="h-9 w-9 border border-border/50 shrink-0">
            <AvatarImage src={blog.authorId?.profilePicture || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary text-white font-black text-[10px] uppercase">
              {getInitials(blog.authorId?.penName || blog.authorId?.firstName || 'A')}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-xs font-black text-foreground tracking-tight leading-none pt-0.5 truncate group-hover:text-primary transition-colors">
              {blog.authorId?.penName || 'Anonymous'}
            </p>
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-[0.1em] leading-none">
              {format(new Date(blog.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1">
            {blog.previewImage && (
              <div className="aspect-[3/2] w-full overflow-hidden rounded-xl mb-6 bg-secondary/50 shadow-sm border border-border/50">
                <img
                  src={blog.previewImage}
                  alt={blog.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              {(blog.tags && blog.tags.length > 0) && (
                blog.tags.slice(0, 2).map((tag: string) => (
                  <span key={tag} className="text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 bg-primary/5 text-primary rounded-md">
                    {tag}
                  </span>
                ))
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-foreground mb-6 line-clamp-3 group-hover:text-primary transition-all tracking-tight leading-tight">
              {blog.title}
            </h2>
          </div>

          {/* Footer: States & Actions */}
          {(isAuthor || isLoggedIn) && (
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40">
              <div className="flex items-center space-x-2">
                {isAuthor && !hideStatusBadge && (
                  <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black tracking-tight ${blog.status === 'published' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                    {blog.status === 'published' ? 'Published' : 'Draft'}
                  </div>
                )}
                {isAuthor && (
                  <div className="flex items-center space-x-1" onClick={(e) => e.preventDefault()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg cursor-pointer hover:bg-secondary transition-all" onClick={(e) => { e.stopPropagation(); router.push(`/blog/${blog._id}`); }}>
                      <Edit2 size={12} />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 rounded-lg cursor-pointer text-destructive hover:bg-destructive/5 hover:text-destructive transition-all"
                      onClick={(e) => { e.stopPropagation(); onDelete?.(blog._id); }}
                    >
                      <Trash2 size={12} />
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
                  className={`h-8 w-8 cursor-pointer rounded-xl transition-all active:scale-90 ${isFavorited ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-primary hover:bg-secondary'
                    }`}
                >
                  {favLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Heart size={16} fill={isFavorited ? "currentColor" : "none"} strokeWidth={2.5} />
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
