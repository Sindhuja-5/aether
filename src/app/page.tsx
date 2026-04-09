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
  const [feedType, setFeedType] = useState<'all' | 'curated'>('all');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // Safety watchdog: never stay in loading forever
    const watchdog = setTimeout(() => {
      if (active) setLoading(false);
    }, 4000);

    const initFeed = async () => {
      setLoading(true);
      try {
        // 1. Check Auth first
        const userRes = await fetch('/api/user', { signal: controller.signal });
        const loggedIn = userRes.ok;
        if (active) setIsLoggedIn(loggedIn);

        // 2. Fetch Blogs
        let searchUrl = query
          ? `/api/blogs?status=published&q=${encodeURIComponent(query)}`
          : `/api/blogs?status=published`;

        if (!query && feedType === 'curated' && loggedIn) {
          searchUrl += '&exclusive=true';
        }

        const blogRes = await fetch(searchUrl, { signal: controller.signal });
        const data = await blogRes.json();

        if (active) {
          setBlogs(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active && (err as Error).name !== 'AbortError') {
          console.error("Feed fetch error:", err);
          setBlogs([]);
        }
      } finally {
        if (active) {
          setLoading(false);
          clearTimeout(watchdog);
        }
      }
    };

    initFeed();

    return () => {
      active = false;
      controller.abort();
      clearTimeout(watchdog);
    };
  }, [query, feedType]);

  const tabs = [
    { id: 'all', label: 'Discover', subtitle: 'Global Community' },
    { id: 'curated', label: 'For You', subtitle: 'Your Topics' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-pulse">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold tracking-widest text-[10px]">Loading stories...</p>
      </div>
    );
  }

  return (
    <>
      {!query && isLoggedIn && (
        <div className="flex items-center space-x-1 bg-secondary/30 p-1 rounded-2xl border border-border/40 w-fit mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFeedType(tab.id as any)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${feedType === tab.id
                ? 'bg-white text-primary shadow-sm border border-border/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {blogs.length === 0 ? (
        <div className="text-center py-24 aether-card border-dashed flex flex-col items-center">
          <div className="p-6 bg-secondary/50 rounded-full mb-6">
            <SearchX className="w-12 h-12 text-muted-foreground/30" />
          </div>
          <p className="text-xl font-bold text-foreground mb-2">
            {query
              ? `No results for "${query}"`
              : feedType === 'curated'
                ? 'Nothing in your topics yet'
                : 'No stories yet'}
          </p>
          <p className="text-muted-foreground max-w-sm font-medium mb-6">
            {query
              ? 'Try searching for something else or broaden your keywords.'
              : feedType === 'curated'
                ? 'Try following more topics in your settings to curate your feed.'
                : 'Be the first to share your thoughts.'}
          </p>
          {feedType === 'curated' && !query && (
            <button
              onClick={() => window.location.href = '/settings'}
              className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              Update Topics
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {blogs.map((blog: any) => (
            <BlogCard key={blog._id} blog={blog} hideStatusBadge={true} hideAuthorActions={true} />
          ))}
        </div>
      )}
    </>
  );
}

export default function Home() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');

  return (
    <PageContainer
      title={query ? `Search Results` : `Explore Insights`}
      subtitle={query ? `Refine your search above` : "Community Stories"}
      icon={<LayoutDashboard size={18} />}
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
