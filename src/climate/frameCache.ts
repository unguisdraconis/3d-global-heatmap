export class LruCache<K, V> {
  readonly #entries = new Map<K, V>();
  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
  }
  get size(): number { return this.#entries.size; }
  has(key: K): boolean { return this.#entries.has(key); }
  get(key: K): V | undefined {
    const value = this.#entries.get(key);
    if (value === undefined) return undefined;
    this.#entries.delete(key); this.#entries.set(key, value);
    return value;
  }
  set(key: K, value: V): void {
    this.#entries.delete(key); this.#entries.set(key, value);
    while (this.#entries.size > this.capacity) this.#entries.delete(this.#entries.keys().next().value!);
  }
  keys(): K[] { return [...this.#entries.keys()]; }
  clear(): void { this.#entries.clear(); }
}

