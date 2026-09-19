import { supabase } from './supabase';

const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const BACKEND_URL = (isLocal && !import.meta.env.VITE_BACKEND_URL?.includes('localhost'))
  ? 'http://localhost:3005/api'
  : (import.meta.env.VITE_BACKEND_URL || 'https://crm.tikovia.vn/api');

/**
 * Upload a file to backend server storage (146GB+) with fallback to Supabase Storage
 */
export async function uploadFile(file: File, folder: string = 'materials'): Promise<{ url: string; name: string; size: number; type: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const cleanBackendUrl = BACKEND_URL.replace(/\/+$/, '');
    const uploadEndpoint = cleanBackendUrl.endsWith('/api') ? `${cleanBackendUrl}/upload/single` : `${cleanBackendUrl}/api/upload/single`;

    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        return {
          url: data.url,
          name: file.name,
          size: file.size,
          type: file.type
        };
      }
    }
  } catch (backendErr) {
    console.warn('Backend upload failed, falling back to Supabase:', backendErr);
  }

  // Fallback to Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('materials')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('materials')
    .getPublicUrl(fileName);

  return {
    url: publicUrl,
    name: file.name,
    size: file.size,
    type: file.type
  };
}
