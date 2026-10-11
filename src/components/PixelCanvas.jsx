import { useEffect, useRef, useState, useCallback } from 'react';
import { SIZE, PALETTE, hexToRgb } from '../lib/palette';

export default function PixelCanvas({ pixels, onPlace, onPick, pickMode, overlay, selectedColor, disabled }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(null);
  const drag = useRef(null);

  // fit initial
  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current?.clientWidth || 800;
      const h = wrapRef.current?.clientHeight || 600;
      setScale((prev) => (prev === 1 ? Math.max(0.3, Math.min(w, h) / SIZE * 0.95) : prev));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // dessin
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    const d = img.data;
    const rgbCache = PALETTE.map(hexToRgb);
    for (let i = 0; i < pixels.length; i++) {
      const [r, g, b] = rgbCache[pixels[i]] || rgbCache[0];
      const o = i * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    // draw offscreen puis scale? direct putImageData (1024x1024 ok)
    const off = document.createElement('canvas');
    off.width = SIZE; off.height = SIZE;
    off.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(off, 0, 0);
  }, [pixels]);

  // fantôme : l'image à construire, semi-transparente par-dessus
  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (!overlay || !overlay.indices) return;
    const { w, h, indices } = overlay;
    const img = ctx.createImageData(w, h);
    const rgbCache = PALETTE.map(hexToRgb);
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] === 255) continue; // transparent
      const [r, g, b] = rgbCache[indices[i]] || rgbCache[0];
      const o = i * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(img, 0, 0);
  }, [overlay]);

  const toPixel = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / rect.width * SIZE);
    const y = Math.floor((e.clientY - rect.top) / rect.height * SIZE);
    return { x, y };
  }, []);

  const onMouseDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y, moved: false };
  };
  const onMouseMove = (e) => {
    if (drag.current) {
      const dx = e.clientX - drag.current.sx;
      const dy = e.clientY - drag.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
      if (drag.current.moved) setOffset({ x: drag.current.ox + dx, y: drag.current.oy + dy });
    }
    const p = toPixel(e);
    if (p.x >= 0 && p.y >= 0 && p.x < SIZE && p.y < SIZE) setHover(p);
    else setHover(null);
  };
  const onMouseUp = (e) => {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (wasDrag) return;
    const p = toPixel(e);
    if (p.x < 0 || p.y < 0 || p.x >= SIZE || p.y >= SIZE) return;
    if (pickMode && onPick) {
      onPick(p.x, p.y);
      return;
    }
    if (!disabled) onPlace(p.x, p.y);
  };
  // molette interceptée en natif (non-passif) : seule la map zoome,
  // la page ne scrolle pas et le navigateur ne zoome pas (ctrl+molette inclus)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheelNative = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.deltaY < 0 ? 1.15 : 0.87;
      setScale((s) => Math.min(20, Math.max(0.2, s * f)));
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="canvas-toolbar">
        <button onClick={() => setScale((s) => Math.min(20, s * 1.3))}>zoom +</button>
        <button onClick={() => setScale((s) => Math.max(0.2, s * 0.77))}>zoom −</button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>centrer</button>
        <span className="zoom">{Math.round(scale * 100)}%</span>
        {hover && <span className="coords">x:{hover.x} y:{hover.y}</span>}
        {pickMode && <span className="coords pick">— clique sur le canvas pour placer</span>}
      </div>
      <div
        className="canvas-scroll"
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { drag.current = null; setHover(null); }}
      >
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="pixel-canvas"
            style={{ width: SIZE * scale, height: SIZE * scale }}
          />
          {overlay && overlay.indices && (
            <canvas
              ref={overlayRef}
              width={overlay.w}
              height={overlay.h}
              className="ghost-canvas"
              style={{
                width: overlay.w * scale,
                height: overlay.h * scale,
                left: overlay.x * scale,
                top: overlay.y * scale,
              }}
            />
          )}
          {hover && !pickMode && (
            <div
              className="hover-box"
              style={{
                width: scale, height: scale,
                left: hover.x * scale, top: hover.y * scale,
                background: PALETTE[selectedColor],
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
