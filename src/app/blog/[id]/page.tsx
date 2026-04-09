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
import { Save, Send, Image as ImageIcon, Loader2, PenSquare, Trash2, FileText, ChevronLeft, CheckCircle, Heart, Share2, BookOpen, Eye } from 'lucide-react';
import { useNavigationGuard } from '@/context/NavigationGuardContext';

export default function BlogRoute() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setDirty } = useNavigationGuard();
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
        window.location.href = '/';
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
    } else {
      if (window.history.length > 2) {
        router.back();
      } else {
        router.push(isEditMode ? '/my-blogs' : '/');
      }
    }
  };

  if (loading) return (
    <PageContainer title="" icon={null}>
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      </div>
    </PageContainer>
  );

  const isPublishable = Boolean(title && String(title).trim() !== '' && body && String(body).trim() !== '');
  const hasValidTags = tags && tags.length > 0;

  return (
    <PageContainer
      title=""
      icon={null}
      onBack={handleBack}
      action={
        <div className="flex items-center space-x-2 bg-secondary/30 p-1 rounded-xl border border-border/50">
          {currentUser && !isAuthor && !isNew && (
            <Button variant="ghost" size="sm" onClick={toggleFavorite} className="h-9 cursor-pointer px-3">
              <Heart size={14} fill={isFavorited ? "currentColor" : "none"} className={`mr-2 ${isFavorited ? 'text-primary' : ''}`} />
              Favorite
            </Button>
          )}

          {isAuthor && !isPublished && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
              className="h-9 cursor-pointer px-3 text-primary hover:bg-primary/5"
            >
              {isPreview ? (
                <><PenSquare size={14} className="mr-2" /> Resume Editing</>
              ) : (
                <><Eye size={14} className="mr-2" /> Reader Preview</>
              )}
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
                <Button variant="ghost" size="sm" onClick={() => handleSave('draft')} className="h-9 cursor-pointer px-3">
                  <Save size={14} className="mr-2" />
                  Save Draft
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (status !== 'published') {
                    if (!title || !String(title).trim()) return toast.warning("Your story needs a Title.");
                    if (!body || !String(body).trim()) return toast.warning("Your story needs some Content.");
                    if (!hasValidTags) return toast.warning("Please select at least one Topic.");
                  }
                  triggerStatusChange(status === 'published' ? 'draft' : 'published');
                }}
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
            <div className={`relative w-full aspect-video min-h-[250px] overflow-hidden bg-black/5 ${isEditMode ? 'cursor-pointer' : ''}`}>
              <img
                src={previewImage}
                alt="Cover"
                className={`w-full h-full object-cover object-[center_30%] transition-all duration-1000 ${isEditMode ? 'group-hover:scale-105' : ''}`}
              />

              {isEditMode && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className="absolute inset-0 cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>

                  <div className="flex flex-col items-center">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPreviewImage(null);
                      }}
                      className="relative z-10 bg-white text-destructive px-4 py-2 rounded-xl font-black tracking-widest text-[10px] flex items-center space-x-2 shadow-2xl ring-1 ring-black/5 hover:bg-destructive/5 transition-all hover:scale-105 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                    <span className="mt-2 text-[10px] text-white/80 font-medium bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
                      Recommended: 16:9 Widescreen
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            isEditMode && (
              <label className="flex flex-col items-center justify-center w-full aspect-video min-h-[250px] cursor-pointer hover:bg-white transition-all duration-300 group bg-secondary/20 overflow-hidden relative border border-border">
                <div className="flex flex-col items-center justify-center p-6 text-center z-10">
                  <div className={`p-4 rounded-3xl mb-4 transition-all duration-500 ${uploading ? 'bg-muted' : 'bg-white shadow-sm border border-border/50 group-hover:border-primary/30 group-hover:shadow-md'}`}>
                    {uploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-primary/40 group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground">Click to upload story cover</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 font-medium bg-white/50 px-3 py-1 rounded-full border border-border/20">
                    Recommended: 16:9 Widescreen
                  </p>
                </div>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            )
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 sm:p-5 md:p-6">
          <div className={`mb-6 ${isAuthor && status === 'published' ? 'opacity-90' : ''}`}>
            {isEditMode ? (
              <textarea
                placeholder="Enter Story Title..."
                className="w-full text-2xl sm:text-3xl md:text-4xl font-bold text-foreground placeholder:text-muted-foreground/30 border-none bg-transparent focus:outline-none resize-none overflow-hidden leading-tight tracking-tight transition-all"
                rows={1}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />
            ) : (
              <>
                <h1 className="w-full text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-[1.1] tracking-tight">
                  {title}
                </h1>
                {!isNew && blog?.authorId && (
                  <div className="flex items-center space-x-3 mt-6">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/5 border border-white shadow-sm rounded-full">
                      <AvatarImage src={blog.authorId?.profilePicture || undefined} className="object-cover rounded-full" />
                      <AvatarFallback className="bg-primary text-white font-black text-xs uppercase rounded-full">
                        {blog.authorId?.penName?.[0] || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold tracking-tight text-foreground">{blog.authorId?.penName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">{format(new Date(blog.createdAt || Date.now()), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-5">
              {isEditMode ? (
                <TagPicker
                  selectedTags={tags}
                  onChange={(newTags) => {
                    setTags(newTags);
                  }}
                  label="Story Topics"
                  placeholder="Choose topics (Design, Tech, Life...)"
                />
              ) : (
                (tags && tags.length > 0) && (
                  <div className="flex flex-wrap gap-2.5">
                    {tags.map((tag: string) => (
                      <span key={tag} className="text-[10px] font-black tracking-[0.2em] px-4 py-2 bg-secondary/80 rounded-xl text-primary border border-primary/5">
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
