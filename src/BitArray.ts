/** Compact fixed-size bit array backed by Uint32Array. */
export class BitArray {
  private readonly _buf: Uint32Array;
  readonly size: number;

  constructor(size: number) {
    this.size = size;
    this._buf = new Uint32Array(Math.ceil(size / 32));
  }

  set(index: number): void {
    this._buf[index >>> 5]! |= 1 << (index & 31);
  }

  get(index: number): boolean {
    return (this._buf[index >>> 5]! >>> (index & 31) & 1) === 1;
  }

  clear(): void {
    this._buf.fill(0);
  }

  /** Number of bits set to 1 (popcount). */
  popcount(): number {
    let n = 0;
    for (const w of this._buf) {
      let v = w;
      v = v - ((v >>> 1) & 0x55555555);
      v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
      n += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    }
    return n;
  }

  /** Export as a base64-encoded string for serialization. */
  toBase64(): string {
    const bytes = new Uint8Array(this._buf.buffer);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }

  /** Restore from a base64 string produced by `toBase64`. */
  static fromBase64(b64: string, size: number): BitArray {
    const arr = new BitArray(size);
    const raw = atob(b64);
    const bytes = new Uint8Array(arr._buf.buffer);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return arr;
  }
}
