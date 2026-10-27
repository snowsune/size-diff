/**
 * Server-only taur -> PNG (mirrors the browser draw path in taur_canvas.js).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  Sprite,
  loadSprite,
  attachAt,
  createScaleCanvas,
} from "painters-canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const CALC_DIR = resolve(PROJECT_ROOT, "app/taur_calculator");

const DEFAULT_BODY_COLOR = "#ff0000";
const DEFAULT_RIDER_COLOR = "#ff8800";
const DEFAULT_STANDING_COLOR = "#007516";
const EXPORT_WIDTH = 1200;
const EXPORT_HEIGHT = 900;

function loadIife(absPath, exportName, env = {}) {
  const code = readFileSync(absPath, "utf8");
  const keys = Object.keys(env);
  const fn = new Function(...keys, `${code}\nreturn ${exportName};`);
  return fn(...keys.map((k) => env[k]));
}

const SizeDiffUnits = loadIife(
  resolve(PROJECT_ROOT, "app/static/js/size_diff/units.js"),
  "SizeDiffUnits",
);
const TaurAlgorithmForm = loadIife(
  resolve(CALC_DIR, "taur_algorithm_form.js"),
  "TaurAlgorithmForm",
);
const VolnarsAlgorithm = loadIife(
  resolve(CALC_DIR, "algorithms/volnars_algorithm.js"),
  "VolnarsAlgorithm",
  { SizeDiffUnits, TaurAlgorithmForm },
);
const SnowsAlgorithm = loadIife(
  resolve(CALC_DIR, "algorithms/snows_algorithm.js"),
  "SnowsAlgorithm",
  { SizeDiffUnits, TaurAlgorithmForm },
);
const ManualAlgorithm = loadIife(
  resolve(CALC_DIR, "algorithms/manual_algorithm.js"),
  "ManualAlgorithm",
  { SizeDiffUnits, TaurAlgorithmForm },
);

function flag(params, key) {
  return ["1", "on", "true"].includes(String(params[key] ?? "").toLowerCase());
}

function len(params, key) {
  const raw = params[key];
  if (raw == null || !String(raw).trim()) return null;
  const inches = SizeDiffUnits.parseLengthInput(String(raw));
  return Number.isNaN(inches) ? null : inches;
}

function calculateResult(params) {
  const algorithm = params.algorithm || "volnar";
  let raw;

  if (algorithm === "manual") {
    const values = {
      TH: len(params, "manual_lower_body_height"),
      TFH: len(params, "manual_taur_full_height"),
      TT: len(params, "manual_tail_length"),
    };
    if (flag(params, "show_rider")) {
      values.RH = len(params, "rider_height");
    }
    for (const [key, value] of Object.entries(values)) {
      if (value == null || Number.isNaN(value)) {
        throw new Error(`Invalid or missing ${key}`);
      }
    }
    raw = ManualAlgorithm.calculate(values);
  } else if (algorithm === "snow") {
    const inputs = {
      anthroHeight: len(params, "anthro_height"),
      speciesHeight: len(params, "species_height"),
      speciesLength: len(params, "species_length"),
      speciesTailLength: len(params, "species_tail_length"),
    };
    for (const [key, value] of Object.entries(inputs)) {
      if (value == null || Number.isNaN(value)) {
        throw new Error(`Invalid or missing ${key}`);
      }
    }
    raw = SnowsAlgorithm.calculate(inputs);
  } else {
    const inputs = {
      measurementType: params.measurement_type || "vitruvian",
      anthroHeight: len(params, "anthro_height"),
      speciesHeight: len(params, "species_height"),
      speciesLength: len(params, "species_length"),
      speciesTailLength: len(params, "species_tail_length"),
      taurFullHeight: len(params, "taur_full_height"),
      speciesWeight: parseFloat(params.species_weight),
      taurLength: params.taur_length ? len(params, "taur_length") : null,
    };
    for (const key of [
      "anthroHeight",
      "speciesHeight",
      "speciesLength",
      "speciesTailLength",
      "taurFullHeight",
      "speciesWeight",
    ]) {
      if (inputs[key] == null || Number.isNaN(inputs[key])) {
        throw new Error(`Invalid or missing ${key}`);
      }
    }
    raw = VolnarsAlgorithm.calculate(inputs);
  }

  if (raw.TFH != null && raw.TH != null) {
    raw.UBH = raw.UBH ?? raw.TFH - raw.TH;
  }
  if (flag(params, "show_rider")) {
    const rh = len(params, "rider_height");
    if (rh != null) raw.RH = rh;
  }
  if (flag(params, "show_standing")) {
    const sth = len(params, "standing_height");
    if (sth != null) raw.StH = sth;
  }
  return raw;
}

function spanY(sprite, from, to) {
  return Math.abs(sprite.joint(from).y - sprite.joint(to).y);
}

function attachScale(partSpanPx, partInches, baseSpanPx, baseInches) {
  if (!(partSpanPx > 0 && baseSpanPx > 0 && partInches > 0 && baseInches > 0)) {
    return 1;
  }
  return (partInches / baseInches) * (baseSpanPx / partSpanPx);
}

function cloneJoints(joints) {
  return Object.fromEntries(
    Object.entries(joints).map(([name, pt]) => [name, { x: pt.x, y: pt.y }]),
  );
}

function spriteWithJoints(sprite, joints) {
  return new Sprite({
    name: sprite.name,
    image: sprite.image,
    joints,
    color: sprite.color,
  });
}

function onlyJoints(sprite, names) {
  const joints = {};
  for (const name of names) {
    if (sprite.hasJoint(name)) joints[name] = { ...sprite.joint(name) };
  }
  return spriteWithJoints(sprite, joints);
}

function measureName(sprite, measureToHead) {
  if (measureToHead && sprite.hasJoint("top-of-head")) return "top-of-head";
  return "top";
}

function ensureScaleJoints(sprite) {
  const joints = cloneJoints(sprite.joints);
  if (!joints.top && joints["ear-tip"]) joints.top = { ...joints["ear-tip"] };
  if (!joints["top-of-head"] && joints.top_of_head) {
    joints["top-of-head"] = { ...joints.top_of_head };
  }
  if (!joints.top) {
    const src = joints["top-of-head"] ?? joints.head;
    if (src) joints.top = { ...src };
  }
  if (!joints.origin) {
    joints.origin = { x: sprite.width / 2, y: sprite.height };
  }
  if (!joints.top) {
    joints.top = { x: joints.origin.x, y: 0 };
  }
  return spriteWithJoints(sprite, joints);
}

async function canvasToImage(canvas) {
  const image = new Image();
  if (typeof canvas.toDataURL === "function") {
    image.src = canvas.toDataURL("image/png");
  } else if (typeof canvas.toBuffer === "function") {
    image.src = canvas.toBuffer("image/png");
  } else {
    throw new Error("canvas cannot export image");
  }
  if (image.decode) await image.decode();
  else {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("png decode failed"));
    });
  }
  return image;
}

async function cropToImage(image, trim) {
  if (!image || !trim) return image;
  const canvas = document.createElement("canvas");
  canvas.width = trim.width;
  canvas.height = trim.height;
  canvas.getContext("2d").drawImage(
    image,
    trim.x,
    trim.y,
    trim.width,
    trim.height,
    0,
    0,
    trim.width,
    trim.height,
  );
  return canvasToImage(canvas);
}

async function trimSprite(sprite, pad = 2) {
  const width = sprite.width;
  const height = sprite.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sprite;
  ctx.drawImage(sprite.image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return sprite;

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  if (tw >= width && th >= height) return sprite;

  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  out.getContext("2d").drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);

  const joints = {};
  for (const [name, pt] of Object.entries(sprite.joints)) {
    joints[name] = { x: pt.x - minX, y: pt.y - minY };
  }
  return new Sprite({
    name: sprite.name,
    image: await canvasToImage(out),
    joints,
    color: sprite.color,
  });
}

function localPoint(pt, trim) {
  return { x: pt.x - (trim?.x ?? 0), y: pt.y - (trim?.y ?? 0) };
}

function jointsForLayer(key, loaded, layerDef, taurData) {
  const trim = layerDef.trim;
  const joints = {};
  for (const [name, pt] of Object.entries(loaded.joints)) {
    joints[name] = localPoint(pt, trim);
  }
  if (Array.isArray(layerDef.joints?.floor)) {
    const [x, y] = layerDef.joints.floor;
    joints.origin = localPoint({ x, y }, trim);
  }
  const tl = taurData?.measurements?.TL;
  if (key === "lBody" && tl?.start) {
    joints["tl-a"] = { x: tl.start[1], y: tl.start[2] };
  }
  return joints;
}

async function loadPlainImage(url) {
  const image = new Image();
  image.src = url;
  if (image.decode) await image.decode();
  else {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(`Failed to load ${url}`));
    });
  }
  return image;
}

async function loadLayerSprite(key, source, layerDef, taurData) {
  const loaded = source?.json
    ? await loadSprite(source.json)
    : new Sprite({
        name: key,
        image: await loadPlainImage(source.url),
        joints: {},
      });
  return new Sprite({
    name: key,
    image: await cropToImage(loaded.image, layerDef.trim),
    joints: jointsForLayer(key, loaded, layerDef, taurData),
    color: loaded.color,
  });
}

function toFileUrl(artRoot, relPath) {
  return pathToFileURL(resolve(artRoot, relPath)).href;
}

function buildLayerSources(taurData, artRoot) {
  const sources = {};
  for (const [key, layer] of Object.entries(taurData.layers)) {
    const rel = layer.path;
    const root = rel.replace(/\.[^.]+$/, "");
    const jsonRel = `${root}.json`;
    const source = { url: toFileUrl(artRoot, rel) };
    try {
      readFileSync(resolve(artRoot, jsonRel));
      source.json = toFileUrl(artRoot, jsonRel);
    } catch {
      /* no sidecar */
    }
    sources[key] = source;
  }
  return sources;
}

async function bakeTaur(baseSprites, result, params, measureToHead) {
  const th = result.TH;
  const ubh = result.UBH ?? result.TFH - result.TH;
  const color = params.taur_body_color || DEFAULT_BODY_COLOR;

  let body = ensureScaleJoints(
    color ? await baseSprites.lBody.recolor(color) : baseSprites.lBody,
  );
  const uBody = ensureScaleJoints(
    color ? await baseSprites.uBody.recolor(color) : baseSprites.uBody,
  );
  const tail = color
    ? await baseSprites.tail.recolor(color)
    : baseSprites.tail;

  const thPx = spanY(body, "origin", "body");
  const ubhJoint = measureName(uBody, measureToHead);
  const ubhPx = uBody.hasJoint(ubhJoint)
    ? spanY(uBody, "body", ubhJoint)
    : spanY(uBody, "body", "head");
  const ttPx =
    tail.hasJoint("tt-a") && tail.hasJoint("tt-b")
      ? Math.abs(tail.joint("tt-a").x - tail.joint("tt-b").x)
      : tail.width;

  body = await attachAt(body, uBody, "body", {
    scale: attachScale(ubhPx, ubh, thPx, th),
  });
  body = await attachAt(body, tail, "tail", {
    scale: attachScale(ttPx, result.TT, thPx, th),
  });

  if (flag(params, "show_rider") && result.RH && baseSprites.rider?.hasJoint("seat")) {
    const riderColor = params.taur_rider_color || DEFAULT_RIDER_COLOR;
    const riderFull = await baseSprites.rider.recolor(riderColor);
    const rhPx =
      riderFull.hasJoint("origin") && riderFull.hasJoint("top-of-head")
        ? spanY(riderFull, "origin", "top-of-head")
        : riderFull.height;
    body = await attachAt(body, onlyJoints(riderFull, ["seat"]), "seat", {
      scale: attachScale(rhPx, result.RH, thPx, th),
    });
  }

  return ensureScaleJoints(await trimSprite(body));
}

/**
 * @param {{
 *   params: Record<string, string>,
 *   artRoot: string,
 *   taurData?: object,
 *   frameWidth?: number,
 *   frameHeight?: number,
 * }} config
 */
export async function exportTaurPreviewPng(config) {
  const params = config.params || {};
  const artRoot = resolve(config.artRoot || "art");
  const taurData =
    config.taurData ||
    JSON.parse(readFileSync(resolve(CALC_DIR, "taur_data.json"), "utf8"));
  const frameWidth = config.frameWidth || EXPORT_WIDTH;
  const frameHeight = config.frameHeight || EXPORT_HEIGHT;
  const measureToHead = params.measure_to_head !== "0";

  const result = calculateResult(params);
  if (!(result.TFH > 0)) {
    throw new Error("invalid taur result");
  }

  const layerSources = buildLayerSources(taurData, artRoot);
  const baseSprites = {};
  await Promise.all(
    Object.entries(layerSources).map(async ([key, source]) => {
      baseSprites[key] = await loadLayerSprite(
        key,
        source,
        taurData.layers[key],
        taurData,
      );
    }),
  );

  const host = Object.assign(Object.create(HTMLElement.prototype), {
    appendChild(child) {
      this._child = child;
      return child;
    },
  });
  const canvas = createScaleCanvas(host, {
    maxWidth: frameWidth,
    maxHeight: frameHeight,
    padding: 28,
    gapInches: 8,
    background: "#ffffff",
    showGrid: false,
    showHeightMarks: false,
  });

  if (flag(params, "show_standing") && result.StH > 0 && baseSprites.standingChar) {
    const standingColor = params.taur_standing_color || DEFAULT_STANDING_COLOR;
    const standing = ensureScaleJoints(
      await baseSprites.standingChar.recolor(standingColor),
    );
    canvas.put(standing, {
      heightInches: result.StH,
      measure: measureName(standing, measureToHead),
      heightMark: false,
      label: "",
    });
  }

  const taur = await bakeTaur(baseSprites, result, params, measureToHead);
  const name = (params.name || "").trim();
  canvas.put(taur, {
    heightInches: result.TFH,
    measure: measureName(taur, measureToHead),
    heightMark: false,
    label: "",
    caption: name || undefined,
  });

  return canvas.exportPngBlob({
    pixelRatio: 1,
    frameWidth,
    frameHeight,
    frameBackground: "#ffffff",
  });
}
