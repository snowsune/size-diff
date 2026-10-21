#!/usr/bin/env node
/**
 * 
 * :P okay, there was a LOT of stuff i could do for local file caching and managing renders and previews.
 * or....
 * json stdin -> png stdout
 * 
 * :P ymmv
 *
 *   node scripts/render_preview.mjs --art-root ./art < cfg.json > out.png
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { installNodeCanvas } from "./install_node_canvas.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

function toArtFileUrl(url, artRoot) {
  if (!url) return url;
  if (url.startsWith("file:")) return url;
  let pathname = url;
  try {
    pathname = new URL(url, "http://size-diff.local").pathname;
  } catch {
    /* keep */
  }
  const prefix = "/art/";
  if (!pathname.startsWith(prefix)) {
    throw new Error(`expected /art/ URL, got: ${url}`);
  }
  const rel = decodeURIComponent(pathname.slice(prefix.length));
  return pathToFileURL(resolve(artRoot, rel)).href;
}

function remapArtUrls(config, artRoot) {
  return {
    ...config,
    characters: (config.characters || []).map((c) => {
      const next = { ...c, imageUrl: toArtFileUrl(c.imageUrl, artRoot) };
      if (c.composite?.base) {
        next.composite = {
          base: toArtFileUrl(c.composite.base, artRoot),
          parts: (c.composite.parts || []).map((p) => ({
            ...p,
            jsonUrl: toArtFileUrl(p.jsonUrl, artRoot),
          })),
        };
      }
      return next;
    }),
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const artRoot = resolve(arg("--art-root", "art"));
  const rawText = await readStdin();
  if (!rawText.trim()) {
    console.error("usage: render_preview.mjs --art-root DIR < config.json");
    process.exit(2);
  }

  await installNodeCanvas();
  const { exportLineupPreviewPng } = await import("./preview_draw.mjs");

  const raw = JSON.parse(rawText);
  const blob = await exportLineupPreviewPng(remapArtUrls(raw, artRoot));
  const buf = Buffer.from(await blob.arrayBuffer());
  process.stdout.write(buf);
  console.error(`preview ${buf.length} bytes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
