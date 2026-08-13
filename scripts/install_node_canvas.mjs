/**
 * Minimal DOM canvas shim so Painter's Canvas can run under Node.
 */

import { createCanvas, Image as SkImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

let installed = false;

export async function installNodeCanvas() {
  if (installed) return;
  installed = true;

  class HTMLElement {}
  class HTMLCanvasElement {}
  globalThis.HTMLElement = HTMLElement;
  globalThis.HTMLCanvasElement = HTMLCanvasElement;

  const probe = createCanvas(1, 1);
  Object.setPrototypeOf(
    Object.getPrototypeOf(probe),
    HTMLCanvasElement.prototype,
  );

  function loadableSrc(src) {
    if (typeof src === "string" && src.startsWith("file:")) {
      return fileURLToPath(src);
    }
    return src;
  }

  globalThis.Image = class Image extends SkImage {
    set src(value) {
      super.src = typeof value === "string" ? loadableSrc(value) : value;
    }
    get src() {
      return super.src;
    }
  };

  globalThis.document = {
    createElement(tag) {
      if (String(tag).toLowerCase() !== "canvas") {
        throw new Error(
          `document.createElement("${tag}") is not supported in Node`,
        );
      }
      const canvas = createCanvas(300, 150);
      // ScaleCanvas writes layout size onto canvas.style
      if (!canvas.style) canvas.style = {};
      return canvas;
    },
  };

  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.location) globalThis.location = { href: "file:///" };
  if (!globalThis.window.location) {
    globalThis.window.location = globalThis.location;
  }

  const origFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : String(input?.url ?? input);
    if (url.startsWith("file:")) {
      const body = await readFile(fileURLToPath(url));
      const lower = url.toLowerCase();
      const type = lower.endsWith(".json")
        ? "application/json"
        : lower.endsWith(".png")
          ? "image/png"
          : "application/octet-stream";
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": type },
      });
    }
    return origFetch(input, init);
  };
}
