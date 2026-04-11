'use client';

import { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { BlogGrid } from '@/components/BlogGrid';
import { Heart } from 'lucide-react';

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
      <LoadingSpinner />
    </PageContainer>
  );

  return (
    <PageContainer
      title="Favorites"
      subtitle="Curated Stories"
      icon={<Heart size={20} className="fill-primary" />}
    >
      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart className="w-12 h-12 text-muted-foreground/30" />}
          title="No favorites yet"
          description="Start exploring and save stories that resonate with you."
        />
      ) : (
        <BlogGrid blogs={favorites.map((fav: any) => fav.blogId)} />
      )}
    </PageContainer>
  );
}
