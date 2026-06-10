'use client';

import { useRef, useState } from 'react';

import { useUserContext } from '@/contexts/UserContext';
import { createClient, hasSupabaseClientEnv } from '@/lib/supabase/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 4 * 1024 * 1024;

export function useAvatarUpload() {
  const { currentUser, refreshUser } = useUserContext();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, WebP and GIF images are supported.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Image must be smaller than 4 MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      if (!hasSupabaseClientEnv()) {
        throw new Error('Supabase environment variables are missing in the current deployment.');
      }

      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `icecream_erp/${authUser.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `Failed to save avatar (${res.status})`);
      }

      await refreshUser?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return {
    avatarUrl: currentUser?.profile?.avatarUrl ?? null,
    error,
    handleFileChange,
    inputRef,
    openPicker,
    uploading,
  };
}
