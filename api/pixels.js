import { SIZE, PALETTE, MAX_PIXELS_PER_REQUEST, UNLIMITED } from './_lib/config.js';
import { consumeStock, applyPixels, getStock } from './_lib/store.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

// POST /api/pixels { clientId, pixels: [{x,y,color}] }
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = readBody(req);
  const clientId = String(body.clientId || '').slice(0, 64);
  const pixels = body.pixels;

  if (!clientId || clientId.length < 8) return res.status(400).json({ error: 'missing_clientId' });
  if (!Array.isArray(pixels) || pixels.length === 0 || pixels.length > MAX_PIXELS_PER_REQUEST) {
    return res.status(400).json({ error: 'bad_pixels', max: MAX_PIXELS_PER_REQUEST });
  }

  // validation + dédup (dernier pixel gagne si doublon dans le batch)
  const seen = new Map();
  for (const p of pixels) {
    const x = Number(p.x), y = Number(p.y), color = Number(p.color);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(color)) {
      return res.status(400).json({ error: 'bad_pixel_format' });
    }
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return res.status(400).json({ error: 'out_of_bounds' });
    if (color < 0 || color >= PALETTE.length) return res.status(400).json({ error: 'bad_color' });
    seen.set(`${x},${y}`, { x, y, color });
  }
  const clean = [...seen.values()];

  if (!UNLIMITED) {
    const check = await consumeStock(clientId, clean.length);
    if (!check.ok) {
      const s = await getStock(clientId);
      return res.status(429).json({ error: 'not_enough_stock', ...s });
    }
  }

  try {
    const { version } = await applyPixels(clean);
    if (UNLIMITED) return res.status(200).json({ ok: true, version, accepted: clean.length, unlimited: true });
    const s = await getStock(clientId);
    return res.status(200).json({ ok: true, version, accepted: clean.length, ...s });
  } catch (e) {
    console.error('pixels error', e);
    return res.status(500).json({ error: 'internal' });
  }
}
