import { SIZE } from './_lib/config.js';
import { getVersion, storeKind } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const version = await getVersion().catch(() => 0);
  return res.status(200).json({ ok: true, size: SIZE, version, store: storeKind(), time: Date.now() });
}
