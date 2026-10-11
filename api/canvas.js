import { SIZE, PALETTE } from './_lib/config.js';
import { getCanvasFull, storeKind, bytesToBase64 } from './_lib/store.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { version, pixels } = await getCanvasFull();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      size: SIZE,
      palette: PALETTE,
      version,
      store: storeKind(),
      pixels: bytesToBase64(pixels),
    });
  } catch (e) {
    console.error('canvas error', e);
    return res.status(500).json({ error: 'internal' });
  }
}
