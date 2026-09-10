/**
 * White-background packshot detection + edge-connected transparency.
 * Presentation derivatives only — never mutates source assets.
 */
import sharp from "sharp";

export type ImageBackgroundKind =
  | "packshot_white"
  | "lifestyle"
  | "ambiguous";

export type PackshotAuditMetrics = {
  width: number;
  height: number;
  borderNearWhiteRatio: number;
  borderColourVariance: number;
  cornerNearWhiteCount: number;
  kind: ImageBackgroundKind;
};

const NEAR_WHITE_MIN = 242;
/** Soft shadow / off-white still treated as removable background when edge-connected. */
const FLOOD_WHITE_MIN = 228;

function isNearWhite(r: number, g: number, b: number, min = NEAR_WHITE_MIN): boolean {
  return r >= min && g >= min && b >= min;
}

function borderSampleIndices(width: number, height: number): number[] {
  const indices: number[] = [];
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.02));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < band || y < band || x >= width - band || y >= height - band) {
        indices.push(y * width + x);
      }
    }
  }
  return indices;
}

function cornerNearWhite(data: Buffer, width: number, height: number): number {
  const sample = Math.max(4, Math.round(Math.min(width, height) * 0.04));
  const regions: Array<[number, number]> = [
    [0, 0],
    [width - sample, 0],
    [0, height - sample],
    [width - sample, height - sample],
  ];
  let hits = 0;
  for (const [ox, oy] of regions) {
    let regionWhite = 0;
    let total = 0;
    for (let y = oy; y < oy + sample && y < height; y++) {
      for (let x = ox; x < ox + sample && x < width; x++) {
        const i = (y * width + x) * 4;
        total++;
        if (isNearWhite(data[i]!, data[i + 1]!, data[i + 2]!)) regionWhite++;
      }
    }
    if (total > 0 && regionWhite / total >= 0.85) hits++;
  }
  return hits;
}

/**
 * Classify whether an RGBA buffer looks like an isolated white-background packshot.
 * Conservative: ambiguous → leave original untouched.
 */
export function classifyWhitePackshot(
  data: Buffer,
  width: number,
  height: number,
): PackshotAuditMetrics {
  const border = borderSampleIndices(width, height);
  let nearWhite = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const idx of border) {
    const i = idx * 4;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    sumR += r;
    sumG += g;
    sumB += b;
    if (isNearWhite(r, g, b)) nearWhite++;
  }

  const n = border.length || 1;
  const meanR = sumR / n;
  const meanG = sumG / n;
  const meanB = sumB / n;
  let varAcc = 0;
  for (const idx of border) {
    const i = idx * 4;
    const dr = data[i]! - meanR;
    const dg = data[i + 1]! - meanG;
    const db = data[i + 2]! - meanB;
    varAcc += (dr * dr + dg * dg + db * db) / 3;
  }
  const borderColourVariance = varAcc / n;
  const borderNearWhiteRatio = nearWhite / n;
  const cornerNearWhiteCount = cornerNearWhite(data, width, height);

  let kind: ImageBackgroundKind = "ambiguous";
  if (
    borderNearWhiteRatio >= 0.88 &&
    borderColourVariance < 180 &&
    cornerNearWhiteCount >= 3
  ) {
    kind = "packshot_white";
  } else if (borderNearWhiteRatio < 0.55 || borderColourVariance > 900) {
    kind = "lifestyle";
  }

  return {
    width,
    height,
    borderNearWhiteRatio,
    borderColourVariance,
    cornerNearWhiteCount,
    kind,
  };
}

/**
 * Edge-connected flood fill: only near-white pixels reachable from the image border
 * become transparent. Internal white packaging / product parts stay opaque.
 */
export function removeEdgeConnectedWhiteBackground(
  rgba: Buffer,
  width: number,
  height: number,
  whiteMin = FLOOD_WHITE_MIN,
): Buffer {
  const out = Buffer.from(rgba);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qh = 0;
  let qt = 0;

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isNearWhite(out[i]!, out[i + 1]!, out[i + 2]!, whiteMin)) return;
    visited[idx] = 1;
    queue[qt++] = idx;
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (qh < qt) {
    const idx = queue[qh++]!;
    const x = idx % width;
    const y = (idx / width) | 0;
    const i = idx * 4;
    out[i + 3] = 0;
    tryEnqueue(x - 1, y);
    tryEnqueue(x + 1, y);
    tryEnqueue(x, y - 1);
    tryEnqueue(x, y + 1);
  }

  // Light edge cleanup: kill near-white pixels that only touch transparent
  // (reduces 1px halos without eating interior product whites).
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const i = idx * 4;
      if (out[i + 3] === 0) continue;
      if (!isNearWhite(out[i]!, out[i + 1]!, out[i + 2]!, whiteMin + 8)) continue;
      let transparentNeighbours = 0;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const ni = ((y + dy) * width + (x + dx)) * 4;
        if (out[ni + 3] === 0) transparentNeighbours++;
      }
      if (transparentNeighbours >= 3) out[i + 3] = 0;
    }
  }

  return out;
}

export async function loadRgba(buffer: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
}> {
  const image = sharp(buffer, { failOn: "none" }).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function classifyImageBuffer(
  buffer: Buffer,
): Promise<PackshotAuditMetrics> {
  const { data, width, height } = await loadRgba(buffer);
  return classifyWhitePackshot(data, width, height);
}

export async function deriveTransparentPackshotPng(
  sourceBuffer: Buffer,
): Promise<{ png: Buffer; metrics: PackshotAuditMetrics }> {
  const { data, width, height } = await loadRgba(sourceBuffer);
  const metrics = classifyWhitePackshot(data, width, height);
  if (metrics.kind !== "packshot_white") {
    throw new Error(
      `Refusing to process non-packshot image (kind=${metrics.kind})`,
    );
  }
  const cleared = removeEdgeConnectedWhiteBackground(data, width, height);
  const png = await sharp(cleared, {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, metrics };
}

export {
  derivedPackshotPublicPath,
  sourceImageKeyFromUrl,
} from "./storefront-image-key";
