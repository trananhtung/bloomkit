import { BitArray } from "./BitArray.js";
import { hashPositions } from "./hash.js";

/** @internal Compute optimal bit-array size m given n items and fpr. */
export function optimalM(n: number, fpr: number): number {
  return Math.ceil(-n * Math.log(fpr) / (Math.LN2 * Math.LN2));
}

/** @internal Compute optimal number of hash functions k given m bits and n items. */
export function optimalK(m: number, n: number): number {
  return Math.max(1, Math.round((m / n) * Math.LN2));
}

export interface BloomFilterOptions {
  /**
   * Expected number of items that will be inserted.
   * Used to size the filter optimally.
   */
  capacity: number;
  /**
   * Target false-positive rate (0 < fpr < 1). Default: 0.01 (1%).
   */
  errorRate?: number;
}

export interface BloomFilterJSON {
  type: "BloomFilter";
  capacity: number;
  errorRate: number;
  m: number;
  k: number;
  bits: string;
}

/**
 * Standard Bloom filter — space-efficient probabilistic set membership.
 *
 * - `add(item)` always works correctly.
 * - `has(item)` may return `true` for items not added (false positive, rate ≤ `errorRate`).
 * - `has(item)` never returns `false` for items that were added.
 * - Items cannot be removed (use `CountingBloomFilter` for deletions).
 *
 * @example
 * const bf = new BloomFilter({ capacity: 1_000_000, errorRate: 0.01 });
 * bf.add("hello");
 * bf.has("hello"); // true
 * bf.has("world"); // false (with high probability)
 */
export class BloomFilter {
  readonly capacity: number;
  readonly errorRate: number;
  /** Bit-array size. */
  readonly m: number;
  /** Number of hash functions. */
  readonly k: number;

  private readonly _bits: BitArray;
  private _count = 0;

  constructor(options: BloomFilterOptions) {
    const { capacity, errorRate = 0.01 } = options;
    if (capacity <= 0 || !Number.isFinite(capacity)) throw new RangeError("capacity must be a positive finite number");
    if (errorRate <= 0 || errorRate >= 1) throw new RangeError("errorRate must be in (0, 1)");

    this.capacity = capacity;
    this.errorRate = errorRate;
    this.m = optimalM(capacity, errorRate);
    this.k = optimalK(this.m, capacity);
    this._bits = new BitArray(this.m);
  }

  /** Add an item to the filter. */
  add(item: string): this {
    for (const pos of hashPositions(item, this.k, this.m)) {
      this._bits.set(pos);
    }
    this._count++;
    return this;
  }

  /**
   * Test membership. Returns `true` if item *may* have been added,
   * `false` if it *definitely* has not.
   */
  has(item: string): boolean {
    for (const pos of hashPositions(item, this.k, this.m)) {
      if (!this._bits.get(pos)) return false;
    }
    return true;
  }

  /** Number of items added (may exceed capacity). */
  get size(): number {
    return this._count;
  }

  /** Current estimated false-positive rate based on items inserted. */
  get currentFPR(): number {
    const fillRatio = this._bits.popcount() / this.m;
    return Math.pow(fillRatio, this.k);
  }

  /** Reset the filter. */
  clear(): this {
    this._bits.clear();
    this._count = 0;
    return this;
  }

  /** Serialize to a plain object for JSON.stringify. */
  toJSON(): BloomFilterJSON {
    return {
      type: "BloomFilter",
      capacity: this.capacity,
      errorRate: this.errorRate,
      m: this.m,
      k: this.k,
      bits: this._bits.toBase64(),
    };
  }

  /** Restore a BloomFilter from the output of `toJSON`. */
  static fromJSON(data: BloomFilterJSON): BloomFilter {
    const bf = new BloomFilter({ capacity: data.capacity, errorRate: data.errorRate });
    (bf as unknown as { _bits: BitArray })["_bits"] = BitArray.fromBase64(data.bits, data.m);
    return bf;
  }
}
