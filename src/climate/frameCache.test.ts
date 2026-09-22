import { describe, expect, it } from 'vitest';
import { LruCache } from './frameCache';

describe('LRU cache', () => {
  it('promotes hits and evicts the least recently used entry', () => {
    const cache = new LruCache<string, number>(2); cache.set('a', 1); cache.set('b', 2);
    expect(cache.get('a')).toBe(1); cache.set('c', 3);
    expect(cache.keys()).toEqual(['a', 'c']); expect(cache.get('b')).toBeUndefined();
  });
});

