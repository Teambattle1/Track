
import { supabase } from '../lib/supabase';

// Helper to convert base64 to Blob
const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const uploadImage = async (fileOrBase64: File | string, bucket: string = 'game-assets'): Promise<string | null> => {
  try {
    let file: File | Blob;
    let fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    if (typeof fileOrBase64 === 'string') {
      if (!fileOrBase64.startsWith('data:')) return fileOrBase64; // Already a URL
      file = base64ToBlob(fileOrBase64);
      fileName += '.jpg';
    } else {
      file = fileOrBase64;
      fileName += `-${fileOrBase64.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
      return null;
    }

    // 1. Attempt upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.warn("Storage upload failed (bucket might not exist), falling back to Base64 logic", error);
      // Fallback: Return the Base64 string if upload fails (so app still works without bucket setup)
      // Ideally, we compress it here if possible, but for now we just return null to signal "use default" or return the string
      if (typeof fileOrBase64 === 'string') return fileOrBase64;
      return null; 
    }

    // 2. Get Public URL
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicData.publicUrl;

  } catch (e) {
    console.error("Upload exception", e);
    return typeof fileOrBase64 === 'string' ? fileOrBase64 : null;
  }
};
