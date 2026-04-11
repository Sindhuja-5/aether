"use client"

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageContainer from '@/components/PageContainer';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { BlogGrid } from '@/components/BlogGrid';
import { TabPill } from '@/components/TabPill';
import { SearchX, LayoutDashboard, Loader2 } from 'lucide-react';

function BlogFeed() {
  const searchParams = useSearchParams();
  const router = useRouter();
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

  if (loading) return <LoadingSpinner message="Loading stories..." />;


  return (
    <>
      {!query && isLoggedIn && (
        <div className="mb-6">
          <TabPill
            tabs={[
              { id: 'all', label: 'Discover' },
              { id: 'curated', label: 'For You' },
            ]}
            value={feedType}
            onChange={setFeedType}
          />
        </div>
      )}

      {blogs.length === 0 ? (
        <EmptyState
          icon={<SearchX className="w-12 h-12 text-muted-foreground/30" />}
          title={
            query
              ? `No results for "${query}"`
              : feedType === 'curated'
              ? 'Nothing in your topics yet'
              : 'No stories yet'
          }
          description={
            query
              ? 'Try searching for something else or broaden your keywords.'
              : feedType === 'curated'
              ? 'Try following more topics in your settings to curate your feed.'
              : 'Be the first to share your thoughts.'
          }
          action={
            feedType === 'curated' && !query ? (
              <button
                onClick={() => router.push('/settings')}
                className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer"
              >
                Update Topics
              </button>
            ) : undefined
          }
        />
      ) : (
        <BlogGrid blogs={blogs} hideStatusBadge hideAuthorActions />
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
