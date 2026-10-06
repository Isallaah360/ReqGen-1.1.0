/**
 * ReqGen v3.1.5 — Signature Ink Engine.
 *
 * Signatures are usually photographed or scanned on paper, so the stored image
 * carries a grey/green paper background, shadows and a lot of empty space.
 * Printed on a request or voucher, that background covers the document text.
 *
 * This engine keeps ONLY the ink:
 *   1. estimates the paper brightness locally (handles uneven lighting and
 *      shadows across a phone photo) on a coarse grid;
 *   2. turns every pixel into ink opacity by how much darker it is than the
 *      paper around it (soft edges, so strokes stay smooth);
 *   3. deepens the ink colour so blue and black pens print crisply;
 *   4. trims the empty space around the signature, so every signature is drawn
 *      at the same visual size in its signature box.
 *
 * Results are cached per source, so each signature is processed once per page.
 * The engine runs in the browser (canvas). If an image cannot be processed
 * (e.g. a storage host without CORS), callers fall back to the original image
 * drawn with a "multiply" blend, which still hides a light background.
 */

export type InkResult = {
  /** Transparent PNG (data URL) containing only the ink, trimmed. */
  url: string;
  width: number;
  height: number;
};

export type InkOptions = {
  /** Longest side of the working image in pixels (default 1000). */
  maxSide?: number;
  /** Padding kept around the trimmed ink, in pixels (default 6). */
  padding?: number;
};

const cache = new Map<string, Promise<InkResult>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Signature image could not be loaded."));
    img.src = src;
  });
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Core pixel pass. Exported for tests and for upload-time cleaning. */
export function inkFromImageData(source: ImageData, padding = 6): ImageData | null {
  const { width: w, height: h, data } = source;
  if (!w || !h) return null;

  // Luminance per pixel.
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; p < lum.length; i += 4, p++) {
    // Transparent pixels in an already-clean PNG count as paper.
    lum[p] = data[i + 3] < 16 ? 255 : 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Local paper brightness: 85th percentile luminance per block (ink is the
  // minority of any block), then bilinear interpolation between block centres.
  const block = Math.max(16, Math.round(Math.max(w, h) / 24));
  const gx = Math.ceil(w / block);
  const gy = Math.ceil(h / block);
  const paper = new Float32Array(gx * gy);
  const hist = new Uint32Array(256);
  for (let by = 0; by < gy; by++) {
    for (let bx = 0; bx < gx; bx++) {
      hist.fill(0);
      let count = 0;
      const x1 = Math.min(w, (bx + 1) * block);
      const y1 = Math.min(h, (by + 1) * block);
      for (let y = by * block; y < y1; y++) {
        for (let x = bx * block; x < x1; x++) {
          hist[Math.round(lum[y * w + x])]++;
          count++;
        }
      }
      const target = count * 0.85;
      let acc = 0;
      let level = 255;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (acc >= target) { level = v; break; }
      }
      paper[by * gx + bx] = Math.max(level, 40);
    }
  }

  const paperAt = (x: number, y: number) => {
    const fx = Math.min(gx - 1, Math.max(0, (x + 0.5) / block - 0.5));
    const fy = Math.min(gy - 1, Math.max(0, (y + 0.5) / block - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(gx - 1, x0 + 1);
    const y1 = Math.min(gy - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = paper[y0 * gx + x0];
    const b = paper[y0 * gx + x1];
    const c = paper[y1 * gx + x0];
    const d = paper[y1 * gx + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  // Ink opacity from relative darkness. A small border margin is ignored so
  // paper edges and table shadows in phone photos are not mistaken for ink.
  const margin = Math.round(Math.min(w, h) * 0.015);
  const out = new ImageData(w, h);
  const od = out.data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  const rowInk = new Uint32Array(h);
  const colInk = new Uint32Array(w);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (x < margin || y < margin || x >= w - margin || y >= h - margin) continue;
      const bg = paperAt(x, y);
      const darkness = (bg - lum[p]) / bg;
      const alpha = smoothstep(0.12, 0.36, darkness);
      if (alpha <= 0.02) continue;

      // Deepen the ink: keep its hue, pull its brightness down so it prints crisply.
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b, 1);
      const scale = Math.min(1, 95 / max);
      od[i] = Math.round(r * scale);
      od[i + 1] = Math.round(g * scale);
      od[i + 2] = Math.round(b * scale);
      // Strokes are boosted so thin pen lines stay legible at print size.
      od[i + 3] = Math.round(255 * Math.min(1, alpha * 1.5));

      if (alpha > 0.5) {
        rowInk[y]++;
        colInk[x]++;
      }
    }
  }

  // Trim to the ink, ignoring sparse noise rows/columns.
  const rowMin = Math.max(1, Math.round(w * 0.002));
  const colMin = Math.max(1, Math.round(h * 0.004));
  for (let y = 0; y < h; y++) if (rowInk[y] >= rowMin) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let x = 0; x < w; x++) if (colInk[x] >= colMin) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  if (maxX < 0 || maxY < 0) return null;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w - 1, maxX + padding);
  maxY = Math.min(h - 1, maxY + padding);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = new ImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    const from = ((minY + y) * w + minX) * 4;
    cropped.data.set(od.subarray(from, from + cw * 4), y * cw * 4);
  }
  return cropped;
}

function drawToCanvas(img: CanvasImageSource, width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const cw = Math.max(1, Math.round(width * scale));
  const ch = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
  return { canvas, ctx, cw, ch };
}

function imageDataToCanvas(imageData: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function runInk(src: string, options: InkOptions): Promise<InkResult> {
  const img = await loadImage(src);
  const { ctx, cw, ch } = drawToCanvas(img, img.naturalWidth, img.naturalHeight, options.maxSide ?? 1000);
  const ink = inkFromImageData(ctx.getImageData(0, 0, cw, ch), options.padding ?? 6);
  if (!ink) throw new Error("No signature ink was found in the image.");
  const canvas = imageDataToCanvas(ink);
  return { url: canvas.toDataURL("image/png"), width: ink.width, height: ink.height };
}

/** Clean a stored signature for display/print. Cached per source URL. */
export function extractSignatureInk(src: string, options: InkOptions = {}): Promise<InkResult> {
  const key = `${src}|${options.maxSide ?? 1000}|${options.padding ?? 6}`;
  let job = cache.get(key);
  if (!job) {
    job = runInk(src, options);
    job.catch(() => cache.delete(key));
    cache.set(key, job);
  }
  return job;
}

/**
 * Clean a signature FILE before upload (Profile page). Returns a transparent,
 * trimmed PNG file ready to store, or throws when no ink can be found.
 */
export async function cleanSignatureFile(file: File, options: InkOptions = {}): Promise<{ file: File; previewUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { ctx, cw, ch } = drawToCanvas(img, img.naturalWidth, img.naturalHeight, options.maxSide ?? 900);
    const ink = inkFromImageData(ctx.getImageData(0, 0, cw, ch), options.padding ?? 8);
    if (!ink) throw new Error("No signature ink was found. Sign with a dark pen on plain paper and try again.");
    const canvas = imageDataToCanvas(ink);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The cleaned signature could not be created.");
    const base = file.name.replace(/\.[^.]+$/, "") || "signature";
    return { file: new File([blob], `${base}-clean.png`, { type: "image/png" }), previewUrl: canvas.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
