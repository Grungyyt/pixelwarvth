import { useEffect, useMemo, useState } from 'react';
import { SIZE } from '../lib/palette';
import { loadFileAsImage, convertImage, fitRatio, etaText, MAX_IMPORT_W, MAX_IMPORT_H } from '../lib/image';

export default function ImportPanel({ draftPos, setDraftPos, picking, setPicking, onDraftSize, onStart, onClose }) {
  const [src, setSrc] = useState(null); // { img, w, h }
  const [fileName, setFileName] = useState('');
  const [loadErr, setLoadErr] = useState(null);
  const [w, setW] = useState(64);
  const [h, setH] = useState(64);
  const [lock, setLock] = useState(true);

  useEffect(() => {
    onDraftSize?.(w, h);
  }, [w, h, onDraftSize]);

  const pickFile = async (f) => {
    if (!f) return;
    setLoadErr(null);
    try {
      const loaded = await loadFileAsImage(f);
      setSrc(loaded);
      setFileName(f.name);
      const tw = Math.min(MAX_IMPORT_W, loaded.w);
      setW(tw);
      setH(Math.min(MAX_IMPORT_H, fitRatio(loaded.w, loaded.h, tw)));
      setDraftPos({ x: Math.round(SIZE / 2 - tw / 2), y: Math.round(SIZE / 2 - tw / 2) });
    } catch {
      setLoadErr('fichier illisible (png/jpg/webp)');
    }
  };

  const onW = (v) => {
    v = Math.max(1, Math.min(MAX_IMPORT_W, Math.round(v) || 1));
    setW(v);
    if (lock && src) setH(Math.min(MAX_IMPORT_H, fitRatio(src.w, src.h, v)));
  };
  const onH = (v) => {
    v = Math.max(1, Math.min(MAX_IMPORT_H, Math.round(v) || 1));
    setH(v);
    if (lock && src) setW(Math.min(MAX_IMPORT_W, fitRatio(src.h, src.w, v)));
  };

  const conv = useMemo(() => {
    if (!src) return null;
    try {
      return convertImage(src.img, w, h);
    } catch {
      return null;
    }
  }, [src, w, h]);

  const start = () => {
    if (!conv) return;
    onStart(conv.w, conv.h, draftPos.x, draftPos.y, conv.indices);
  };

  return (
    <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-head">
          <strong>importer une image</strong>
          <button className="btn" onClick={onClose}>fermer</button>
        </div>

        {!src ? (
          <div>
            <label className="filebtn">
              choisir un fichier…
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => pickFile(e.target.files[0])}
              />
            </label>
            {loadErr && <div className="formerr">{loadErr}</div>}
            <p className="sheet-note">png / jpg / webp / gif. Le gif animé ne garde que la 1re frame. Max {MAX_IMPORT_W}x{MAX_IMPORT_H}.</p>
          </div>
        ) : (
          <div>
            <div className="prevrow">
              <div>
                <div className="cap">rendu (palette 16)</div>
                {conv && <img className="preview" src={conv.previewUrl} alt="apercu" />}
              </div>
              <div className="filemeta">
                <div>{fileName}</div>
                <div className="dim">{src.w}x{src.h} px d'origine</div>
                <button className="btn small" onClick={() => { setSrc(null); setFileName(''); }}>autre fichier</button>
              </div>
            </div>

            <div className="grid2">
              <label>largeur
                <input type="number" min="1" max={MAX_IMPORT_W} value={w} onChange={(e) => onW(Number(e.target.value))} />
              </label>
              <label>hauteur
                <input type="number" min="1" max={MAX_IMPORT_H} value={h} onChange={(e) => onH(Number(e.target.value))} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
              garder les proportions
            </label>

            <div className="grid2">
              <label>x (gauche)
                <input type="number" min="0" max={SIZE - w} value={draftPos.x} onChange={(e) => setDraftPos((p) => ({ ...p, x: Number(e.target.value) || 0 }))} />
              </label>
              <label>y (haut)
                <input type="number" min="0" max={SIZE - h} value={draftPos.y} onChange={(e) => setDraftPos((p) => ({ ...p, y: Number(e.target.value) || 0 }))} />
              </label>
            </div>
            <button className={`btn wide ${picking ? 'active' : ''}`} onClick={() => setPicking(!picking)}>
              {picking ? 'clique sur le canvas… (annuler)' : 'choisir la position sur le canvas'}
            </button>

            {conv && (
              <div className="sheet-note">
                {conv.opaque} pixels à poser — environ {etaText(conv.opaque)} au rythme du stock.
                Les zones transparentes sont ignorées.
              </div>
            )}

            <button className="btn primary wide" onClick={start} disabled={!conv || !conv.opaque}>
              construire
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
