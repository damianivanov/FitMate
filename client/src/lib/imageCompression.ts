// Downscales and re-encodes an image in the browser before upload.
//
// Uploading a full-resolution photo (often 4-8 MB) frequently fails in production:
// the reverse proxy / ingress in front of the API rejects or resets the request body
// before it reaches the app, which surfaces in the browser as a generic "Network Error".
// The server already clamps stored images to ~1200px, so shrinking client-side loses no
// quality that the server wouldn't drop anyway — it just makes the upload small enough to
// get through. Any failure falls back to the original file so creation never gets worse.

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImageForUpload(file: File): Promise<File> {
  // Skip anything we can't safely re-encode on a canvas: non-images and GIFs
  // (re-encoding would flatten an animation to a single frame).
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longestEdge > MAX_EDGE_PX ? MAX_EDGE_PX / longestEdge : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // Preserve transparency for PNGs; everything else encodes to JPEG (universally
    // supported by canvas.toBlob and far smaller for photos).
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, JPEG_QUALITY),
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const extension = outputType === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^./\\]+$/, "") || "image";
    return new File([blob], `${baseName}.${extension}`, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
