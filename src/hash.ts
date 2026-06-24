/**
 * MurmurHash3 (32-bit, x86) — fast non-cryptographic hash.
 * Returns an unsigned 32-bit integer.
 */
export function murmur3(key: string, seed = 0): number {
  let h = seed >>> 0;
  const len = key.length;
  let i = 0;

  while (i <= len - 4) {
    let k =
      ((key.charCodeAt(i) & 0xff)) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
    i += 4;
  }

  let remaining = 0;
  switch (len & 3) {
    case 3: remaining ^= (key.charCodeAt(i + 2) & 0xff) << 16; // fall through
    case 2: remaining ^= (key.charCodeAt(i + 1) & 0xff) << 8;  // fall through
    case 1:
      remaining ^= key.charCodeAt(i) & 0xff;
      remaining = Math.imul(remaining, 0xcc9e2d51);
      remaining = (remaining << 15) | (remaining >>> 17);
      remaining = Math.imul(remaining, 0x1b873593);
      h ^= remaining;
  }

  h ^= len;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * FNV-1a (32-bit) — second independent hash for double-hashing.
 */
export function fnv1a(key: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Generate `k` hash positions in `[0, m)` using double hashing.
 * gi(x) = (h1(x) + i * h2(x)) mod m
 */
export function hashPositions(key: string, k: number, m: number): number[] {
  const h1 = murmur3(key);
  const h2 = fnv1a(key);
  const positions: number[] = new Array(k);
  for (let i = 0; i < k; i++) {
    positions[i] = ((h1 + i * h2) >>> 0) % m;
  }
  return positions;
}
