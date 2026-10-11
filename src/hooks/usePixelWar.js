import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { base64ToBytes, SIZE } from '../lib/palette';
import { getOrCreateClientId } from '../lib/clientId';

export function usePixelWar() {
  const [pixels, setPixels] = useState(null); // Uint8Array(1M)
  const [version, setVersion] = useState(0);
  const [stock, setStock] = useState({ unlimited: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedColor, setSelectedColor] = useState(3);
  const [placing, setPlacing] = useState(false);
  const clientId = useRef(getOrCreateClientId());
  const versionRef = useRef(0);
  const pixelsRef = useRef(null);
  const [, force] = useState(0);

  // chargement initial
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const data = await api.canvas();
        if (dead) return;
        const bytes = base64ToBytes(data.pixels);
        pixelsRef.current = bytes;
        versionRef.current = data.version;
        setPixels(bytes);
        setVersion(data.version);
        const s = await api.stock(clientId.current).catch(() => null);
        if (s && !dead) setStock(s);
      } catch (e) {
        if (!dead) setError(String(e.message || e));
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, []);

  // poll diff toutes les 2s + stock toutes les 2s
  useEffect(() => {
    if (loading) return;
    const t = setInterval(async () => {
      try {
        const d = await api.diff(versionRef.current);
        if (d.full) {
          const full = await api.canvas();
          const bytes = base64ToBytes(full.pixels);
          pixelsRef.current = bytes;
          versionRef.current = full.version;
          setPixels(bytes);
          setVersion(full.version);
        } else if (d.changes?.length && pixelsRef.current) {
          const next = new Uint8Array(pixelsRef.current);
          for (const c of d.changes) next[c.y * SIZE + c.x] = c.c;
          pixelsRef.current = next;
          versionRef.current = d.version;
          setPixels(next);
          setVersion(d.version);
        } else if (d.version !== versionRef.current) {
          versionRef.current = d.version;
          setVersion(d.version);
        }
        const s = await api.stock(clientId.current).catch(() => null);
        if (s) setStock(s);
      } catch {
        // silencieux en poll
      }
    }, 2000);
    return () => clearInterval(t);
  }, [loading]);

  // compte à rebours du stock (inactif en illimité)
  useEffect(() => {
    if (stock.unlimited || stock.stock >= stock.max) return;
    const t = setInterval(() => {
      setStock((s) => {
        const r = (s.refillInMs ?? 3000) - 500;
        if (r <= 0) {
          // on re-fetch le vrai stock au prochain poll ; optimiste +1
          return { ...s, stock: Math.min(s.max, s.stock + 1), refillInMs: 3000 };
        }
        return { ...s, refillInMs: r };
      });
    }, 500);
    return () => clearInterval(t);
  }, [stock.unlimited, stock.stock, stock.max]);

  const placePixel = useCallback(async (x, y) => {
    if (!pixelsRef.current) return;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    setPlacing(true);
    try {
      // optimiste
      const next = new Uint8Array(pixelsRef.current);
      next[y * SIZE + x] = selectedColor;
      pixelsRef.current = next;
      setPixels(next);
      force((n) => n + 1);

      const res = await api.place(clientId.current, [{ x, y, color: selectedColor }]);
      versionRef.current = res.version;
      setVersion(res.version);
      if (!res.unlimited) setStock(res);
    } catch (e) {
      if (e.status === 429 && e.data) {
        setStock(e.data);
        setError('Plus de pixels pour le moment, réessaie dans quelques secondes');
        setTimeout(() => setError(null), 2500);
      } else {
        setError(e.message);
        setTimeout(() => setError(null), 2500);
      }
      // resync
      try {
        const d = await api.diff(versionRef.current);
        if (d.changes?.length && pixelsRef.current) {
          const n2 = new Uint8Array(pixelsRef.current);
          for (const c of d.changes) n2[c.y * SIZE + c.x] = c.c;
          pixelsRef.current = n2;
          setPixels(n2);
        }
      } catch { /* noop */ }
    } finally {
      setPlacing(false);
    }
  }, [selectedColor]);

  return {
    pixels, version, stock, loading, error,
    selectedColor, setSelectedColor,
    placePixel, placing, clientId: clientId.current,
  };
}
