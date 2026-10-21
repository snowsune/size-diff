#!/usr/bin/env node
/**
 * json stdin -> png stdout for CalculaTAUR share previews.
 *
 *   node scripts/render_taur_preview.mjs --art-root ./art < cfg.json > out.png
 */

import { resolve } from "node:path";
import { installNodeCanvas } from "./install_node_canvas.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
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
    console.error(
      "usage: render_taur_preview.mjs --art-root DIR < config.json",
    );
    process.exit(2);
  }

  await installNodeCanvas();
  const { exportTaurPreviewPng } = await import("./taur_preview_draw.mjs");

  const raw = JSON.parse(rawText);
  const blob = await exportTaurPreviewPng({
    ...raw,
    artRoot,
  });
  const buf = Buffer.from(await blob.arrayBuffer());
  process.stdout.write(buf);
  console.error(`taur preview ${buf.length} bytes`);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
