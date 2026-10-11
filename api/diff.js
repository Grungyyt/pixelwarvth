import { getDiff } from './_lib/store.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const since = Number(req.query?.since) || 0;
    const diff = await getDiff(since);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(diff);
  } catch (e) {
    console.error('diff error', e);
    return res.status(500).json({ error: 'internal' });
  }
}
