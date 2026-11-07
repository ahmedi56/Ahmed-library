/**
 * Turns a photo into a warm, painted-looking portrait for the basement
 * (BasementScene), on a canvas, in the browser.
 *
 * A photograph hung in this room reads as pasted in: everything else is
 * soft, flat-shaded and warm. A Kuwahara filter — each pixel takes the mean
 * of whichever neighbouring quadrant varies least — flattens a photo into
 * the broad, edge-keeping patches of an oil painting. It runs on a small
 * copy (fast, and the coarseness is the brushwork), which is then scaled up
 * smoothly and given a warm grade, canvas grain and a vignette.
 */

const OUT_W = 512;
const OUT_H = 640;
// Working size for the filter: a 4:5 portrait, small enough to filter in a
// few milliseconds, large enough to keep a face recognisable.
const WORK_W = 192;
const WORK_H = 240;
const RADIUS = 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draws `img` to cover w×h, cropped to the centre, slightly favouring the top (faces). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) * 0.3, dw, dh);
}

function kuwahara(src: ImageData): ImageData {
  const { width: w, height: h, data } = src;
  const out = new ImageData(w, h);
  const quads: [number, number][] = [
    [-RADIUS, -RADIUS],
    [0, -RADIUS],
    [-RADIUS, 0],
    [0, 0],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity;
      let br = 0;
      let bg = 0;
      let bb = 0;
      for (const [qx, qy] of quads) {
        let r = 0;
        let g = 0;
        let b = 0;
        let lum = 0;
        let lum2 = 0;
        let n = 0;
        for (let j = 0; j <= RADIUS; j++) {
          const yy = Math.min(h - 1, Math.max(0, y + qy + j));
          for (let i = 0; i <= RADIUS; i++) {
            const xx = Math.min(w - 1, Math.max(0, x + qx + i));
            const k = (yy * w + xx) * 4;
            const l = data[k] * 0.3 + data[k + 1] * 0.59 + data[k + 2] * 0.11;
            r += data[k];
            g += data[k + 1];
            b += data[k + 2];
            lum += l;
            lum2 += l * l;
            n++;
          }
        }
        const mean = lum / n;
        const variance = lum2 / n - mean * mean;
        if (variance < best) {
          best = variance;
          br = r / n;
          bg = g / n;
          bb = b / n;
        }
      }
      const o = (y * w + x) * 4;
      out.data[o] = br;
      out.data[o + 1] = bg;
      out.data[o + 2] = bb;
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Warm grade, canvas grain and vignette, over the whole portrait. */
function finish(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = '#c98a4a';
  ctx.fillRect(0, 0, OUT_W, OUT_H);
  ctx.globalCompositeOperation = 'source-over';

  // Canvas weave: faint crossing lines, the texture of a painted surface.
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#2a1a0d';
  for (let i = 0; i < OUT_W; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, OUT_H);
    ctx.stroke();
  }
  for (let i = 0; i < OUT_H; i += 3) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(OUT_W, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const v = ctx.createRadialGradient(OUT_W / 2, OUT_H * 0.42, OUT_W * 0.25, OUT_W / 2, OUT_H / 2, OUT_W * 0.85);
  v.addColorStop(0, 'rgba(30,18,8,0)');
  v.addColorStop(1, 'rgba(30,18,8,0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, OUT_W, OUT_H);
}

/** No photo uploaded: a painted silhouette with initials, in the same style. */
function placeholder(ctx: CanvasRenderingContext2D, initials: string) {
  const bg = ctx.createLinearGradient(0, 0, 0, OUT_H);
  bg.addColorStop(0, '#6b4a2e');
  bg.addColorStop(1, '#3a2616');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, OUT_W, OUT_H);
  ctx.fillStyle = '#2a1a0f';
  ctx.beginPath();
  ctx.arc(OUT_W / 2, OUT_H * 0.4, OUT_W * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(OUT_W / 2, OUT_H * 0.98, OUT_W * 0.38, OUT_H * 0.32, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#c9a05c';
  ctx.font = `600 ${Math.round(OUT_W * 0.12)}px Fraunces, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(initials, OUT_W / 2, OUT_H * 0.44);
}

/**
 * The painted portrait as a canvas, ready for a CanvasTexture. Falls back
 * to the silhouette if there's no photo or it can't be read.
 */
export async function paintPortrait(photo: string | null, initials: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d')!;

  try {
    if (!photo) throw new Error('no photo');
    const img = await loadImage(photo);
    const work = document.createElement('canvas');
    work.width = WORK_W;
    work.height = WORK_H;
    const wctx = work.getContext('2d')!;
    drawCover(wctx, img, WORK_W, WORK_H);
    wctx.putImageData(kuwahara(wctx.getImageData(0, 0, WORK_W, WORK_H)), 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(work, 0, 0, OUT_W, OUT_H);
  } catch {
    placeholder(ctx, initials);
  }
  finish(ctx);
  return canvas;
}
