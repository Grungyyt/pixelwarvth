// Serveur API local (dev) : même logique que les fonctions Vercel.
// Lance : node server.mjs  (port 3001) puis `npm run dev` dans un 2e terminal.
import http from 'node:http';
import { SIZE, PALETTE } from './api/_lib/config.js';
import { getCanvasFull, getDiff, getStock, consumeStock, applyPixels, getVersion, storeKind, bytesToBase64 } from './api/_lib/store.js';

const PORT = 3001;

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => {
      try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

    if (url.pathname === '/api/health') {
      return send(res, 200, { ok: true, size: SIZE, version: await getVersion(), store: storeKind(), time: Date.now() });
    }
    if (url.pathname === '/api/canvas') {
      const { version, pixels } = await getCanvasFull();
      return send(res, 200, { size: SIZE, palette: PALETTE, version, store: storeKind(), pixels: bytesToBase64(pixels) });
    }
    if (url.pathname === '/api/diff') {
      const since = Number(url.searchParams.get('since')) || 0;
      return send(res, 200, await getDiff(since));
    }
    if (url.pathname === '/api/stock') {
      const clientId = String(url.searchParams.get('clientId') || '');
      if (!clientId) return send(res, 400, { error: 'missing_clientId' });
      return send(res, 200, await getStock(clientId));
    }
    if (url.pathname === '/api/pixels' && req.method === 'POST') {
      const body = await readJson(req);
      const clientId = String(body.clientId || '');
      const pixels = body.pixels;
      if (!clientId || clientId.length < 8) return send(res, 400, { error: 'missing_clientId' });
      if (!Array.isArray(pixels) || !pixels.length || pixels.length > 10) return send(res, 400, { error: 'bad_pixels' });
      const seen = new Map();
      for (const p of pixels) {
        const x = Number(p.x), y = Number(p.y), color = Number(p.color);
        if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(color)) return send(res, 400, { error: 'bad_pixel_format' });
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return send(res, 400, { error: 'out_of_bounds' });
        if (color < 0 || color >= PALETTE.length) return send(res, 400, { error: 'bad_color' });
        seen.set(`${x},${y}`, { x, y, color });
      }
      const clean = [...seen.values()];
      const check = await consumeStock(clientId, clean.length);
      if (!check.ok) return send(res, 429, { error: 'not_enough_stock', ...(await getStock(clientId)) });
      const { version } = await applyPixels(clean);
      return send(res, 200, { ok: true, version, accepted: clean.length, ...(await getStock(clientId)) });
    }
    return send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'internal' });
  }
});

server.listen(PORT, () => console.log(`[api] http://localhost:${PORT} store=${storeKind()} size=${SIZE}`));
