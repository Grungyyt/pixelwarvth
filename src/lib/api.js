async function j(res) {
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* noop */ }
    const err = new Error(body.error || `http_${res.status}`);
    err.data = body;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  canvas: () => fetch('/api/canvas').then(j),
  diff: (since) => fetch(`/api/diff?since=${since}`).then(j),
  stock: (clientId) => fetch(`/api/stock?clientId=${encodeURIComponent(clientId)}`).then(j),
  place: (clientId, pixels) =>
    fetch('/api/pixels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, pixels }),
    }).then(j),
  health: () => fetch('/api/health').then(j),
};
