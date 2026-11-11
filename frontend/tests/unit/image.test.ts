import { afterEach, describe, expect, it, vi } from "vitest";

import { downscaleToJpeg } from "@/lib/image";

const original = new Blob(["x"], { type: "image/heic" });

/** OffscreenCanvas falso que registra o tamanho e devolve um JPEG fictício. */
function stubCanvas() {
  const sizes: [number, number][] = [];
  const convertToBlob = vi.fn(async (opts: ImageEncodeOptions) => new Blob(["jpg"], { type: opts.type }));
  class FakeCanvas {
    constructor(w: number, h: number) {
      sizes.push([w, h]);
    }
    getContext() {
      return { drawImage: vi.fn() };
    }
    convertToBlob = convertToBlob;
  }
  vi.stubGlobal("OffscreenCanvas", FakeCanvas);
  return { sizes, convertToBlob };
}

function stubBitmap(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width, height, close }));
  return close;
}

describe("downscaleToJpeg", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devolve o original quando o navegador não decodifica (ex.: HEIC no Chrome)", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new DOMException("no", "InvalidStateError")));
    expect(await downscaleToJpeg(original)).toBe(original);
  });

  it("reduz o lado maior para 2000 px mantendo a proporção, em JPEG 0,8", async () => {
    const close = stubBitmap(4000, 3000);
    const { sizes, convertToBlob } = stubCanvas();
    const out = await downscaleToJpeg(original);
    expect(sizes).toEqual([[2000, 1500]]);
    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/jpeg", quality: 0.8 });
    expect(out.type).toBe("image/jpeg");
    expect(close).toHaveBeenCalled();
  });

  it("não amplia foto pequena", async () => {
    stubBitmap(800, 1200);
    const { sizes } = stubCanvas();
    await downscaleToJpeg(original);
    expect(sizes).toEqual([[800, 1200]]);
  });
});
