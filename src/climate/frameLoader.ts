import { FRAME_CACHE_SIZE, GRID } from './constants';
import { parseLittleEndianUint16, parseMask } from './binary';
import { joinDataUrl } from './dataUrls';
import { LruCache } from './frameCache';
import { parseManifest } from './manifest';
import type { ClimateManifest, DecodedFrame, FrameMetadata } from './types';

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function fetchBuffer(url: string, fetcher: Fetcher, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetcher(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status} ${response.statusText}`.trim());
  return response.arrayBuffer();
}

export async function loadManifest(baseUrl = import.meta.env.BASE_URL, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<ClimateManifest> {
  const url = joinDataUrl(baseUrl, 2025, 'manifest.json');
  const response = await fetcher(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Temperature manifest is unavailable (${response.status})`);
  let json: unknown;
  try { json = await response.json(); } catch { throw new Error('Temperature manifest is not valid JSON'); }
  return parseManifest(json);
}

export async function loadMask(manifest: ClimateManifest, baseUrl = import.meta.env.BASE_URL, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<Uint8Array> {
  const buffer = await fetchBuffer(joinDataUrl(baseUrl, manifest.year, manifest.mask.filename), fetcher, signal);
  return parseMask(buffer, manifest.grid.cellCount);
}

export class FrameRepository {
  readonly #cache: LruCache<string, DecodedFrame>;
  readonly #inflight = new Map<string, Promise<DecodedFrame>>();
  constructor(
    readonly manifest: ClimateManifest,
    readonly baseUrl = import.meta.env.BASE_URL,
    readonly fetcher: Fetcher = fetch,
    capacity = FRAME_CACHE_SIZE,
  ) { this.#cache = new LruCache(capacity); }

  get cacheKeys(): string[] { return this.#cache.keys(); }

  load(frame: FrameMetadata, signal?: AbortSignal): Promise<DecodedFrame> {
    const cached = this.#cache.get(frame.id);
    if (cached) return Promise.resolve(cached);
    const existing = this.#inflight.get(frame.id);
    if (existing && !signal) return existing;
    const request = Promise.all([
      fetchBuffer(joinDataUrl(this.baseUrl, this.manifest.year, frame.air), this.fetcher, signal).then((buffer) => parseLittleEndianUint16(buffer, GRID.cellCount)),
      fetchBuffer(joinDataUrl(this.baseUrl, this.manifest.year, frame.sst), this.fetcher, signal).then((buffer) => parseLittleEndianUint16(buffer, GRID.cellCount)),
    ]).then(([air, sst]) => {
      const decoded = { id: frame.id, air, sst } satisfies DecodedFrame;
      this.#cache.set(frame.id, decoded);
      return decoded;
    }).finally(() => { if (this.#inflight.get(frame.id) === request) this.#inflight.delete(frame.id); });
    if (!signal) this.#inflight.set(frame.id, request);
    return request;
  }

  prefetch(frame: FrameMetadata | undefined): void {
    if (!frame || this.#cache.has(frame.id) || this.#inflight.has(frame.id)) return;
    void this.load(frame).catch(() => undefined);
  }

  frameAt(index: number): FrameMetadata {
    const count = this.manifest.frames.length;
    return this.manifest.frames[((index % count) + count) % count]!;
  }
}
