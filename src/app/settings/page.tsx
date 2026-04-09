"use client"

import { useState, useEffect } from 'react';
import { uploadImageToS3 } from '@/lib/upload';
import TagPicker from '@/components/TagPicker';
import PageContainer from '@/components/PageContainer';
import { Settings, User as UserIcon, Palette, Loader2, Save, Camera, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    penName: '',
    email: '',
    firstName: '',
    lastName: '',
    profilePicture: '',
    interests: [] as string[],
  });

  useEffect(() => {
    fetch('/api/user')
      .then(async res => {
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/';
            return null;
          }
          throw new Error('Failed to fetch user');
        }
        return res.json();
      })
      .then(data => {
        if (!data) return; // Happens if we redirected on 401
        setUser(data);
        setFormData({
          penName: data.penName || '',
          email: data.email || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          profilePicture: data.profilePicture || '',
          interests: data.interests || [],
        });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
      toast.error('Only JPEG, PNG and HEIC images are allowed');
      return;
    }

    if (file.size > maxSizeBytes) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImageToS3(file);
      setFormData({ ...formData, profilePicture: url });
      toast.success('Profile picture uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      toast.success('Settings updated successfully!');
      window.dispatchEvent(new CustomEvent('user-updated'));
    } else { toast.error('Failed to update settings'); }
    setSaving(false);
  };

  const getInitials = (penName: string, firstName: string, lastName: string) => {
    if (penName) {
      return penName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    const fn = firstName?.[0] || '';
    const ln = lastName?.[0] || '';
    return (fn + ln).toUpperCase() || 'A';
  };

  if (loading) return (
    <PageContainer title="Account Settings" icon={<Settings size={20} />}>
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      </div>
    </PageContainer>
  );

  return (
    <PageContainer
      title="Account Settings"
      subtitle="Manage your public profile and preferences."
      icon={<Settings size={20} />}
      action={
        <Button onClick={handleSave} disabled={saving} className="h-11 px-8">
          {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
          {saving ? 'Updating...' : 'Save Changes'}
        </Button>
      }
    >
      <div className="aether-card p-6 sm:p-10 md:p-12">
        <div className="space-y-12">
          {/* Profile Section */}
          <section className="space-y-10">
            <div className="flex items-center space-x-3 text-foreground font-black uppercase tracking-widest text-[11px] pb-4 border-b border-border/50">
              <UserIcon className="w-4 h-4 text-primary" />
              <span>Public Profile</span>
            </div>

            <div className="flex flex-col md:flex-row gap-12 items-start">
              <div className="relative group">
                <Avatar className="h-32 w-32 rounded-[24px] ring-4 ring-white shadow-2xl border border-border/50 p-0.5 bg-white overflow-visible transition-transform duration-500 group-hover:scale-105">
                  <AvatarImage
                    src={formData.profilePicture || undefined}
                    className={`rounded-[22px] object-cover transition-opacity duration-300 ${uploading ? 'opacity-30' : 'opacity-100'}`}
                  />
                  <AvatarFallback className="bg-primary text-white font-black text-2xl rounded-[22px] uppercase">
                    {getInitials(formData.penName, formData.firstName, formData.lastName)}
                  </AvatarFallback>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  )}
                  <label className="absolute -bottom-2 -right-2 p-3 bg-white text-primary rounded-2xl shadow-xl border border-border/50 cursor-pointer hover:bg-secondary/50 transition-[background-color,transform,box-shadow] hover:scale-110 ring-1 ring-border/20">
                    <Camera size={20} strokeWidth={2.5} />
                    <input type="file" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {formData.profilePicture && (
                    <button 
                      onClick={() => setFormData({ ...formData, profilePicture: '' })}
                      className="absolute -top-2 -right-2 p-2 bg-white text-destructive rounded-xl shadow-lg border border-border/50 cursor-pointer hover:bg-destructive/5 transition-all hover:scale-110 ring-1 ring-border/20"
                      title="Remove image"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </Avatar>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8 w-full transition-all">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Pen Name</label>
                  <input
                    name="penName"
                    value={formData.penName}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-xl border border-border/50 bg-secondary/20 font-bold text-foreground focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/30 text-sm"
                    placeholder="WANDERLUST"
                  />
                  <p className="text-[10px] font-bold text-muted-foreground leading-relaxed px-1 italic">This is how you'll be credited on your stories.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Email Address</label>
                  <input
                    name="email"
                    value={formData.email}
                    disabled
                    className="w-full px-5 py-4 rounded-xl border border-border/50 bg-secondary/20 font-bold text-muted-foreground opacity-70 outline-none transition-[border-color,box-shadow,background-color] text-sm cursor-not-allowed lowercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">First Name</label>
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-xl border border-border/50 bg-secondary/20 font-bold text-foreground focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-[border-color,box-shadow,background-color] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Last Name</label>
                  <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-xl border border-border/50 bg-secondary/20 font-bold text-foreground focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-[border-color,box-shadow,background-color] text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Content Section */}
          <section className="space-y-10 pt-4">
            <div className="flex items-center space-x-3 text-foreground font-black uppercase tracking-widest text-[11px] pb-4 border-b border-border/50">
              <Palette className="w-4 h-4 text-primary" />
              <span>Personalization</span>
            </div>
            <div className="relative bg-secondary/20 p-8 rounded-2xl border border-border/50">
              <TagPicker
                selectedTags={formData.interests}
                onChange={(newInterests) => setFormData({ ...formData, interests: newInterests })}
                label="Curate Your Feed"
                placeholder="Select topics you love (Self-Help, Mindfulness, etc.)"
              />
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
