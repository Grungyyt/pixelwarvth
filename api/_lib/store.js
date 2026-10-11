import {
  SIZE,
  PIXEL_COUNT,
  MAX_STOCK,
  REFILL_INTERVAL_MS,
  REFILL_AMOUNT,
  DIFF_LOG_CAP,
  CHUNK_COUNT,
  ROWS_PER_CHUNK,
} from './config.js';

// ---------------------------------------------------------------------------
// Store pluggable : Upstash Redis en prod (Vercel), mémoire en dev local.
// Sur Vercel sans Redis, les lambdas sont stateless -> les pixels ne sont
// PAS partagés. Il faut donc créer un store Redis (gratuit) : voir README.
// ---------------------------------------------------------------------------

function hasRedisEnv() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  );
}

let redisClient = null;
async function getRedis() {
  if (redisClient) return redisClient;
  if (!hasRedisEnv()) return null;
  const { Redis } = await import('@upstash/redis');
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  redisClient = new Redis({ url, token });
  return redisClient;
}

export function storeKind() {
  return hasRedisEnv() ? 'redis' : 'memory';
}

// ------------------------------- Memory ------------------------------------
function mem() {
  if (!globalThis.__PIXELWAR__) {
    globalThis.__PIXELWAR__ = {
      pixels: new Uint8Array(PIXEL_COUNT), // 0 = blanc partout
      version: 0,
      changes: [], // [{x,y,c,v}] capped
      stocks: new Map(), // clientId -> {tokens, last}
    };
  }
  return globalThis.__PIXELWAR__;
}

function refillTokens(stock, now) {
  if (stock.tokens >= MAX_STOCK) {
    stock.last = now;
    return stock;
  }
  const elapsed = now - stock.last;
  if (elapsed < REFILL_INTERVAL_MS) return stock;
  const n = Math.floor(elapsed / REFILL_INTERVAL_MS) * REFILL_AMOUNT;
  if (n > 0) {
    stock.tokens = Math.min(MAX_STOCK, stock.tokens + n);
    stock.last += Math.floor(elapsed / REFILL_INTERVAL_MS) * REFILL_INTERVAL_MS;
    if (stock.tokens >= MAX_STOCK) stock.last = now;
  }
  return stock;
}

export async function getStock(clientId) {
  const now = Date.now();
  if (!hasRedisEnv()) {
    const m = mem();
    let s = m.stocks.get(clientId);
    if (!s) {
      s = { tokens: MAX_STOCK, last: now };
      m.stocks.set(clientId, s);
    }
    refillTokens(s, now);
    return {
      stock: s.tokens,
      max: MAX_STOCK,
      refillIntervalMs: REFILL_INTERVAL_MS,
      refillInMs: s.tokens >= MAX_STOCK ? 0 : Math.max(0, REFILL_INTERVAL_MS - (now - s.last)),
    };
  }
  const redis = await getRedis();
  const key = `pw:stock:${clientId}`;
  const raw = await redis.get(key);
  let s;
  try {
    s = raw ? JSON.parse(raw) : null;
  } catch {
    s = null;
  }
  if (!s || typeof s.tokens !== 'number') s = { tokens: MAX_STOCK, last: now };
  refillTokens(s, now);
  return {
    stock: s.tokens,
    max: MAX_STOCK,
    refillIntervalMs: REFILL_INTERVAL_MS,
    refillInMs: s.tokens >= MAX_STOCK ? 0 : Math.max(0, REFILL_INTERVAL_MS - (now - s.last)),
    _raw: s,
    _now: now,
  };
}

async function saveStock(clientId, s, now) {
  if (!hasRedisEnv()) {
    mem().stocks.set(clientId, s);
    return;
  }
  const redis = await getRedis();
  await redis.set(`pw:stock:${clientId}`, JSON.stringify({ tokens: s.tokens, last: s.last }), { ex: 86400 });
}

// Retourne { ok, stock } ou { ok:false, reason, stock }
export async function consumeStock(clientId, n) {
  const now = Date.now();
  if (!hasRedisEnv()) {
    const m = mem();
    let s = m.stocks.get(clientId);
    if (!s) {
      s = { tokens: MAX_STOCK, last: now };
      m.stocks.set(clientId, s);
    }
    refillTokens(s, now);
    if (s.tokens < n) return { ok: false, reason: 'not_enough_stock', stock: s.tokens };
    s.tokens -= n;
    return { ok: true, stock: s.tokens, refillInMs: Math.max(0, REFILL_INTERVAL_MS - (Date.now() - s.last)) };
  }
  const redis = await getRedis();
  const key = `pw:stock:${clientId}`;
  const raw = await redis.get(key);
  let s;
  try {
    s = raw ? JSON.parse(raw) : null;
  } catch {
    s = null;
  }
  if (!s || typeof s.tokens !== 'number') s = { tokens: MAX_STOCK, last: now };
  refillTokens(s, now);
  if (s.tokens < n) {
    return { ok: false, reason: 'not_enough_stock', stock: s.tokens };
  }
  s.tokens -= n;
  await redis.set(key, JSON.stringify({ tokens: s.tokens, last: s.last }), { ex: 86400 });
  return { ok: true, stock: s.tokens, refillInMs: s.tokens >= MAX_STOCK ? 0 : REFILL_INTERVAL_MS };
}

// ------------------------------- Canvas ------------------------------------
const chunkKey = (i) => `pw:chunk:${i}`;

function bytesToBase64(bytes) {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}
function base64ToBytes(b64, out) {
  const buf = Buffer.from(b64, 'base64');
  out.set(buf);
  return out;
}

async function ensureRedisCanvas(redis) {
  const v = await redis.get('pw:version');
  if (v !== null && v !== undefined) return Number(v) || 0;
  // init : 64 chunks à zéro
  const zero = Buffer.alloc(ROWS_PER_CHUNK * SIZE).toString('base64');
  const pipe = redis.pipeline();
  for (let i = 0; i < CHUNK_COUNT; i++) pipe.set(chunkKey(i), zero);
  pipe.set('pw:version', 0);
  await pipe.exec();
  return 0;
}

export async function getVersion() {
  if (!hasRedisEnv()) return mem().version;
  const redis = await getRedis();
  return await ensureRedisCanvas(redis);
}

export async function getCanvasFull() {
  if (!hasRedisEnv()) {
    const m = mem();
    return { version: m.version, pixels: new Uint8Array(m.pixels) };
  }
  const redis = await getRedis();
  const version = await ensureRedisCanvas(redis);
  const pipe = redis.pipeline();
  for (let i = 0; i < CHUNK_COUNT; i++) pipe.get(chunkKey(i));
  const res = await pipe.exec();
  const pixels = new Uint8Array(PIXEL_COUNT);
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const b64 = res[i];
    if (!b64) continue;
    const buf = Buffer.from(b64, 'base64');
    pixels.set(buf, i * ROWS_PER_CHUNK * SIZE);
  }
  return { version, pixels };
}

export async function getDiff(since) {
  since = Number(since) || 0;
  if (!hasRedisEnv()) {
    const m = mem();
    const changes = m.changes.filter((c) => c.v > since);
    return { version: m.version, changes, full: false };
  }
  const redis = await getRedis();
  const version = await ensureRedisCanvas(redis);
  if (since >= version) return { version, changes: [], full: false };
  // log : LPUSH newest first, cap 20k
  const raw = await redis.lrange('pw:log', 0, DIFF_LOG_CAP - 1);
  const changes = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    // stocké "v:x,y,c"
    const s = raw[i];
    const sep = s.indexOf(':');
    const v = Number(s.slice(0, sep));
    if (v <= since) continue;
    const [x, y, c] = s.slice(sep + 1).split(',').map(Number);
    changes.push({ x, y, c, v });
  }
  // si le client est trop en retard (log tronqué), forcer full reload
  const oldestKnown = raw.length ? Number(String(raw[raw.length - 1]).split(':')[0]) : version;
  if (raw.length >= DIFF_LOG_CAP && since < oldestKnown) {
    return { version, changes: [], full: true };
  }
  return { version, changes, full: false };
}

// pixels: [{x,y,color}]
export async function applyPixels(pixels) {
  if (!hasRedisEnv()) {
    const m = mem();
    m.version += 1;
    const v = m.version;
    for (const p of pixels) {
      const idx = p.y * SIZE + p.x;
      m.pixels[idx] = p.color;
      m.changes.push({ x: p.x, y: p.y, c: p.color, v });
    }
    if (m.changes.length > DIFF_LOG_CAP) m.changes.splice(0, m.changes.length - DIFF_LOG_CAP);
    return { version: v };
  }
  const redis = await getRedis();
  await ensureRedisCanvas(redis);
  const version = await redis.incr('pw:version');
  // grouper par chunk pour limiter les GET/SET
  const byChunk = new Map();
  for (const p of pixels) {
    const ci = Math.floor(p.y / ROWS_PER_CHUNK);
    if (!byChunk.has(ci)) byChunk.set(ci, []);
    byChunk.get(ci).push(p);
  }
  for (const [ci, list] of byChunk) {
    const b64 = await redis.get(chunkKey(ci));
    const buf = b64 ? Buffer.from(b64, 'base64') : Buffer.alloc(ROWS_PER_CHUNK * SIZE);
    for (const p of list) {
      const localY = p.y - ci * ROWS_PER_CHUNK;
      buf[localY * SIZE + p.x] = p.color;
    }
    await redis.set(chunkKey(ci), buf.toString('base64'));
  }
  if (pixels.length) {
    const pipe = redis.pipeline();
    for (const p of pixels) pipe.lpush('pw:log', `${version}:${p.x},${p.y},${p.color}`);
    pipe.ltrim('pw:log', 0, DIFF_LOG_CAP - 1);
    await pipe.exec();
  }
  return { version };
}

export { bytesToBase64, base64ToBytes };
