'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TiptapEditor from '@/components/TiptapEditor';
import PageContainer from '@/components/PageContainer';
import TagPicker from '@/components/TagPicker';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { uploadImageToS3 } from '@/lib/upload';
import { Save, Send, Image as ImageIcon, Loader2, PenSquare, Trash2, FileText, ChevronLeft, CheckCircle, Heart, Share2, BookOpen } from 'lucide-react';

export default function BlogRoute() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [blog, setBlog] = useState<any>(null); // Kept for viewing metadata like author picture
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editor, setEditor] = useState<any>(null);

  const [backDialogOpen, setBackDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'draft' | 'published' | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    // Parallel fetch user and blog
    Promise.all([
      fetch('/api/user').then(r => r.ok ? r.json() : null).catch(() => null),
      !isNew ? fetch(`/api/blogs/${id}`).then(r => r.json()).catch(() => null) : Promise.resolve(null),
      !isNew ? fetch('/api/favorites').then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([])
    ]).then(([userData, blogData, favData]) => {
      if (userData?.error && isNew) {
        toast.info('Please log in to create a story.');
        window.location.href = '/';
        return;
      }

      setCurrentUser(userData && !userData.error ? userData : null);

      if (blogData && !blogData.error) {
        setBlog(blogData);
        setTitle(blogData.title || '');
        setBody(blogData.body);
        setPreviewImage(blogData.previewImage || null);
        setStatus(blogData.status);
        setTags(blogData.tags || []);

        if (Array.isArray(favData) && favData.some((f: any) => (f.blogId?._id === id || f.blogId === id))) {
          setIsFavorited(true);
        }
      } else if (!isNew && (!blogData || blogData.error)) {
        toast.error('Story not found.');
        window.location.href = '/';
      }
      setLoading(false);
    });
  }, [id, isNew, router]);

  const currentUserId = currentUser?._id || currentUser?.id;
  const authorId = blog?.authorId?._id || blog?.authorId;
  const isAuthor = isNew || Boolean(currentUserId && authorId && String(currentUserId) === String(authorId));
  const isPublished = status === 'published';
  // You are in edit mode ONLY IF you are the author AND the post is not published yet.
  const isEditMode = isAuthor && !isPublished;

  const toggleFavorite = async () => {
    if (!currentUser) return toast.info('Please login to favorite stories.');
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: id })
      });
      const data = await res.json();
      setIsFavorited(data.favorited);
    } catch {
      toast.error('Error toggling favorite');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditMode) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB for cover images

    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
      toast.error('Only JPEG, PNG and HEIC images are allowed');
      return;
    }

    if (file.size > maxSizeBytes) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImageToS3(file);
      setPreviewImage(url);
      setHasChanges(true);
      toast.success('Cover image updated');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async (saveStatus: 'draft' | 'published') => {
    if (!title.trim()) { toast.warning('A story needs a title'); return; }
    setSaving(true);
    const content = editor?.getJSON() || body;
    const payload = { title, body: content, previewImage, status: saveStatus, tags };
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? '/api/blogs' : `/api/blogs/${id}`;

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const savedBlog = await res.json();
        toast.success(saveStatus === 'published' ? 'Story published!' : 'Draft saved.');
        setStatus(savedBlog.status);
        setHasChanges(false);
        if (isNew) router.push(`/blog/${savedBlog._id}`);
      } else { toast.error('Failed to save story'); }
    } catch { toast.error('An error occurred'); }
    finally { setSaving(false); setConfirmOpen(false); setPendingStatus(null); }
  };

  const triggerStatusChange = async (s: 'draft' | 'published') => {
    if (s === status) return handleSave(s);
    if (s === 'published') {
      toast.info('Saving changes before publish...');
      await handleSave('draft');
    }
    setPendingStatus(s);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/blogs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Story deleted');
        router.push('/my-blogs');
      } else { toast.error('Failed to delete story'); }
    } catch { toast.error('Error deleting story'); }
    finally { setDeleting(false); setDeleteDialogOpen(false); }
  };

  const handleBack = () => {
    if (isEditMode && hasChanges) {
      setBackDialogOpen(true);
    } else {
      if (window.history.length > 2) {
        router.back();
      } else {
        router.push(isEditMode ? '/my-blogs' : '/');
      }
    }
  };

  if (loading) return (
    <PageContainer title={isNew ? 'New Story' : 'Story'} icon={<BookOpen size={20} />}>
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      </div>
    </PageContainer>
  );

  return (
    <PageContainer
      title=""
      action={
        <div className="flex items-center space-x-2 bg-secondary/30 p-1 rounded-xl border border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className={`h-9 text-muted-foreground cursor-pointer px-3 transition-all ${(isAuthor || (currentUser && !isNew))
                ? 'border-r border-border/40 rounded-none'
                : 'rounded-xl'
              }`}
          >
            <ChevronLeft size={14} className="mr-2" />
            Back
          </Button>

          {currentUser && !isAuthor && !isNew && (
            <Button variant="ghost" size="sm" onClick={toggleFavorite} className="h-9 cursor-pointer px-3">
              <Heart size={14} fill={isFavorited ? "currentColor" : "none"} className={`mr-2 ${isFavorited ? 'text-primary' : ''}`} />
              Favorite
            </Button>
          )}

          {isAuthor && (
            <>
              {!isNew && (
                <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(true)} className="h-9 text-destructive hover:bg-destructive/5 hover:text-destructive cursor-pointer px-3">
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </Button>
              )}
              {isEditMode && (
                <Button variant="ghost" size="sm" onClick={() => handleSave('draft')} disabled={saving} className="h-9 cursor-pointer px-3">
                  <Save size={14} className="mr-2" />
                  Save
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => triggerStatusChange(status === 'published' ? 'draft' : 'published')}
                disabled={saving}
                className={`h-9 cursor-pointer px-4 ${status === 'published' ? 'bg-amber-500 hover:bg-amber-600 border-none' : ''}`}
              >
                {status === 'published' ? <FileText size={14} className="mr-2 text-white" /> : <Send size={14} className="mr-2" />}
                {status === 'published' ? 'Unpublish' : 'Publish'}
              </Button>
            </>
          )}
        </div>
      }
    >
      {isAuthor && status === 'published' && (
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-4 flex items-center animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="text-sm font-medium text-primary flex items-center">
            <CheckCircle size={16} className="mr-2 shrink-0" />
            This story is published and in read-only mode. Use the Unpublish button above to edit it.
          </p>
        </div>
      )}

      <div className="aether-card overflow-hidden">
        {/* Hero Image Section */}
        <div className="relative group">
          {previewImage ? (
            <div className={`relative w-full aspect-[21/9] sm:aspect-[16/7] min-h-[250px] max-h-[500px] overflow-hidden ${isEditMode ? 'cursor-pointer' : ''}`}>
              <img
                src={previewImage}
                alt="Cover"
                className={`w-full h-full object-cover transition-all duration-1000 ${isEditMode ? 'group-hover:scale-105' : ''}`}
              />

              {isEditMode && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className="absolute inset-0 cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewImage(null);
                      setHasChanges(true);
                    }}
                    className="relative z-10 bg-white text-destructive px-5 py-2.5 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center space-x-2 shadow-2xl ring-1 ring-black/5 hover:bg-destructive/5 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Trash2 size={16} />
                    <span>Remove Cover</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            isEditMode && (
              <label className="flex flex-col items-center justify-center w-full aspect-[21/9] sm:aspect-[16/7] min-h-[200px] border-b border-border/40 cursor-pointer hover:bg-primary/5 transition-all duration-300 group bg-secondary/10">
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className={`p-4 rounded-2xl mb-4 transition-colors ${uploading ? 'bg-muted' : 'bg-primary/5 group-hover:bg-primary/10 shadow-sm'}`}>
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <p className="text-[12px] font-black text-foreground uppercase tracking-widest">Story Cover Image</p>
                </div>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            )
          )}
        </div>

        {/* Content Section */}
        <div className="p-6 sm:p-10 md:p-14">
          <div className={`mb-12 pb-12 border-b border-border/50 ${isAuthor && status === 'published' ? 'opacity-90' : ''}`}>
            {isEditMode ? (
              <textarea
                placeholder="Enter Story Title..."
                className="w-full text-2xl sm:text-4xl md:text-5xl font-black text-foreground placeholder:text-muted-foreground/30 border-none bg-transparent focus:outline-none resize-none overflow-hidden leading-tight tracking-tighter transition-all"
                rows={1}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />
            ) : (
              <>
                <h1 className="w-full text-3xl md:text-5xl lg:text-6xl font-black text-foreground leading-[1.1] tracking-tighter">
                  {title}
                </h1>
                {!isNew && blog?.authorId && (
                  <div className="flex items-center space-x-4 mt-10">
                    <Avatar className="h-12 w-12 ring-2 ring-primary/10 border-2 border-white shadow-md">
                      <AvatarImage src={blog.authorId?.profilePicture || undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary text-white font-black text-sm uppercase">
                        {blog.authorId?.penName?.[0] || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-base font-black tracking-tight text-foreground">{blog.authorId?.penName}</p>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">{format(new Date(blog.createdAt || Date.now()), 'MMMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-8">
              {isEditMode ? (
                <TagPicker
                  selectedTags={tags}
                  onChange={(newTags) => {
                    setTags(newTags);
                    setHasChanges(true);
                  }}
                  label=""
                  placeholder="Categorize your story..."
                />
              ) : (
                (tags && tags.length > 0) && (
                  <div className="flex flex-wrap gap-2.5">
                    {tags.map((tag: string) => (
                      <span key={tag} className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 bg-secondary/80 rounded-xl text-primary border border-primary/5">
                        {tag}
                      </span>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="prose-edit-zone">
            <TiptapEditor
              initialContent={body}
              onChange={(newBody) => {
                if (JSON.stringify(newBody) === JSON.stringify(body)) return;
                setBody(newBody);
                setHasChanges(true);
              }}
              onSave={() => isEditMode && handleSave(status)}
              setEditor={setEditor}
              readonly={!isEditMode}
            />
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Story?</DialogTitle>
            <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingStatus === 'published' ? 'Publish Story?' : 'Unpublish Story?'}</DialogTitle>
            <DialogDescription>
              {pendingStatus === 'published'
                ? 'This will make your story visible to the public. Ready to share?'
                : 'This will move your story back to drafts and hide it from the public.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant={pendingStatus === 'published' ? 'default' : 'destructive'}
              onClick={() => pendingStatus && handleSave(pendingStatus)}
            >
              {pendingStatus === 'published' ? 'Yes, Publish' : 'Yes, Unpublish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
        <DialogContent className="rounded-2xl p-8">
          <DialogHeader className="flex flex-col items-center text-center">
            <DialogTitle className="text-xl font-black tracking-tight text-foreground">Discard Changes?</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground pt-2 text-sm leading-relaxed">
              You have unsaved progress. Leaving now will lose all work since your last save.
            </DialogDescription>
          </DialogHeader>
          <div className="flex sm:flex-row flex-col gap-3 pt-8 pb-2">
            <Button variant="outline" onClick={() => setBackDialogOpen(false)} className="flex-1 cursor-pointer">
              Keep Editing
            </Button>
            <Button onClick={() => router.back()} className="flex-1 cursor-pointer">
              Discard & Exit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
