export function getOrCreateClientId() {
  const KEY = 'pw-client-id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(16).slice(2);
  }
}
