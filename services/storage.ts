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

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
};

export const uploadImage = async (fileOrBase64: File | string, bucket: string = 'game-assets'): Promise<string | null> => {
  try {
    let file: File | Blob;
    let fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    if (typeof fileOrBase64 === 'string') {
      if (!fileOrBase64.startsWith('data:')) return fileOrBase64; // Already a URL
      file = base64ToBlob(fileOrBase64);
      fileName += '.jpg'; // Assume jpg for base64 conversions usually
    } else {
      file = fileOrBase64;
      fileName += `-${fileOrBase64.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
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

      // Fallback: keep the app functional even without bucket setup.
      if (typeof fileOrBase64 === 'string') return fileOrBase64;
      return await readFileAsDataUrl(fileOrBase64);
    }

    // 2. Get Public URL
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicData.publicUrl;

  } catch (e) {
    console.error("Upload exception", e);
    if (typeof fileOrBase64 === 'string') return fileOrBase64;
    try {
      return await readFileAsDataUrl(fileOrBase64);
    } catch {
      return null;
    }
  }
};
