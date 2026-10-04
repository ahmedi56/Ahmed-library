import * as THREE from 'three';

function createCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

const cache = new Map<string, THREE.CanvasTexture>();

interface WoodOptions {
  base: string;
  grain: string;
  repeat?: [number, number];
  rings?: number;
}

export function getWoodTexture(key: string, { base, grain, repeat = [2, 2], rings = 46 }: WoodOptions) {
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < rings; i++) {
    const y = (i / rings) * size + (Math.random() - 0.5) * 6;
    const amp = 3 + Math.random() * 9;
    ctx.strokeStyle = grain;
    ctx.globalAlpha = 0.035 + Math.random() * 0.08;
    ctx.lineWidth = 0.6 + Math.random() * 1.3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 14) {
      const wobble = Math.sin(x * 0.045 + i * 1.7) * amp * 0.35 + (Math.random() - 0.5) * amp * 0.4;
      ctx.lineTo(x, y + wobble);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

export function getRugTexture() {
  const key = 'rug';
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#a9714f';
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 4) {
    ctx.strokeStyle = i % 8 === 0 ? '#7d4c33' : '#c98f66';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#3d2b1f';
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/**
 * Neutral grain+wear overlay for book covers. Multiplied against each book's
 * own coverColor via material.color, so one cached texture serves every book.
 */
export function getCoverGrainTexture() {
  const key = 'coverGrain';
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d6d2c8';
  ctx.fillRect(0, 0, size, size);

  // Fine leather/cloth grain speckle.
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = Math.random() < 0.5 ? 0 : 255;
    ctx.globalAlpha = 0.03 + Math.random() * 0.05;
    ctx.fillStyle = shade === 0 ? '#3a3226' : '#fffaf0';
    ctx.fillRect(x, y, 1, 1);
  }

  // A few faint creases/scratches.
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#2a241b';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 20, size * 0.7, y + (Math.random() - 0.5) * 20, size, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }

  // Vignette: subtle worn darkening toward the edges/corners.
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(30,22,14,0.28)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/** Same grain canvas, read as a plain (non-sRGB) bump source. */
export function getCoverBumpTexture() {
  const key = 'coverBump';
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.floor(Math.random() * 60) - 30;
    const shade = 128 + v;
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  cache.set(key, texture);
  return texture;
}

/** Stacked-paper look for page-block edges: fine horizontal lines on a cream base. */
export function getPageEdgeTexture() {
  const key = 'pageEdge';
  const cached = cache.get(key);
  if (cached) return cached;

  const w = 32;
  const h = 256;
  const canvas = createCanvas(h);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ece2cc';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 1) {
    if (Math.random() < 0.55) continue;
    ctx.globalAlpha = 0.08 + Math.random() * 0.14;
    ctx.fillStyle = Math.random() < 0.5 ? '#c9bc9c' : '#fffdf5';
    ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/** Readable-paper look for an open page: title + faux paragraph lines on cream stock. */
export function getPageContentTexture(key: string, opts: { title?: string; lines?: number }) {
  const cached = cache.get(key);
  if (cached) return cached;

  const w = 320;
  const h = 400;
  const canvas = createCanvas(h);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f3ead4';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 500; i++) {
    ctx.globalAlpha = 0.02 + Math.random() * 0.03;
    ctx.fillStyle = Math.random() < 0.5 ? '#d8caa0' : '#ffffff';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  ctx.globalAlpha = 1;

  let y = 40;
  if (opts.title) {
    ctx.fillStyle = '#3a2e22';
    ctx.font = '600 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.title, w / 2, y, w * 0.82);
    y += 22;
    ctx.strokeStyle = '#c9a05c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, y);
    ctx.lineTo(w * 0.7, y);
    ctx.stroke();
    y += 30;
  } else {
    y += 24;
  }

  ctx.fillStyle = '#8a8070';
  const lineCount = opts.lines ?? 14;
  for (let i = 0; i < lineCount; i++) {
    const lineW = (0.68 + Math.random() * 0.24) * w * 0.78;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(w * 0.11, y, lineW, 6);
    y += 19;
    if (y > h - 24) break;
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/** Laptop keyboard: a grid of dark keys on the deck, cheap single-texture stand-in for geometry. */
export function getKeyboardTexture() {
  const key = 'keyboard';
  const cached = cache.get(key);
  if (cached) return cached;

  const w = 256;
  const h = 160;
  const canvas = createCanvas(h);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a1b1f';
  ctx.fillRect(0, 0, w, h);

  const cols = 13;
  const rows = 5;
  const gap = 2.2;
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h * 0.82 - gap * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gap + c * (cw + gap);
      const y = gap + r * (ch + gap);
      ctx.fillStyle = '#2b2d33';
      ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, y, cw, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

export function getWallGradientTexture() {
  const key = 'wall';
  const cached = cache.get(key);
  if (cached) return cached;

  const w = 8;
  const h = 256;
  const canvas = createCanvas(h);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#f2ebdc');
  grad.addColorStop(0.5, '#efe7d8');
  grad.addColorStop(1, '#dfd1b6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/**
 * Falloff mask for the window light shaft. The shaft is a single additive
 * plane; with a flat colour and no mask it terminated in a hard straight
 * line at every edge, which is what made it read as a sheet of tinted
 * plastic leaning on the wall rather than light — and what put a crisp
 * horizontal band across the wainscoting where it stopped. Painting the
 * falloff into the texture (bright and wide at the glass, feathered at the
 * sides, fading to black long before the far end) costs one small canvas
 * and leaves the shaft's geometry, placement and blending untouched.
 *
 * Black = no contribution under AdditiveBlending, so this doubles as the
 * alpha ramp without needing a separate alphaMap.
 */
export function getLightShaftTexture() {
  const key = 'lightShaft';
  const cached = cache.get(key);
  if (cached) return cached;

  const w = 64;
  const h = 256;
  const canvas = createCanvas(h);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  // v = 0 is the top of the plane (at the glass), v = 1 the far end.
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    // Bright near the window, easing to nothing before the plane's own edge.
    const lengthFalloff = Math.pow(Math.max(0, 1 - t), 1.25);
    for (let x = 0; x < w; x++) {
      // Soft shoulders across the width, so the beam has no hard sides.
      const u = Math.abs((x / (w - 1)) * 2 - 1);
      const edgeFalloff = Math.pow(Math.max(0, 1 - u), 0.85);
      const v = Math.round(255 * lengthFalloff * edgeFalloff);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}


/**
 * The phone's screen: a small balance figure over a bar chart.
 *
 * A bare phone says "mobile app" and nothing more. Spendora is a finance
 * app, and the point of tying an object to a project is that the link
 * should be obvious without explanation — so the screen has to say
 * "money", not just "phone". Drawn once and cached, never per frame.
 */
export function getPhoneFinanceTexture() {
  const key = 'phoneFinance';
  const cached = cache.get(key);
  if (cached) return cached;

  const w = 220;
  const h = 440;
  const canvas = createCanvas(h);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0e1622';
  ctx.fillRect(0, 0, w, h);

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#6f89a8';
  ctx.font = '500 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Balance', 22, 54);

  ctx.fillStyle = '#eef3f8';
  ctx.font = '600 38px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('1 248', 20, 76);
  ctx.fillStyle = '#7bd88f';
  ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('+ 6.2%', 22, 124);

  // Spending bars: uneven on purpose, so it reads as data rather than decoration.
  const bars = [0.42, 0.68, 0.35, 0.86, 0.54, 0.74, 0.29];
  const baseY = 300;
  const barW = 18;
  const gap = 8;
  const startX = 22;
  bars.forEach((v, i) => {
    const bh = Math.round(v * 120);
    ctx.fillStyle = i === 3 ? '#7bd88f' : '#2c4val';
    ctx.fillStyle = i === 3 ? '#7bd88f' : '#2c4256';
    ctx.fillRect(startX + i * (barW + gap), baseY - bh, barW, bh);
  });

  ctx.strokeStyle = 'rgba(111,137,168,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, baseY + 6);
  ctx.lineTo(w - 20, baseY + 6);
  ctx.stroke();

  // A couple of transaction rows.
  [
    ['Groceries', '-24.90'],
    ['Transport', '-6.40'],
  ].forEach(([label, amount], i) => {
    const y = baseY + 30 + i * 34;
    ctx.fillStyle = '#c3cfdb';
    ctx.font = '500 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(label, 22, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8fa2b5';
    ctx.fillText(amount, w - 22, y);
    ctx.textAlign = 'left';
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}
