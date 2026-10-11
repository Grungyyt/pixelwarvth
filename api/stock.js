import { UNLIMITED } from './_lib/config.js';
import { getStock } from './_lib/store.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const clientId = String(req.query?.clientId || '').slice(0, 64);
  if (!clientId) return res.status(400).json({ error: 'missing_clientId' });
  res.setHeader('Cache-Control', 'no-store');
  if (UNLIMITED) return res.status(200).json({ unlimited: true });
  const s = await getStock(clientId);
  return res.status(200).json(s);
}
