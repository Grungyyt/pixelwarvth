import PixelCanvas from './components/PixelCanvas';
import { usePixelWar } from './hooks/usePixelWar';
import { PALETTE, SIZE } from './lib/palette';
import './App.css';

export default function App() {
  const {
    pixels, version, stock, loading, error,
    selectedColor, setSelectedColor, placePixel, placing,
  } = usePixelWar();

  const refillSec = Math.ceil((stock.refillInMs || 0) / 1000);

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
      </header>

      {error && <div className="err">{error}</div>}

      <main className="main">
        {loading || !pixels ? (
          <div className="loading">chargement…</div>
        ) : (
          <PixelCanvas
            pixels={pixels}
            onPlace={placePixel}
            selectedColor={selectedColor}
            disabled={placing || stock.stock <= 0}
          />
        )}
      </main>

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
    </div>
  );
}
