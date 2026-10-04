/**
 * Reads a file straight to a base64 data URL, no re-encoding.
 *
 * Unlike imageProcessing's fileToDataUrl, which downscales through a
 * canvas, this keeps the bytes as they are. That matters for video: there
 * is nothing useful to resize on the client, and re-encoding would need a
 * transcoder.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Largest video this project can store for itself.
 *
 * Firestore caps a document at 1 MiB, base64 inflates bytes by about a
 * third, and the same document also carries the slot's title, stack and
 * description. 700 KB of source leaves comfortable room under that
 * ceiling. Firebase Storage would lift the limit entirely but needs the
 * paid plan, so this is the honest maximum on the free tier.
 */
export const MAX_INLINE_VIDEO_BYTES = 700 * 1024;

/**
 * Largest CV this project can store for itself.
 *
 * Same 1 MiB Firestore ceiling and same ~4/3 base64 inflation as the video
 * above, but the CV gets a document to itself (`profile/resume`) rather
 * than sharing one with the bedside photo, so the whole budget is its own:
 * 700 KB of PDF becomes ~933 KB of base64, which fits with room to spare.
 * A text-based CV is a few tens of KB, so this is generous in practice —
 * it only bites on a PDF full of full-bleed images.
 */
export const MAX_INLINE_PDF_BYTES = 700 * 1024;

/**
 * Largest resized image a frame or the bedside photo can store, measured
 * as the data URL itself (that string is what lands in the document).
 *
 * fileToDataUrl already shrinks uploads to 900 px JPEG, which is normally
 * a few hundred kB — but a very detailed or noisy picture can still come
 * out large, and Firestore rejects anything over 1 MiB. Without this check
 * the frame showed the image, the write failed, and it was gone on reload.
 */
export const MAX_INLINE_IMAGE_CHARS = 950 * 1024;

/** Rough original size of a base64 data URL, for display. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const body = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  return Math.round((body.length * 3) / 4);
}
