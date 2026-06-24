import { BloomFilter, CountingBloomFilter, ScalableBloomFilter, murmur3, fnv1a, optimalM, optimalK, BitArray } from "../src/index.js";

// ── hash functions ────────────────────────────────────────────────────────────
describe("murmur3", () => {
  it("produces consistent output for the same input", () => {
    expect(murmur3("hello")).toBe(murmur3("hello"));
    expect(murmur3("world")).toBe(murmur3("world"));
  });

  it("produces different output for different inputs", () => {
    expect(murmur3("hello")).not.toBe(murmur3("world"));
  });

  it("seed changes output", () => {
    expect(murmur3("hello", 0)).not.toBe(murmur3("hello", 42));
  });

  it("returns unsigned 32-bit integer", () => {
    const h = murmur3("test");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });

  it("handles empty string", () => {
    expect(() => murmur3("")).not.toThrow();
    expect(typeof murmur3("")).toBe("number");
  });
});

describe("fnv1a", () => {
  it("produces consistent output", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"));
  });

  it("differs from murmur3", () => {
    expect(fnv1a("hello")).not.toBe(murmur3("hello"));
  });
});

// ── optimal sizing ────────────────────────────────────────────────────────────
describe("optimalM / optimalK", () => {
  it("optimalM grows as capacity grows", () => {
    expect(optimalM(1000, 0.01)).toBeLessThan(optimalM(10000, 0.01));
  });

  it("optimalM grows as errorRate shrinks", () => {
    expect(optimalM(1000, 0.1)).toBeLessThan(optimalM(1000, 0.001));
  });

  it("optimalK is at least 1", () => {
    expect(optimalK(optimalM(100, 0.01), 100)).toBeGreaterThanOrEqual(1);
  });
});

// ── BitArray ──────────────────────────────────────────────────────────────────
describe("BitArray", () => {
  it("set and get bits", () => {
    const arr = new BitArray(64);
    arr.set(0); arr.set(31); arr.set(63);
    expect(arr.get(0)).toBe(true);
    expect(arr.get(1)).toBe(false);
    expect(arr.get(31)).toBe(true);
    expect(arr.get(63)).toBe(true);
  });

  it("clear resets all bits", () => {
    const arr = new BitArray(32);
    arr.set(5); arr.clear();
    expect(arr.get(5)).toBe(false);
  });

  it("popcount counts set bits", () => {
    const arr = new BitArray(64);
    arr.set(0); arr.set(1); arr.set(63);
    expect(arr.popcount()).toBe(3);
  });

  it("toBase64/fromBase64 round-trips", () => {
    const arr = new BitArray(128);
    arr.set(5); arr.set(100); arr.set(127);
    const b64 = arr.toBase64();
    const arr2 = BitArray.fromBase64(b64, 128);
    expect(arr2.get(5)).toBe(true);
    expect(arr2.get(100)).toBe(true);
    expect(arr2.get(127)).toBe(true);
    expect(arr2.get(50)).toBe(false);
  });
});

// ── BloomFilter ───────────────────────────────────────────────────────────────
describe("BloomFilter", () => {
  describe("construction", () => {
    it("creates with default 1% error rate", () => {
      const bf = new BloomFilter({ capacity: 1000 });
      expect(bf.errorRate).toBe(0.01);
      expect(bf.capacity).toBe(1000);
      expect(bf.m).toBeGreaterThan(0);
      expect(bf.k).toBeGreaterThanOrEqual(1);
    });

    it("throws for invalid capacity", () => {
      expect(() => new BloomFilter({ capacity: 0 })).toThrow(RangeError);
      expect(() => new BloomFilter({ capacity: -1 })).toThrow(RangeError);
    });

    it("throws for invalid error rate", () => {
      expect(() => new BloomFilter({ capacity: 100, errorRate: 0 })).toThrow(RangeError);
      expect(() => new BloomFilter({ capacity: 100, errorRate: 1 })).toThrow(RangeError);
      expect(() => new BloomFilter({ capacity: 100, errorRate: 1.5 })).toThrow(RangeError);
    });

    it("tighter errorRate produces larger m", () => {
      const loose = new BloomFilter({ capacity: 1000, errorRate: 0.1 });
      const tight = new BloomFilter({ capacity: 1000, errorRate: 0.001 });
      expect(tight.m).toBeGreaterThan(loose.m);
    });
  });

  describe("membership", () => {
    it("has() returns true for all added items (no false negatives)", () => {
      const bf = new BloomFilter({ capacity: 1000, errorRate: 0.01 });
      const items = Array.from({ length: 500 }, (_, i) => `item:${i}`);
      for (const item of items) bf.add(item);
      for (const item of items) {
        expect(bf.has(item)).toBe(true);
      }
    });

    it("has() returns false for items not added (no false positives in practice)", () => {
      const bf = new BloomFilter({ capacity: 1000, errorRate: 0.01 });
      for (let i = 0; i < 100; i++) bf.add(`added:${i}`);
      let fps = 0;
      for (let i = 0; i < 1000; i++) {
        if (bf.has(`notadded:${i}`)) fps++;
      }
      // FPR should be well under 5% with 1% target (100 items, cap 1000)
      expect(fps / 1000).toBeLessThan(0.05);
    });

    it("has() returns false for untouched filter", () => {
      const bf = new BloomFilter({ capacity: 100 });
      expect(bf.has("anything")).toBe(false);
    });
  });

  describe("size tracking", () => {
    it("size increments on each add", () => {
      const bf = new BloomFilter({ capacity: 100 });
      expect(bf.size).toBe(0);
      bf.add("a"); bf.add("b"); bf.add("a"); // duplicates counted
      expect(bf.size).toBe(3);
    });
  });

  describe("clear", () => {
    it("clear resets filter", () => {
      const bf = new BloomFilter({ capacity: 100 });
      bf.add("hello");
      bf.clear();
      expect(bf.has("hello")).toBe(false);
      expect(bf.size).toBe(0);
    });
  });

  describe("serialization", () => {
    it("toJSON/fromJSON round-trips membership", () => {
      const bf = new BloomFilter({ capacity: 100, errorRate: 0.01 });
      bf.add("apple"); bf.add("banana"); bf.add("cherry");

      const json = bf.toJSON();
      expect(json.type).toBe("BloomFilter");

      const bf2 = BloomFilter.fromJSON(json);
      expect(bf2.has("apple")).toBe(true);
      expect(bf2.has("banana")).toBe(true);
      expect(bf2.has("cherry")).toBe(true);
      expect(bf2.has("dragon")).toBe(false);
    });

    it("toJSON produces valid JSON", () => {
      const bf = new BloomFilter({ capacity: 100 });
      bf.add("test");
      expect(() => JSON.stringify(bf.toJSON())).not.toThrow();
    });
  });

  describe("currentFPR", () => {
    it("currentFPR starts near 0 for empty filter", () => {
      const bf = new BloomFilter({ capacity: 1000, errorRate: 0.01 });
      expect(bf.currentFPR).toBeLessThan(0.001);
    });
  });

  describe("false-positive rate accuracy", () => {
    it("measured FPR is close to target for 1% errorRate", () => {
      const capacity = 10000;
      const errorRate = 0.01;
      const bf = new BloomFilter({ capacity, errorRate });

      for (let i = 0; i < capacity; i++) bf.add(`member:${i}`);

      let fps = 0;
      const trials = 10000;
      for (let i = 0; i < trials; i++) {
        if (bf.has(`nonmember:${i}`)) fps++;
      }
      const measured = fps / trials;
      // Within 3× of target (probabilistic — almost certain to pass)
      expect(measured).toBeLessThan(errorRate * 3);
    });
  });
});

// ── CountingBloomFilter ───────────────────────────────────────────────────────
describe("CountingBloomFilter", () => {
  it("add and has work like standard filter", () => {
    const cbf = new CountingBloomFilter({ capacity: 1000 });
    cbf.add("hello");
    expect(cbf.has("hello")).toBe(true);
    expect(cbf.has("world")).toBe(false);
  });

  it("remove allows deletion", () => {
    const cbf = new CountingBloomFilter({ capacity: 1000 });
    cbf.add("hello");
    expect(cbf.has("hello")).toBe(true);
    cbf.remove("hello");
    expect(cbf.has("hello")).toBe(false);
  });

  it("remove added twice requires two removes", () => {
    const cbf = new CountingBloomFilter({ capacity: 1000 });
    cbf.add("hello"); cbf.add("hello");
    cbf.remove("hello");
    expect(cbf.has("hello")).toBe(true);
    cbf.remove("hello");
    expect(cbf.has("hello")).toBe(false);
  });

  it("no false negatives for members", () => {
    const cbf = new CountingBloomFilter({ capacity: 500 });
    const items = Array.from({ length: 200 }, (_, i) => `item:${i}`);
    for (const item of items) cbf.add(item);
    for (const item of items) {
      expect(cbf.has(item)).toBe(true);
    }
  });

  it("size decrements on remove", () => {
    const cbf = new CountingBloomFilter({ capacity: 100 });
    cbf.add("a"); cbf.add("b");
    expect(cbf.size).toBe(2);
    cbf.remove("a");
    expect(cbf.size).toBe(1);
  });

  it("clear resets filter", () => {
    const cbf = new CountingBloomFilter({ capacity: 100 });
    cbf.add("hello");
    cbf.clear();
    expect(cbf.has("hello")).toBe(false);
    expect(cbf.size).toBe(0);
  });

  it("8-bit counter variant works", () => {
    const cbf = new CountingBloomFilter({ capacity: 100, counterBits: 8 });
    cbf.add("x");
    expect(cbf.has("x")).toBe(true);
    cbf.remove("x");
    expect(cbf.has("x")).toBe(false);
  });
});

// ── ScalableBloomFilter ───────────────────────────────────────────────────────
describe("ScalableBloomFilter", () => {
  it("no false negatives for added items", () => {
    const sbf = new ScalableBloomFilter({ initialCapacity: 100, errorRate: 0.01 });
    const items = Array.from({ length: 1000 }, (_, i) => `item:${i}`);
    for (const item of items) sbf.add(item);
    for (const item of items) {
      expect(sbf.has(item)).toBe(true);
    }
  });

  it("grows beyond initial capacity", () => {
    const sbf = new ScalableBloomFilter({ initialCapacity: 50 });
    for (let i = 0; i < 300; i++) sbf.add(`item:${i}`);
    expect(sbf.filterCount).toBeGreaterThan(1);
  });

  it("size tracks items added", () => {
    const sbf = new ScalableBloomFilter({ initialCapacity: 100 });
    for (let i = 0; i < 50; i++) sbf.add(`item:${i}`);
    expect(sbf.size).toBe(50);
  });

  it("throws for invalid errorRate", () => {
    expect(() => new ScalableBloomFilter({ errorRate: 0 })).toThrow(RangeError);
    expect(() => new ScalableBloomFilter({ errorRate: 1 })).toThrow(RangeError);
  });

  it("throws for scaleFactor < 2", () => {
    expect(() => new ScalableBloomFilter({ scaleFactor: 1 })).toThrow(RangeError);
  });

  it("clear resets filter", () => {
    const sbf = new ScalableBloomFilter();
    sbf.add("hello");
    sbf.clear();
    expect(sbf.has("hello")).toBe(false);
    expect(sbf.filterCount).toBe(1);
  });

  it("bitsAllocated grows as filters are added", () => {
    const sbf = new ScalableBloomFilter({ initialCapacity: 10 });
    const initialBits = sbf.bitsAllocated;
    for (let i = 0; i < 100; i++) sbf.add(`item:${i}`);
    expect(sbf.bitsAllocated).toBeGreaterThan(initialBits);
  });

  it("measured FPR stays within reasonable bounds", () => {
    const sbf = new ScalableBloomFilter({ initialCapacity: 100, errorRate: 0.01 });
    for (let i = 0; i < 500; i++) sbf.add(`member:${i}`);
    let fps = 0;
    for (let i = 0; i < 5000; i++) {
      if (sbf.has(`nonmember:${i}`)) fps++;
    }
    // Scalable filter's actual FPR may be slightly higher than target due to series
    expect(fps / 5000).toBeLessThan(0.1);
  });
});
