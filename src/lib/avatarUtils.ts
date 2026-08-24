import { supabase } from "@/integrations/supabase/client";

/**
 * Resizes and compresses an image File using HTML Canvas.
 * Returns a high-quality, lightweight JPEG base64 Data URL.
 */
export async function compressAndResizeImage(
  file: File,
  maxDimension: number = 400,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        // Draw image smooth
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to compressed data URL
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads avatar image file or data URL to Supabase Storage 'avatars' bucket.
 * If storage bucket is not configured, seamlessly falls back to storing compressed data URL.
 */
export async function processAndUploadAvatar(
  userId: string,
  file: File
): Promise<string> {
  // 1. Compress image client-side first
  const compressedDataUrl = await compressAndResizeImage(file, 400, 0.85);

  try {
    // 2. Try Supabase Storage upload
    const fileExt = file.name.split(".").pop() || "jpg";
    const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;
    
    // Convert data URL to Blob for storage upload
    const response = await fetch(compressedDataUrl);
    const blob = await response.blob();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/jpeg",
      });

    if (!uploadError && uploadData?.path) {
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(uploadData.path);

      if (urlData?.publicUrl) {
        return urlData.publicUrl;
      }
    }
  } catch (err) {
    console.warn("Supabase storage upload fallback to Data URL:", err);
  }

  // Fallback to client-side compressed data URL
  return compressedDataUrl;
}
