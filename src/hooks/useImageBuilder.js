import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { SIZE } from '../lib/palette';
import { TRANSPARENT, bytesToB64, b64ToBytes } from '../lib/image';

const LS_KEY = 'pw-build-job-v1';

// Job : { w, h, x, y, indicesB64, running }
// La progression est calculée en comparant avec le canvas réel (robuste au reload / vandalisme).
export function useImageBuilder(clientId, getPixels) {
  const [job, setJob] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const j = JSON.parse(raw);
      if (!j || !j.w || !j.h || !j.indicesB64) return null;
      return j;
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState(false);
  const [buildErr, setBuildErr] = useState(null);
  const jobRef = useRef(job);
  jobRef.current = job;
  const busyRef = useRef(false);

  useEffect(() => {
    try {
      if (job) localStorage.setItem(LS_KEY, JSON.stringify(job));
      else localStorage.removeItem(LS_KEY);
    } catch { /* stockage plein : tant pis */ }
  }, [job]);

  const indices = useMemo(
    () => (job ? b64ToBytes(job.indicesB64) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job?.indicesB64, job?.w, job?.h],
  );

  // compte les pixels déjà bons sur le canvas
  const progress = useMemo(() => {
    if (!job || !indices) return { done: 0, total: 0 };
    const px = getPixels();
    let done = 0;
    let total = 0;
    for (let j = 0; j < job.h; j++) {
      for (let i = 0; i < job.w; i++) {
        const c = indices[j * job.w + i];
        if (c === TRANSPARENT) continue;
        total++;
        const gx = job.x + i;
        const gy = job.y + j;
        if (gx < 0 || gy < 0 || gx >= SIZE || gy >= SIZE) continue;
        if (px && px[gy * SIZE + gx] === c) done++;
      }
    }
    return { done, total };
  }, [job, indices, getPixels]);

  const startJob = useCallback((w, h, x, y, idxBytes) => {
    x = Math.max(0, Math.min(SIZE - w, Math.round(x)));
    y = Math.max(0, Math.min(SIZE - h, Math.round(y)));
    setJob({ w, h, x, y, indicesB64: bytesToB64(idxBytes), running: true });
    setBuildErr(null);
  }, []);

  const setRunning = useCallback((running) => {
    setJob((j) => (j ? { ...j, running } : j));
  }, []);

  const cancelJob = useCallback(() => {
    setJob(null);
    setBuildErr(null);
  }, []);

  const moveJob = useCallback((x, y) => {
    setJob((j) => {
      if (!j) return j;
      return {
        ...j,
        x: Math.max(0, Math.min(SIZE - j.w, Math.round(x))),
        y: Math.max(0, Math.min(SIZE - j.h, Math.round(y))),
      };
    });
  }, []);

  // boucle de construction : toutes les 4s, envoie ce que le stock permet (max 10)
  useEffect(() => {
    if (!job?.running) return;
    let dead = false;
    const tick = async () => {
      if (dead || busyRef.current) return;
      const j = jobRef.current;
      if (!j?.running) return;
      const idx = b64ToBytes(j.indicesB64);
      const px = getPixels();
      if (!px) return;
      let s;
      try {
        s = await api.stock(clientId);
      } catch {
        return;
      }
      if (dead) return;
      if (s.stock <= 0) return;
      const batch = [];
      for (let jj = 0; jj < j.h && batch.length < Math.min(s.stock, 10); jj++) {
        for (let ii = 0; ii < j.w && batch.length < Math.min(s.stock, 10); ii++) {
          const c = idx[jj * j.w + ii];
          if (c === TRANSPARENT) continue;
          const gx = j.x + ii;
          const gy = j.y + jj;
          if (gx < 0 || gy < 0 || gx >= SIZE || gy >= SIZE) continue;
          if (px[gy * SIZE + gx] === c) continue;
          batch.push({ x: gx, y: gy, color: c });
        }
      }
      if (!batch.length) {
        // tout est bon -> stop
        setJob((cur) => (cur ? { ...cur, running: false } : cur));
        return;
      }
      setBusy(true);
      busyRef.current = true;
      try {
        await api.place(clientId, batch);
      } catch (e) {
        if (!dead) {
          setBuildErr(e?.data?.error === 'not_enough_stock' ? 'stock vide, pause…' : 'erreur réseau, on réessaie');
          setTimeout(() => !dead && setBuildErr(null), 3000);
        }
      } finally {
        busyRef.current = false;
        if (!dead) setBusy(false);
      }
    };
    const t = setInterval(tick, 4000);
    tick();
    return () => { dead = true; clearInterval(t); };
  }, [job?.running, clientId, getPixels]);

  return { job, indices, progress, buildErr, busy, startJob, setRunning, cancelJob, moveJob };
}
