'use client';

import { useEffect, useState } from 'react';
import BlogCard from '@/components/BlogCard';
import PageContainer from '@/components/PageContainer';
import { Heart, Loader2 } from 'lucide-react';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/favorites')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const validFavorites = data.filter(fav => fav.blogId && typeof fav.blogId === 'object');
          setFavorites(validFavorites);
        } else { setFavorites([]); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <PageContainer title="Favorites" icon={<Heart size={14} className="fill-primary" />}>
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      </div>
    </PageContainer>
  );

  return (
    <PageContainer
      title="Favorites"
      subtitle="Curated Stories"
      icon={<Heart size={20} className="fill-primary" />}
    >
      {favorites.length === 0 ? (
        <div className="text-center py-24 aether-card border-dashed flex flex-col items-center">
          <div className="p-6 bg-secondary/50 rounded-full mb-6">
            <Heart className="w-12 h-12 text-muted-foreground/30" />
          </div>
          <p className="text-xl font-bold text-foreground mb-2">No favorites yet</p>
          <p className="text-muted-foreground max-w-sm font-medium text-center">Start exploring and save stories that resonate with you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {favorites.map((fav: any) => (
            <BlogCard key={fav._id} blog={fav.blogId} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
