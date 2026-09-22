import { GRID } from './temperature';

const cache = new Map();
const MAX_CACHE = 5;

async function loadBinary(path, Type, expectedLength) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  const buffer = await response.arrayBuffer();
  const data = new Type(buffer);
  if (data.length !== expectedLength) throw new Error(`Unexpected size for ${path}`);
  return data;
}

export async function loadManifest() {
  const response = await fetch('/data/2025/manifest.json');
  if (!response.ok) throw new Error('Temperature manifest is missing. Run npm run generate:data.');
  return response.json();
}

export async function loadMask() {
  return loadBinary('/data/2025/land-mask.bin', Uint8Array, GRID.width * GRID.height);
}

export async function loadFrame(frame) {
  if (cache.has(frame.id)) {
    const value = cache.get(frame.id);
    cache.delete(frame.id);
    cache.set(frame.id, value);
    return value;
  }
  const [air, sst] = await Promise.all([
    loadBinary(`/data/2025/${frame.air}`, Uint16Array, GRID.width * GRID.height),
    loadBinary(`/data/2025/${frame.sst}`, Uint16Array, GRID.width * GRID.height),
  ]);
  const value = { air, sst };
  cache.set(frame.id, value);
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return value;
}

export function prefetchFrame(frame) {
  if (!frame || cache.has(frame.id)) return;
  loadFrame(frame).catch(() => undefined);
}
