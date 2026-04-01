"use client"

import { useEffect, useState, Suspense } from 'react';
import BlogCard from '@/components/BlogCard';
import PageContainer from '@/components/PageContainer';
import { Loader2, LayoutDashboard, SearchX } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function BlogFeed() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const searchUrl = query 
      ? `/api/blogs?status=published&q=${encodeURIComponent(query)}`
      : `/api/blogs?status=published`;

    fetch(searchUrl)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBlogs(data);
        } else {
          setBlogs([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [query]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium tracking-tight">Discovering stories...</p>
      </div>
    );
  }

  return (
    <>
      {blogs.length === 0 ? (
        <div className="text-center py-24 aether-card border-dashed flex flex-col items-center">
          <div className="p-6 bg-secondary/50 rounded-full mb-6">
            <SearchX className="w-12 h-12 text-muted-foreground/30" />
          </div>
          <p className="text-xl font-bold text-foreground mb-2">
            {query ? `No results for "${query}"` : 'No stories yet'}
          </p>
          <p className="text-muted-foreground max-w-sm font-medium">
            {query ? 'Try searching for something else or broaden your keywords.' : 'Be the first to share your thoughts.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {blogs.map((blog: any) => (
            <BlogCard key={blog._id} blog={blog} hideStatusBadge={true} />
          ))}
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <PageContainer 
      title="Explore Insights"
      subtitle="Community Stories"
      icon={<LayoutDashboard size={20} />}
    >
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        </div>
      }>
        <BlogFeed />
      </Suspense>
    </PageContainer>
  );
}
