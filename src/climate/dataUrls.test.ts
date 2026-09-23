import { describe, expect, it } from 'vitest';
import { joinDataUrl } from './dataUrls';

describe('data URLs', () => {
  it('preserves a Vite deployment base path', () => expect(joinDataUrl('/temperies/', 2025, '/air/week-00.bin')).toBe('/temperies/data/2025/air/week-00.bin'));
});
