/**
 * Node entry for lineup to png
 */

import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LINEUP_DRAW = pathToFileURL(
  resolve(__dirname, "../app/static/js/size_diff/lineup_draw.js"),
).href;

const { exportLineupPreviewPng } = await import(LINEUP_DRAW);

export { exportLineupPreviewPng };
