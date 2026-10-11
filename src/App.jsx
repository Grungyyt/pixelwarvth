import { useCallback, useEffect, useRef, useState } from 'react';
import PixelCanvas from './components/PixelCanvas';
import ImportPanel from './components/ImportPanel';
import { usePixelWar } from './hooks/usePixelWar';
import { useImageBuilder } from './hooks/useImageBuilder';
import { PALETTE, SIZE } from './lib/palette';
import { etaText } from './lib/image';
import './App.css';

export default function App() {
  const {
    pixels, version, stock, loading, error,
    selectedColor, setSelectedColor, placePixel, placing, clientId,
  } = usePixelWar();

  const pixelsRef = useRef(null);
  useEffect(() => { pixelsRef.current = pixels; }, [pixels]);
  const getPixels = useCallback(() => pixelsRef.current, []);

  const { job, indices, progress, buildErr, startJob, setRunning, cancelJob, moveJob } =
    useImageBuilder(clientId, getPixels);

  const [panelOpen, setPanelOpen] = useState(false);
  const [picking, setPicking] = useState(null); // null | 'draft' | 'job'
  const [draftPos, setDraftPos] = useState({ x: 0, y: 0 });
  const draftSize = useRef({ w: 64, h: 64 });

  const refillSec = Math.ceil((stock.refillInMs || 0) / 1000);

  const onPick = useCallback((x, y) => {
    if (picking === 'draft') {
      const { w, h } = draftSize.current;
      setDraftPos({
        x: Math.max(0, Math.min(SIZE - w, x - Math.floor(w / 2))),
        y: Math.max(0, Math.min(SIZE - h, y - Math.floor(h / 2))),
      });
    } else if (picking === 'job' && job) {
      moveJob(x - Math.floor(job.w / 2), y - Math.floor(job.h / 2));
    }
    setPicking(null);
  }, [picking, job, moveJob]);

  const onStartBuild = (w, h, x, y, idx) => {
    startJob(w, h, x, y, idx);
    setPanelOpen(false);
    setPicking(null);
  };

  const overlay = job && indices
    ? { x: job.x, y: job.y, w: job.w, h: job.h, indices }
    : null;

  const remaining = progress.total - progress.done;
  const finished = job && progress.total > 0 && remaining <= 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <span className="logo" />
          <span>
            <strong>pixelwar</strong>
            <span className="meta"> {SIZE}x{SIZE} — v{version}</span>
          </span>
        </div>
        <div className="head-right">
          <button className="btn small" onClick={() => setPanelOpen(true)}>importer une image</button>
          <div className="stockbox">
            <span className="pips">
              {Array.from({ length: stock.max }).map((_, i) => (
                <i key={i} className={i < stock.stock ? 'on' : ''} />
              ))}
            </span>
            <span className="stocktxt">
              {stock.stock}/{stock.max}
              {stock.stock < stock.max ? ` — prochain dans ${refillSec}s` : ' — plein'}
            </span>
          </div>
        </div>
      </header>

      {error && <div className="err">{error}</div>}
      {buildErr && <div className="err">{buildErr}</div>}

      <main className="main">
        {loading || !pixels ? (
          <div className="loading">chargement…</div>
        ) : (
          <PixelCanvas
            pixels={pixels}
            onPlace={placePixel}
            onPick={onPick}
            pickMode={picking !== null}
            overlay={overlay}
            selectedColor={selectedColor}
            disabled={placing || stock.stock <= 0}
          />
        )}
      </main>

      {job && (
        <div className="jobbar">
          <span className="jobtxt">
            image {job.w}x{job.h} — {progress.done}/{progress.total} posés
            {finished ? ' — terminé' : job.running ? ` — ~${etaText(remaining)} restantes` : ' — en pause'}
          </span>
          <span className="jobprog"><i style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></span>
          {!finished && (
            <button className="btn small" onClick={() => setRunning(!job.running)}>
              {job.running ? 'pause' : 'reprendre'}
            </button>
          )}
          {!finished && (
            <button className="btn small" onClick={() => setPicking(picking === 'job' ? null : 'job')}>
              {picking === 'job' ? 'annuler le déplacement' : 'déplacer'}
            </button>
          )}
          <button className="btn small" onClick={cancelJob}>
            {finished ? 'ok' : 'annuler'}
          </button>
        </div>
      )}

      <footer className="dock">
        <div className="colors">
          {PALETTE.map((c, i) => (
            <button
              key={c + i}
              className={i === selectedColor ? 'sw on' : 'sw'}
              style={{ background: c }}
              onClick={() => setSelectedColor(i)}
              title={c}
            />
          ))}
        </div>
        <div className="hint">clic = poser · molette = zoom · glisser = bouger · 10 pixels max, 1 rendu toutes les 3 sec</div>
      </footer>

      {panelOpen && (
        <ImportPanel
          draftPos={draftPos}
          setDraftPos={setDraftPos}
          picking={picking === 'draft'}
          setPicking={(v) => setPicking(v ? 'draft' : null)}
          onDraftSize={(w, h) => { draftSize.current = { w, h }; }}
          onStart={onStartBuild}
          onClose={() => { setPanelOpen(false); if (picking === 'draft') setPicking(null); }}
        />
      )}
    </div>
  );
}
