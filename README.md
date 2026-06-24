# bloomkit

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

[![npm](https://img.shields.io/npm/v/bloomkit)](https://www.npmjs.com/package/bloomkit)
[![CI](https://github.com/trananhtung/bloomkit/actions/workflows/ci.yml/badge.svg)](https://github.com/trananhtung/bloomkit/actions)
[![license](https://img.shields.io/npm/l/bloomkit)](LICENSE)

Zero-dependency TypeScript Bloom filter — standard, counting, and scalable variants. Probabilistic set membership with tunable false-positive rate.

```bash
npm install bloomkit
```

Inspired by Python's [pybloom-live](https://pypi.org/project/pybloom-live/), Java's [Guava BloomFilter](https://guava.dev/releases/33.4.6-jre/api/docs/com/google/common/hash/BloomFilter.html), and Go's [bits-and-blooms/bloom](https://github.com/bits-and-blooms/bloom).

## Why bloomkit?

- **`bloomfilter`** on npm: last published **2013**, no TypeScript types.
- **`bloom-filters`** on npm: active, but ships **8 runtime dependencies** (lodash, xxhashjs, seedrandom, long, reflect-metadata…).
- **bloomkit**: zero runtime dependencies, native TypeScript, three filter variants, base64 serialization.

## What is a Bloom filter?

A Bloom filter is a **space-efficient probabilistic data structure** for set membership:

- `has(item)` can return **false positives** (item not added, but `has` returns `true`) at a configurable rate.
- `has(item)` **never returns false negatives** — if it says `false`, the item is definitely not in the set.
- Memory: a 1M-item filter with 1% FPR uses ~1.2 MB (vs. storing strings directly).

**Common uses:** deduplication pipelines, cache pre-screening, spam detection, database query optimization, network packet routing.

## Quick start

```ts
import { BloomFilter } from "bloomkit";

// 1 million items, 1% false-positive rate
const bf = new BloomFilter({ capacity: 1_000_000, errorRate: 0.01 });

bf.add("user:42");
bf.has("user:42"); // true  (definitely in the set)
bf.has("user:99"); // false (with 99% probability)
```

## API

### `BloomFilter` — standard (no deletion)

```ts
const bf = new BloomFilter({ capacity: 10_000, errorRate: 0.01 });

bf.add("item");          // add to filter
bf.has("item");          // true — may be a false positive
bf.size;                 // number of items added
bf.m;                    // bit-array size (auto-computed)
bf.k;                    // number of hash functions
bf.errorRate;            // configured FPR target
bf.currentFPR;           // estimated actual FPR given items inserted
bf.clear();              // reset

// Serialize / deserialize
const json = bf.toJSON();
const bf2 = BloomFilter.fromJSON(json);
```

### `CountingBloomFilter` — supports deletion

Maintains per-cell counters so items can be removed. Uses 4-bit counters (default) or 8-bit for higher multiplicity.

```ts
import { CountingBloomFilter } from "bloomkit";

const cbf = new CountingBloomFilter({ capacity: 10_000, errorRate: 0.01 });

cbf.add("session:abc");
cbf.has("session:abc");   // true
cbf.remove("session:abc");
cbf.has("session:abc");   // false

// 8-bit counters for items added many times
const cbf8 = new CountingBloomFilter({ capacity: 1000, counterBits: 8 });
```

### `ScalableBloomFilter` — grows automatically

Use when you don't know the final set size upfront. Creates sub-filters as needed, maintaining the target FPR.

Port of [pybloom-live's `ScalableBloomFilter`](https://github.com/jaybaird/python-bloomfilter).

```ts
import { ScalableBloomFilter } from "bloomkit";

const sbf = new ScalableBloomFilter({ errorRate: 0.01 });

// Add any number of items — filter grows as needed
for (const id of millionIds) sbf.add(id);
sbf.has(id); // reliable

sbf.filterCount;    // number of sub-filters created
sbf.bitsAllocated;  // total bits across all sub-filters
```

### Utility exports

```ts
import { murmur3, fnv1a, hashPositions, optimalM, optimalK, BitArray } from "bloomkit";

murmur3("hello");               // MurmurHash3 (32-bit)
fnv1a("hello");                 // FNV-1a (32-bit)
hashPositions("hello", 7, 1000); // 7 positions in [0, 1000)
optimalM(1000, 0.01);           // optimal bit count for 1k items at 1% FPR
optimalK(9585, 1000);           // optimal k for m=9585, n=1000
```

## Examples

### URL deduplication (web crawler)

```ts
import { BloomFilter } from "bloomkit";

const seen = new BloomFilter({ capacity: 10_000_000, errorRate: 0.001 });

async function crawl(url: string) {
  if (seen.has(url)) return; // skip if probably seen
  seen.add(url);
  await fetch(url);
}
```

### Cache stampede prevention

```ts
import { BloomFilter } from "bloomkit";

const popularKeys = new BloomFilter({ capacity: 100_000, errorRate: 0.01 });

function getCached(key: string) {
  if (!popularKeys.has(key)) {
    // Likely a cache miss — skip to DB directly
    return db.get(key);
  }
  return cache.get(key) ?? db.get(key);
}
```

### Session tracking with expiry

```ts
import { CountingBloomFilter } from "bloomkit";

const activeSessions = new CountingBloomFilter({ capacity: 50_000 });

function login(sessionId: string) { activeSessions.add(sessionId); }
function logout(sessionId: string) { activeSessions.remove(sessionId); }
function isActive(sessionId: string) { return activeSessions.has(sessionId); }
```

### Unknown-size dataset

```ts
import { ScalableBloomFilter } from "bloomkit";

const seen = new ScalableBloomFilter({ errorRate: 0.01 });

for await (const record of streamRecords()) {
  if (!seen.has(record.id)) {
    seen.add(record.id);
    await process(record);
  }
}
```

## Comparison

| Package | Weekly downloads | Last release | TypeScript | Zero-dep | Variants |
|---------|-----------------|--------------|------------|----------|----------|
| **bloomkit** | — | 2024 | ✅ native | ✅ | Standard + Counting + Scalable |
| bloomfilter | ~12k | **2013** | ❌ | ✅ | Standard only |
| bloom-filters | ~500k | 2024 (active) | ❌ | ❌ (8 deps) | Many |

## Contributors ✨

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome — code, docs, bug reports, ideas, reviews! See the [emoji key](https://allcontributors.org/docs/en/emoji-key) for how each contribution is recognized, and open a PR or issue to get involved.

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/trananhtung"><img src="https://avatars.githubusercontent.com/u/30992229?v=4?s=100" width="100px;" alt="Tung Tran"/><br /><sub><b>Tung Tran</b></sub></a><br /><a href="https://github.com/trananhtung/./commits?author=trananhtung" title="Code">💻</a> <a href="#maintenance-trananhtung" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

MIT
