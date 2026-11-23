const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

function rawModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}
const dataCodewords = (version: number) => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[version]! * BLOCKS[version]!;

function multiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function divisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = multiply(result[j]!, root);
      if (j + 1 < result.length) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = multiply(root, 0x02);
  }
  return result;
}
function remainder(data: number[], divisorValues: number[]): number[] {
  const result = divisorValues.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisorValues.forEach((coefficient, i) => { result[i] = result[i]! ^ multiply(coefficient, factor); });
  }
  return result;
}

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 1;
  for (; version <= 40; version++) if (4 + (version <= 9 ? 8 : 16) + bytes.length * 8 <= dataCodewords(version) * 8) break;
  if (version > 40) throw new Error('Text too long for a QR code.');
  const capacity = dataCodewords(version) * 8;
  const bits: number[] = [];
  const push = (value: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach(byte => push(byte, 8));
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));

  const blocks = BLOCKS[version]!, eccLength = ECC_PER_BLOCK[version]!;
  const raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks), shortLength = Math.floor(raw / blocks);
  const generator = divisor(eccLength);
  const parts: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const chunk = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
    k += chunk.length;
    const ecc = remainder(chunk, generator);
    if (i < shortBlocks) chunk.push(0);
    parts.push([...chunk, ...ecc]);
  }
  const codewords: number[] = [];
  for (let i = 0; i < parts[0]!.length; i++) parts.forEach((part, j) => { if (i !== shortLength - eccLength || j >= shortBlocks) codewords.push(part[i]!); });

  const size = version * 4 + 17;
  const modules = Array.from({length: size}, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({length: size}, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { modules[y]![x] = dark; fixed[y]![x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, distance !== 2 && distance !== 4);
    }
  }
  const align = alignmentPositions(version, size);
  align.forEach((ax, i) => align.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const format = (mask: number) => {
    const value = mask;
    let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const word = ((value << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((word >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const word = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((word >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark); set(b, a, dark);
    }
  }
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vertical : vertical;
        if (!fixed[y]![x] && index < codewords.length * 8) {
          modules[y]![x] = ((codewords[index >>> 3]! >>> (7 - (index & 7))) & 1) !== 0;
          index++;
        }
      }
    }
  }
  const masks: Array<(x: number, y: number) => boolean> = [
    (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const apply = (mask: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y]![x] && masks[mask]!(x, y)) modules[y]![x] = !modules[y]![x]; };
  const penalty = () => {
    let score = 0, dark = 0;
    for (let a = 0; a < size; a++) {
      for (const line of [(i: number) => modules[a]![i]!, (i: number) => modules[i]![a]!]) {
        let run = 1;
        for (let i = 1; i < size; i++) {
          if (line(i) === line(i - 1)) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1;
        }
      }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (modules[y]![x]) dark++;
      if (x < size - 1 && y < size - 1) {
        const c = modules[y]![x];
        if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) score += 3;
      }
    }
    return score + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  };
  let best = 0, lowest = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    apply(mask); format(mask);
    const score = penalty();
    if (score < lowest) { lowest = score; best = mask; }
    apply(mask);
  }
  apply(best); format(best);
  return modules;
}

export function qrSvg(text: string, scale = 6, quiet = 4): string {
  const matrix = qrMatrix(text);
  const size = matrix.length + quiet * 2;
  let path = '';
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * scale}" height="${size * scale}" shape-rendering="crispEdges" role="img"><rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${path}"/></svg>`;
}
