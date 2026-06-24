import { hashPositions } from "./hash.js";
import { optimalM, optimalK } from "./BloomFilter.js";

export interface CountingBloomFilterOptions {
  /** Expected number of items. */
  capacity: number;
  /** Target false-positive rate (default: 0.01). */
  errorRate?: number;
  /** Counter width in bits — 4 (default) supports up to 15 adds per cell. */
  counterBits?: 4 | 8;
}

/**
 * Counting Bloom filter — supports deletion by maintaining per-cell counters
 * instead of single bits.
 *
 * - `add(item)` increments k counters.
 * - `remove(item)` decrements k counters. Do NOT remove items that were never added.
 * - `has(item)` returns `true` iff all k counters are > 0.
 *
 * @example
 * const cbf = new CountingBloomFilter({ capacity: 10_000 });
 * cbf.add("user:42");
 * cbf.has("user:42"); // true
 * cbf.remove("user:42");
 * cbf.has("user:42"); // false
 */
export class CountingBloomFilter {
  readonly capacity: number;
  readonly errorRate: number;
  readonly m: number;
  readonly k: number;
  private readonly _counters: Uint8Array | Uint16Array;
  private readonly _counterBits: number;
  private readonly _maxCount: number;
  private _count = 0;

  constructor(options: CountingBloomFilterOptions) {
    const { capacity, errorRate = 0.01, counterBits = 4 } = options;
    if (capacity <= 0 || !Number.isFinite(capacity)) throw new RangeError("capacity must be a positive finite number");
    if (errorRate <= 0 || errorRate >= 1) throw new RangeError("errorRate must be in (0, 1)");

    this.capacity = capacity;
    this.errorRate = errorRate;
    this.m = optimalM(capacity, errorRate);
    this.k = optimalK(this.m, capacity);
    this._counterBits = counterBits;

    if (counterBits === 4) {
      // Pack two 4-bit counters per byte
      this._counters = new Uint8Array(Math.ceil(this.m / 2));
      this._maxCount = 15;
    } else {
      this._counters = new Uint8Array(this.m);
      this._maxCount = 255;
    }
  }

  private _get(pos: number): number {
    if (this._counterBits === 4) {
      const byte = this._counters[pos >>> 1]!;
      return pos & 1 ? byte >>> 4 : byte & 0x0f;
    }
    return (this._counters as Uint8Array)[pos]!;
  }

  private _increment(pos: number): void {
    if (this._counterBits === 4) {
      const idx = pos >>> 1;
      const byte = this._counters[idx]!;
      if (pos & 1) {
        const hi = byte >>> 4;
        if (hi < this._maxCount) this._counters[idx] = (byte & 0x0f) | ((hi + 1) << 4);
      } else {
        const lo = byte & 0x0f;
        if (lo < this._maxCount) this._counters[idx] = (byte & 0xf0) | (lo + 1);
      }
    } else {
      const v = (this._counters as Uint8Array)[pos]!;
      if (v < this._maxCount) (this._counters as Uint8Array)[pos] = v + 1;
    }
  }

  private _decrement(pos: number): void {
    if (this._counterBits === 4) {
      const idx = pos >>> 1;
      const byte = this._counters[idx]!;
      if (pos & 1) {
        const hi = byte >>> 4;
        if (hi > 0) this._counters[idx] = (byte & 0x0f) | ((hi - 1) << 4);
      } else {
        const lo = byte & 0x0f;
        if (lo > 0) this._counters[idx] = (byte & 0xf0) | (lo - 1);
      }
    } else {
      const v = (this._counters as Uint8Array)[pos]!;
      if (v > 0) (this._counters as Uint8Array)[pos] = v - 1;
    }
  }

  /** Add an item to the filter. */
  add(item: string): this {
    for (const pos of hashPositions(item, this.k, this.m)) {
      this._increment(pos);
    }
    this._count++;
    return this;
  }

  /**
   * Remove an item from the filter.
   * Only remove items you previously added — removing items never added leads
   * to false negatives.
   */
  remove(item: string): this {
    for (const pos of hashPositions(item, this.k, this.m)) {
      this._decrement(pos);
    }
    this._count = Math.max(0, this._count - 1);
    return this;
  }

  /** Test membership. */
  has(item: string): boolean {
    for (const pos of hashPositions(item, this.k, this.m)) {
      if (this._get(pos) === 0) return false;
    }
    return true;
  }

  /** Number of items currently in the filter (approximate). */
  get size(): number {
    return this._count;
  }

  /** Reset the filter. */
  clear(): this {
    this._counters.fill(0);
    this._count = 0;
    return this;
  }
}
