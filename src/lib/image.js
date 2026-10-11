import { PALETTE, hexToRgb } from './palette';

export const MAX_IMPORT_W = 256;
export const MAX_IMPORT_H = 256;
export const TRANSPARENT = 255;

const RGB = PALETTE.map(hexToRgb);

function nearest(r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < RGB.length; i++) {
    const dr = r - RGB[i][0];
    const dg = g - RGB[i][1];
    const db = b - RGB[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function loadFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ img, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image illisible'));
    };
    img.src = url;
  });
}

// Redimensionne + quantifie vers la palette. Les pixels quasi-transparents -> TRANSPARENT (ignorés).
export function convertImage(img, w, h) {
  w = Math.max(1, Math.min(MAX_IMPORT_W, Math.round(w)));
  h = Math.max(1, Math.min(MAX_IMPORT_H, Math.round(h)));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const indices = new Uint8Array(w * h);
  let opaque = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    if (a < 128) {
      indices[i] = TRANSPARENT;
    } else {
      indices[i] = nearest(r, g, b);
      opaque++;
    }
  }
  // aperçu
  const pv = document.createElement('canvas');
  pv.width = w;
  pv.height = h;
  const pctx = pv.getContext('2d');
  const out = pctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    if (indices[i] === TRANSPARENT) {
      out.data[i * 4 + 3] = 0;
    } else {
      const [r, g, b] = RGB[indices[i]];
      out.data[i * 4] = r;
      out.data[i * 4 + 1] = g;
      out.data[i * 4 + 2] = b;
      out.data[i * 4 + 3] = 255;
    }
  }
  pctx.putImageData(out, 0, 0);
  return { w, h, indices, opaque, previewUrl: pv.toDataURL() };
}

export function fitRatio(srcW, srcH, targetW) {
  return Math.max(1, Math.round((srcH * targetW) / srcW));
}

// Uint8Array <-> base64 (par morceaux, pas de stack overflow)
export function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// minutes restantes au rythme 10 pixels / 30s
export function etaText(remaining) {
  const sec = Math.ceil(remaining * 3);
  if (sec < 60) return `${sec} sec`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, '0')}`;
}
