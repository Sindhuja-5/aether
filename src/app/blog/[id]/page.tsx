'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
import { isDeepEqual } from '@/lib/utils';
import { Save, Send, Image as ImageIcon, Loader2, PenSquare, Trash2, FileText, ChevronLeft, CheckCircle, Heart, Share2, BookOpen, Eye, Camera } from 'lucide-react';
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import { DeleteBlogDialog } from '@/components/DeleteBlogDialog';
import { PublishDialog } from '@/components/PublishDialog';

export default function BlogRoute() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setDirty } = useNavigationGuard();
  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };
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
  const [initialState, setInitialState] = useState<any>(null);
  const [editor, setEditor] = useState<any>(null);

  const [backDialogOpen, setBackDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'draft' | 'published' | null>(null);
  const [isPreview, setIsPreview] = useState(false);

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
        router.push('/');
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

        setInitialState({
          title: blogData.title || '',
          body: blogData.body,
          previewImage: blogData.previewImage || null,
          tags: blogData.tags || []
        });

        if (Array.isArray(favData) && favData.some((f: any) => (f.blogId?._id === id || f.blogId === id))) {
          setIsFavorited(true);
        }
      } else if (isNew) {
        const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
        setTitle('');
        setBody(emptyDoc);
        setTags([]);
        setPreviewImage(null);
        setInitialState({
          title: '',
          body: emptyDoc,
          previewImage: null,
          tags: []
        });
      } else if (!isNew && (!blogData || blogData.error)) {
        toast.error('Story not found.');
        router.push('/');
      }
      setLoading(false);
    });
  }, [id, isNew, router]);

  const hasChanges = useMemo(() => {
    if (!initialState) return false;
    const currentData = { title, body, previewImage, tags };
    return !isDeepEqual(initialState, currentData);
  }, [initialState, title, body, previewImage, tags]);

  // Sync with global navigation guard
  useEffect(() => {
    setDirty(hasChanges);
    return () => setDirty(false);
  }, [hasChanges, setDirty]);

  const currentUserId = currentUser?._id || currentUser?.id;
  const authorId = blog?.authorId?._id || blog?.authorId;
  const isAuthor = isNew || Boolean(currentUserId && authorId && String(currentUserId) === String(authorId));
  const isPublished = status === 'published';
  // You are in edit mode ONLY IF you are the author AND the post is not published yet AND we aren't in preview.
  const isEditMode = isAuthor && !isPublished && !isPreview;

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
      toast.success('Cover image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async (saveStatus: 'draft' | 'published') => {
    if (!title.trim()) { toast.warning('A story needs a title.'); return; }

    // Quality Checks for Publishing
    if (saveStatus === 'published') {
      if (!tags || tags.length === 0) {
        toast.warning('Please select at least one topic to help others discover your story.');
        return;
      }

      const editorText = editor?.getText().trim() || "";
      if (editorText.length < 20) {
        toast.warning('Your story is a bit short! Add some more depth before publishing.');
        return;
      }
    }

    setSaving(true);
    const content = editor?.getJSON() || body;
    const payload = { title, body: content, previewImage, status: saveStatus, tags };
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? '/api/blogs' : `/api/blogs/${id}`;

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const savedBlog = await res.json();

        if (saveStatus === 'published') {
          toast.success('Story published!');
        } else if (isPublished && saveStatus === 'draft') {
          toast.success('Story unpublished and moved to drafts.');
        } else {
          toast.success('Draft saved.');
        }

        setStatus(savedBlog.status);

        // Update baseline to the current state to clear "dirty" flag
        setInitialState(JSON.parse(JSON.stringify({
          title,
          body: content,
          previewImage,
          tags
        })));
        setDirty(false);

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
    } else if (isAuthor) {
      // If author, always prefer going back to their dashboard
      router.push('/my-blogs');
    } else {
      router.back();
    }
  };

  if (loading) return (
    <PageContainer title="" icon={null}>
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      </div>
    </PageContainer>
  );

  const hasValidTags = tags && tags.length > 0;

  return (
    <PageContainer
      title=""
      icon={null}
      onBack={handleBack}
      action={
        <div className="flex items-center flex-wrap gap-2">
          {currentUser && !isNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFavorite}
              className="h-auto py-1.5 sm:h-9 sm:py-0 cursor-pointer px-3 flex flex-col sm:flex-row items-center gap-1 bg-white border border-border/40 shadow-sm rounded-xl hover:bg-secondary/10"
            >
              <Heart size={14} fill={isFavorited ? "currentColor" : "none"} className={isFavorited ? 'text-primary' : 'text-muted-foreground'} />
              <span className="text-[10px] sm:text-xs font-bold text-foreground">Favorite</span>
            </Button>
          )}

          {isAuthor && !isPublished && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
              className="h-auto py-1.5 sm:h-9 sm:py-0 cursor-pointer px-3 flex flex-col sm:flex-row items-center gap-1 bg-white border border-border/40 shadow-sm rounded-xl hover:bg-secondary/10"
            >
              {isPreview ? (
                <>
                  <PenSquare size={14} className="text-primary" />
                  <span className="text-[10px] sm:text-xs font-bold text-foreground">Resume Editing</span>
                </>
              ) : (
                <>
                  <Eye size={14} className="text-primary" />
                  <span className="text-[10px] sm:text-xs font-bold text-foreground">Reader Preview</span>
                </>
              )}
            </Button>
          )}

          {isAuthor && !isNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-auto py-1.5 sm:h-9 sm:py-0 cursor-pointer px-3 flex flex-col sm:flex-row items-center gap-1 bg-white border border-border/40 shadow-sm rounded-xl hover:bg-secondary/10"
            >
              <Trash2 size={14} className="text-destructive" />
              <span className="text-[10px] sm:text-xs font-bold text-foreground">Delete</span>
            </Button>
          )}

          {isAuthor && isEditMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSave('draft')}
              className="h-auto py-1.5 sm:h-9 sm:py-0 cursor-pointer px-3 flex flex-col sm:flex-row items-center gap-1 bg-white border border-border/40 shadow-sm rounded-xl hover:bg-secondary/10"
            >
              <Save size={14} className="text-primary" />
              <span className="text-[10px] sm:text-xs font-bold text-foreground">Save Draft</span>
            </Button>
          )}

          {isAuthor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (status !== 'published') {
                  if (!title || !String(title).trim()) return toast.warning("Your story needs a Title.");
                  if (!body || !String(body).trim()) return toast.warning("Your story needs some Content.");
                  if (!hasValidTags) return toast.warning("Please select at least one Topic.");
                }
                triggerStatusChange(status === 'published' ? 'draft' : 'published');
              }}
              className="h-auto py-1.5 sm:h-9 sm:py-0 cursor-pointer px-3 flex flex-col sm:flex-row items-center gap-1 bg-white border border-border/40 shadow-sm rounded-xl hover:bg-secondary/10"
            >
              {status === 'published' ? (
                <FileText size={14} className="text-amber-500" />
              ) : (
                <Send size={14} className="text-primary" />
              )}
              <span className="text-[10px] sm:text-xs font-bold text-foreground">
                {status === 'published' ? 'Unpublish' : 'Publish'}
              </span>
            </Button>
          )}
        </div>
      }
    >
      {isAuthor && status === 'published' && (
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-[18px] flex items-center animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="text-sm font-medium text-primary flex items-center">
            <CheckCircle size={16} className="mr-2 shrink-0" />
            This story is published and in read-only mode. Use the Unpublish button above to edit it.
          </p>
        </div>
      )}

      {/* 1. Author Info (Top Level - Only in Preview/Viewer mode) */}
      {!isEditMode && (
        <div className="flex items-center space-x-3 mb-[18px] px-2 animate-in fade-in duration-500">
          <Avatar className="h-8 w-8 border border-border/50 shrink-0">
            <AvatarImage src={blog?.authorId?.profilePicture || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary text-white font-bold text-[10px]">
              {getInitials(blog?.authorId?.penName || blog?.authorId?.firstName || 'A')}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text-xs font-black text-foreground tracking-tight leading-none mb-1">
              {blog?.authorId?.penName || 'Anonymous'}
            </p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              {format(new Date(blog?.createdAt || Date.now()), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      )}

      {/* 2. Topics (Next Layer) */}
      <div className="mb-[18px] px-2">
        {isEditMode ? (
          <TagPicker
            selectedTags={tags}
            onChange={setTags}
            label="Topics"
            placeholder="Choose topics..."
          />
        ) : (
          (tags && tags.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string) => (
                <span key={tag} className="text-[8px] font-black tracking-[0.2em] px-3 py-1 bg-secondary/70 rounded-md text-primary border border-primary/5 uppercase">
                  {tag}
                </span>
              ))}
            </div>
          )
        )}
      </div>

      {/* 3. The Story Box (Container for Title, Cover, Body) */}
      <div className={`aether-card overflow-hidden mb-[18px] ${isEditMode ? "p-5 sm:p-7 md:p-8" : "p-4 sm:p-6 md:p-8"}`}>
        {/* Title */}
        <div className="mb-[18px]">
          {isEditMode ? (
            <textarea
              placeholder="Enter Story Title..."
              className="w-full text-lg sm:text-xl md:text-2xl font-black text-foreground placeholder:text-muted-foreground/30 border-none bg-transparent focus:outline-none resize-none overflow-hidden leading-tight tracking-tight transition-all"
              rows={1}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
            />
          ) : (
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-foreground leading-[1.2] tracking-tight">
              {title}
            </h1>
          )}
        </div>

        {/* Cover Image */}
        {(previewImage || isEditMode) && (
          <div className="relative mb-[18px]">
            <div className="relative rounded-xl overflow-hidden bg-secondary/5">
              {previewImage ? (
                <div className="aspect-video w-full overflow-hidden relative">
                  <img
                    src={previewImage}
                    alt="Story cover"
                    className="w-full h-full object-cover"
                  />
                  {isEditMode && (
                    <div className="absolute top-3 right-3 flex items-center space-x-2 z-30">
                      <label className="p-1.5 bg-white text-primary rounded-lg shadow-lg border border-border/50 cursor-pointer hover:bg-secondary transition-all hover:scale-110 ring-1 ring-border/20">
                        <Camera size={14} strokeWidth={2.5} />
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewImage(null);
                        }}
                        className="p-1.5 bg-white text-destructive rounded-lg shadow-lg border border-border/50 cursor-pointer hover:bg-destructive/5 transition-all hover:scale-110 ring-1 ring-border/20"
                        title="Remove cover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                isEditMode && (
                  <label className="flex flex-col items-center justify-center w-full aspect-video min-h-[150px] cursor-pointer hover:bg-white transition-all duration-300 group bg-secondary/15 overflow-hidden relative">
                    <div className="flex flex-col items-center justify-center p-4 text-center z-10">
                      <div className={`p-2.5 rounded-xl mb-2 transition-all duration-500 ${uploading ? 'bg-muted' : 'bg-white shadow-sm border border-border/50 group-hover:border-primary/30'}`}>
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-primary/40 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <p className="text-[10px] font-black tracking-tight text-foreground uppercase">Add Cover Image</p>
                      <p className="text-[9px] text-muted-foreground mt-2 font-black uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full border border-border/10">
                        Recommended: 16:9
                      </p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )
              )}
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className={`tiptap-content ${isAuthor && status === 'published' ? 'opacity-95' : ''}`}>
          <TiptapEditor
            initialContent={body}
            onChange={setBody}
            onSave={() => isEditMode && handleSave(status)}
            setEditor={setEditor}
            readonly={!isEditMode}
          />
        </div>
      </div>

      <DeleteBlogDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDelete={handleDelete}
        deleting={deleting}
      />

      <PublishDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pendingStatus={pendingStatus}
        onConfirm={handleSave}
      />

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
