import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  classifyWhitePackshot,
  removeEdgeConnectedWhiteBackground,
  sourceImageKeyFromUrl,
} from "@/lib/products/packshot-bg";
import { resolveStorefrontImageUrl } from "@/lib/products/storefront-image";

async function rgbaFromPng(png: Buffer) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

describe("packshot background removal", () => {
  it("classifies a white-border packshot with a coloured centre", async () => {
    const png = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 16,
              height: 16,
              channels: 3,
              background: { r: 220, g: 40, b: 40 },
            },
          })
            .png()
            .toBuffer(),
          left: 12,
          top: 12,
        },
      ])
      .png()
      .toBuffer();

    const { data, width, height } = await rgbaFromPng(png);
    const metrics = classifyWhitePackshot(data, width, height);
    expect(metrics.kind).toBe("packshot_white");
  });

  it("classifies a colourful lifestyle-like frame as lifestyle", async () => {
    const png = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 3,
        background: { r: 40, g: 90, b: 50 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 20,
              height: 10,
              channels: 3,
              background: { r: 200, g: 180, b: 40 },
            },
          })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
        {
          input: await sharp({
            create: {
              width: 20,
              height: 10,
              channels: 3,
              background: { r: 30, g: 30, b: 160 },
            },
          })
            .png()
            .toBuffer(),
          left: 20,
          top: 30,
        },
      ])
      .png()
      .toBuffer();

    const { data, width, height } = await rgbaFromPng(png);
    const metrics = classifyWhitePackshot(data, width, height);
    expect(metrics.kind).toBe("lifestyle");
  });

  it("removes only edge-connected white, keeps internal white", async () => {
    // White canvas, red ring, white centre (product white must survive)
    const width = 30;
    const height = 30;
    const data = Buffer.alloc(width * height * 4, 255);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const inOuter = x >= 8 && x < 22 && y >= 8 && y < 22;
        const inInner = x >= 12 && x < 18 && y >= 12 && y < 18;
        if (inOuter && !inInner) {
          data[i] = 30;
          data[i + 1] = 30;
          data[i + 2] = 200;
          data[i + 3] = 255;
        }
      }
    }

    const out = removeEdgeConnectedWhiteBackground(data, width, height);
    // Corner should be transparent
    expect(out[3]).toBe(0);
    // Internal white (centre) stays opaque
    const centre = (15 * width + 15) * 4;
    expect(out[centre + 3]).toBe(255);
    expect(out[centre]).toBe(255);
    // Blue ring stays
    const ring = (10 * width + 10) * 4;
    expect(out[ring + 3]).toBe(255);
    expect(out[ring + 2]).toBe(200);
  });

  it("parses source keys from storage URLs", () => {
    expect(
      sourceImageKeyFromUrl(
        "https://example.supabase.co/storage/v1/object/public/product-images/MD3423.png?v=1",
      ),
    ).toBe("MD3423.png");
  });
});

describe("resolveStorefrontImageUrl", () => {
  it("falls back to the original URL when no derivative is mapped", () => {
    expect(
      resolveStorefrontImageUrl(
        "https://example.com/product-images/UNKNOWN_SKU.jpg",
      ),
    ).toBe("https://example.com/product-images/UNKNOWN_SKU.jpg");
  });

  it("returns null for empty input", () => {
    expect(resolveStorefrontImageUrl(null)).toBeNull();
    expect(resolveStorefrontImageUrl("")).toBeNull();
  });
});
