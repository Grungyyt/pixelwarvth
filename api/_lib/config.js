// Config partagée front/back (dupliquée côté front dans src/lib/palette.js)
export const SIZE = 1024;
export const PIXEL_COUNT = SIZE * SIZE;

// Palette 16 couleurs style r/place (index 0 = blanc = fond initial)
export const PALETTE = [
  '#FFFFFF', // 0 white
  '#E4E4E4', // 1 light gray
  '#888888', // 2 gray
  '#222222', // 3 black
  '#FFA7D1', // 4 pink
  '#E50000', // 5 red
  '#E59500', // 6 orange
  '#A06A42', // 7 brown
  '#E5D900', // 8 yellow
  '#94E044', // 9 light green
  '#02BE01', // 10 green
  '#00D3DD', // 11 cyan
  '#0083C7', // 12 blue
  '#0000EA', // 13 dark blue
  '#CF6EE4', // 14 purple
  '#820080', // 15 dark purple
];

// Stock : désactivé (pixels illimités). Pour réactiver la limite,
// mets UNLIMITED = false (10 max, +1 toutes les 3s = 10 / 30s).
export const UNLIMITED = true;
export const MAX_STOCK = 10;
export const REFILL_INTERVAL_MS = 3000; // 1 pixel / 3s
export const REFILL_AMOUNT = 1;

export const MAX_PIXELS_PER_REQUEST = 4096;
export const DIFF_LOG_CAP = 20000;
export const CHUNK_COUNT = 64; // 64 chunks x 16 lignes x 1024 = 1Mo total
export const ROWS_PER_CHUNK = SIZE / CHUNK_COUNT;
