'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2, Plus, BookOpen, FileText, ListFilter } from 'lucide-react';
import PageContainer from '@/components/PageContainer';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BlogGrid } from '@/components/BlogGrid';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DeleteBlogDialog } from '@/components/DeleteBlogDialog';

export default function MyBlogs() {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/blogs/me')
      .then(async res => {
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/');
            return null;
          }
          throw new Error('Failed to fetch blogs');
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setBlogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/blogs/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setBlogs(blogs.filter(b => b._id !== deleteId));
        toast.success('Story deleted');
      } else { toast.error('Failed to delete story'); }
    } catch { toast.error('Error deleting story'); }
    finally { setDeleting(false); setDeleteDialogOpen(false); setDeleteId(null); }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const filteredBlogs = blogs
    .filter(blog => statusFilter === 'all' ? true : blog.status === statusFilter)
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  return (
    <PageContainer
      title="My Stories"
      subtitle="Your Story Archive"
      icon={<BookOpen size={20} />}
      action={
        <Button asChild className="rounded-xl shadow-lg shadow-primary/20 cursor-pointer">
          <Link href="/blog/new">
            <Plus size={18} className="mr-2" />
            New Story
          </Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center flex-wrap gap-1 bg-secondary/50 p-1 rounded-xl border border-border/40">
            <Button
              variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm" onClick={() => setStatusFilter('all')}
              className={`h-8 px-4 rounded-lg text-xs font-bold cursor-pointer ${statusFilter === 'all' ? 'bg-white shadow-sm border border-border/10' : 'text-muted-foreground'}`}
            >All</Button>
            <Button
              variant={statusFilter === 'draft' ? 'secondary' : 'ghost'}
              size="sm" onClick={() => setStatusFilter('draft')}
              className={`h-8 px-4 rounded-lg text-xs font-bold cursor-pointer ${statusFilter === 'draft' ? 'bg-white shadow-sm border border-border/10' : 'text-muted-foreground'}`}
            >Drafts</Button>
            <Button
              variant={statusFilter === 'published' ? 'secondary' : 'ghost'}
              size="sm" onClick={() => setStatusFilter('published')}
              className={`h-8 px-4 rounded-lg text-xs font-bold cursor-pointer ${statusFilter === 'published' ? 'bg-white shadow-sm border border-border/10' : 'text-muted-foreground'}`}
            >Published</Button>
          </div>
          <div className="h-4 w-[1px] bg-border mx-2 hidden sm:block" />
          <div className="flex items-center text-muted-foreground text-[10px] font-black tracking-widest px-2 group">
            <ListFilter size={14} className="mr-2 group-hover:text-primary transition-colors" />
            <span>{filteredBlogs.length} Stories</span>
          </div>
        </div>

        <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border/40 ml-auto">
          <Button
            variant={sortBy === 'newest' ? 'secondary' : 'ghost'}
            size="sm" onClick={() => setSortBy('newest')}
            className={`h-8 px-4 rounded-lg text-xs font-bold cursor-pointer ${sortBy === 'newest' ? 'bg-white shadow-sm border border-border/10' : 'text-muted-foreground'}`}
          >Newest First</Button>
          <Button
            variant={sortBy === 'oldest' ? 'secondary' : 'ghost'}
            size="sm" onClick={() => setSortBy('oldest')}
            className={`h-8 px-4 rounded-lg text-xs font-bold cursor-pointer ${sortBy === 'oldest' ? 'bg-white shadow-sm border border-border/10' : 'text-muted-foreground'}`}
          >Oldest</Button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading your story archive..." />
      ) : filteredBlogs.length === 0 ? (
        <div className="text-center py-32 bg-secondary/10 rounded-[32px] border-2 border-dashed border-border/40">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-6" />
          <p className="text-xl font-black text-foreground mb-4">No stories found</p>
          <Button asChild variant="outline" className="rounded-xl cursor-pointer">
            <Link href="/blog/new">Create your first story</Link>
          </Button>
        </div>
      ) : (
        <BlogGrid blogs={filteredBlogs} onDelete={handleDeleteClick} />
      )}

      <DeleteBlogDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDelete={handleDelete}
        deleting={deleting}
      />
    </PageContainer>
  );
}
