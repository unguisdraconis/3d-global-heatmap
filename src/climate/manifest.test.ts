import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseManifest } from './manifest';

const valid = JSON.parse(readFileSync('public/data/2025/manifest.json', 'utf8')) as Record<string, unknown>;
interface MutableFrame { id: string; frame: number; air: string; histograms: { land: number[] } }
interface MutableManifest extends Record<string, unknown> {
  grid: { cellCount: number; rowDirection: string };
  encoding: { type: string };
  frames: MutableFrame[];
}
const clone = () => structuredClone(valid) as unknown as MutableManifest;

describe('manifest validation', () => {
  it('accepts the current annual manifest', () => expect(parseManifest(valid).frames).toHaveLength(52));
  it('rejects missing required fields', () => { const item = clone(); delete (item as Record<string, unknown>).grid; expect(() => parseManifest(item)).toThrow(/grid/); });
  it('rejects an inconsistent cell count', () => { const item = clone(); item.grid.cellCount = 1; expect(() => parseManifest(item)).toThrow(/cellCount/); });
  it('rejects bad orientation and unsupported encoding', () => {
    const orientation = clone(); orientation.grid.rowDirection = 'south-to-north'; expect(() => parseManifest(orientation)).toThrow(/rowDirection/);
    const encoding = clone(); encoding.encoding.type = 'Float32'; expect(() => parseManifest(encoding)).toThrow(/encoding.type/);
  });
  it('rejects incorrect histograms', () => { const item = clone(); item.frames[0]!.histograms.land.pop(); expect(() => parseManifest(item)).toThrow(/280/); });
  it('rejects duplicate IDs, invalid paths, and invalid frame indexes', () => {
    const duplicate = clone(); duplicate.frames[1]!.id = duplicate.frames[0]!.id; expect(() => parseManifest(duplicate)).toThrow(/unique/);
    const path = clone(); path.frames[0]!.air = '../escape.bin'; expect(() => parseManifest(path)).toThrow(/relative/);
    const index = clone(); index.frames[0]!.frame = 3; expect(() => parseManifest(index)).toThrow(/equal 0/);
  });
});
