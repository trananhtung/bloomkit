import { BloomFilter } from "./BloomFilter.js";

export interface ScalableBloomFilterOptions {
  /**
   * Initial capacity (items before first resize). Default: 1000.
   */
  initialCapacity?: number;
  /**
   * Target overall false-positive rate. Default: 0.01.
   * Each sub-filter uses `errorRate * tighteningRatio^i` so the series
   * converges to a total FPR ≤ `errorRate`.
   */
  errorRate?: number;
  /**
   * Scale factor: each new sub-filter has `scaleFactor × previous capacity`.
   * Common values: 2 (default) or 4.
   */
  scaleFactor?: number;
  /**
   * Ratio by which each sub-filter tightens its FPR. Default: 0.9.
   * Must be in (0, 1).
   */
  tighteningRatio?: number;
}

/**
 * Scalable Bloom filter — grows automatically as items are added, so you
 * don't need to know the final set size upfront.
 *
 * Maintains a series of standard BloomFilters; when the current one is full,
 * a new one is created with higher capacity and tighter FPR.
 *
 * Port of Python pybloom-live's `ScalableBloomFilter`.
 *
 * @example
 * const sbf = new ScalableBloomFilter({ errorRate: 0.01 });
 * for (const id of millionIds) sbf.add(id);
 * sbf.has(id); // reliable, even with 1M+ items
 */
export class ScalableBloomFilter {
  private readonly _initialCapacity: number;
  private readonly _errorRate: number;
  private readonly _scaleFactor: number;
  private readonly _tighteningRatio: number;
  private _filters: BloomFilter[];
  private _count = 0;

  constructor(options: ScalableBloomFilterOptions = {}) {
    this._initialCapacity = options.initialCapacity ?? 1000;
    this._errorRate = options.errorRate ?? 0.01;
    this._scaleFactor = options.scaleFactor ?? 2;
    this._tighteningRatio = options.tighteningRatio ?? 0.9;

    if (this._errorRate <= 0 || this._errorRate >= 1) throw new RangeError("errorRate must be in (0, 1)");
    if (this._scaleFactor < 2) throw new RangeError("scaleFactor must be >= 2");
    if (this._tighteningRatio <= 0 || this._tighteningRatio >= 1) throw new RangeError("tighteningRatio must be in (0, 1)");

    this._filters = [this._createFilter(0)];
  }

  private _createFilter(index: number): BloomFilter {
    const capacity = Math.ceil(this._initialCapacity * Math.pow(this._scaleFactor, index));
    const errorRate = this._errorRate * Math.pow(this._tighteningRatio, index);
    return new BloomFilter({ capacity, errorRate });
  }

  /** Add an item. The filter grows automatically when the current slice is full. */
  add(item: string): this {
    const current = this._filters[this._filters.length - 1]!;

    // Grow when we'd exceed capacity (keeps FPR ≤ target)
    if (current.size >= current.capacity) {
      this._filters.push(this._createFilter(this._filters.length));
    }

    this._filters[this._filters.length - 1]!.add(item);
    this._count++;
    return this;
  }

  /**
   * Test membership — checks all sub-filters.
   * Returns `true` if item may have been added, `false` if definitely not.
   */
  has(item: string): boolean {
    for (const filter of this._filters) {
      if (filter.has(item)) return true;
    }
    return false;
  }

  /** Total number of items added (approximate). */
  get size(): number {
    return this._count;
  }

  /** Number of internal sub-filters created so far. */
  get filterCount(): number {
    return this._filters.length;
  }

  /** Total bits allocated across all sub-filters. */
  get bitsAllocated(): number {
    return this._filters.reduce((s, f) => s + f.m, 0);
  }

  /** Target false-positive rate. */
  get errorRate(): number {
    return this._errorRate;
  }

  /** Reset the filter. */
  clear(): this {
    this._filters = [this._createFilter(0)];
    this._count = 0;
    return this;
  }
}
