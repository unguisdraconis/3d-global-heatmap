import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { GRID } from './constants';
import { FrameRepository, loadMask, type Fetcher } from './frameLoader';
import { parseManifest } from './manifest';

const manifest = parseManifest(JSON.parse(readFileSync('public/data/2025/manifest.json', 'utf8')) as unknown);
const temperatureBuffer = () => new ArrayBuffer(GRID.cellCount * 2);
const response = (buffer: ArrayBuffer, ok = true): Response => ({ ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Failure', arrayBuffer: () => Promise.resolve(buffer) } as Response);

describe('frame loader', () => {
  it('loads and validates a frame, then serves cache hits', async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(response(temperatureBuffer()))); const repository = new FrameRepository(manifest, '/', fetcher);
    const first = await repository.load(manifest.frames[0]!); const second = await repository.load(manifest.frames[0]!);
    expect(first).toBe(second); expect(first.air).toHaveLength(GRID.cellCount); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('deduplicates concurrent frame requests', async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(response(temperatureBuffer()))); const repository = new FrameRepository(manifest, '/', fetcher);
    const [first, second] = await Promise.all([repository.load(manifest.frames[0]!), repository.load(manifest.frames[0]!)]);
    expect(first).toBe(second); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects incorrect raster and mask lengths', async () => {
    const fetcher: Fetcher = () => Promise.resolve(response(new ArrayBuffer(12))); const repository = new FrameRepository(manifest, '/', fetcher);
    await expect(repository.load(manifest.frames[0]!)).rejects.toThrow(/Expected 2073600 bytes/);
    await expect(loadMask(manifest, '/', fetcher)).rejects.toThrow(/mask bytes/);
  });
  it('reports failed responses', async () => {
    const fetcher: Fetcher = () => Promise.resolve(response(new ArrayBuffer(0), false)); const repository = new FrameRepository(manifest, '/', fetcher);
    await expect(repository.load(manifest.frames[0]!)).rejects.toThrow(/500 Failure/);
  });
  it('forwards abort signals', async () => {
    const controller = new AbortController(); controller.abort();
    const fetcher: Fetcher = (_url, init) => init?.signal?.aborted ? Promise.reject(new DOMException('Aborted', 'AbortError')) : Promise.resolve(response(temperatureBuffer()));
    const repository = new FrameRepository(manifest, '/', fetcher);
    await expect(repository.load(manifest.frames[0]!, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('promotes cache hits, evicts in LRU order, and rolls over weeks', async () => {
    const fetcher: Fetcher = () => Promise.resolve(response(temperatureBuffer())); const repository = new FrameRepository(manifest, '/', fetcher, 2);
    await repository.load(manifest.frames[0]!); await repository.load(manifest.frames[1]!); await repository.load(manifest.frames[0]!); await repository.load(manifest.frames[2]!);
    expect(repository.cacheKeys).toEqual(['week-00', 'week-02']);
    expect(repository.frameAt(-1).frame).toBe(51); expect(repository.frameAt(52).frame).toBe(0);
  });
});
