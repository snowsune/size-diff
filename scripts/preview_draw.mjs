/**
 * Server-only lineup → PNG (mirrors the browser draw path in size_diff.js).
 * Kept here so the page JS does not need an import map / shared module split.
 */

import {
  Sprite,
  tintMask,
  loadSprite,
  attachAt,
  createScaleCanvas,
  formatHeightInches,
} from "painters-canvas";

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function formatHeight(inches) {
  if (!(inches > 0)) return '0"';
  if (inches < 30) {
    const whole = Math.floor(inches);
    const eighths = Math.round((inches - whole) * 8);
    if (eighths === 0) return `${whole}"`;
    if (eighths === 8) return `${whole + 1}"`;
    const g = gcd(eighths, 8);
    return whole
      ? `${whole} ${eighths / g}/${8 / g}"`
      : `${eighths / g}/${8 / g}"`;
  }
  return formatHeightInches(inches);
}

function formatSpecies(species) {
  return species.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function heightMarkLabel(char, scaleHeight) {
  const species = formatSpecies(char.species);
  const anthro = formatHeight(char.anthroHeightInches);
  const speciesSize = formatHeight(char.heightInches);
  const scaled =
    scaleHeight ||
    Math.abs(char.anthroHeightInches - char.heightInches) > 0.05;
  if (scaled) return `${species} ${anthro}\n(${speciesSize})`;
  return `${species} ${anthro}`;
}

async function thickenLines(source, radius = 1) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (!(width > 0 && height > 0)) {
    throw new Error("thickenLines(): source has no dimensions yet");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const r = Math.max(1, Math.round(radius));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (dx * dx + dy * dy > r * r + 0.25) continue;
      ctx.drawImage(source, dx, dy);
    }
  }
  ctx.drawImage(source, 0, 0);
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  if (image.decode) await image.decode();
  else {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("thickenLines(): decode failed"));
    });
  }
  return image;
}

async function withThickenedLines(sprite, radius = 1) {
  return new Sprite({
    name: sprite.name,
    image: await thickenLines(sprite.image, radius),
    joints: sprite.joints,
    color: sprite.color,
  });
}

async function spriteFromArt(image, opts) {
  const earsOffset = Number(opts.earsOffset) || 0;
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const cx = w / 2;
  const joints = {
    origin: { x: cx, y: h },
    top: { x: cx, y: 0 },
  };
  if (earsOffset > 0) {
    joints["top-of-head"] = {
      x: cx,
      y: h * (earsOffset / (100 + earsOffset)),
    };
  }
  let colored = image;
  let color = opts.color ?? null;
  if (color) {
    if (!color.startsWith("#")) color = `#${color}`;
    colored = await thickenLines(await tintMask(image, color), 1);
  }
  return new Sprite({ name: opts.name, image: colored, joints, color });
}

function ensureScaleJoints(sprite) {
  const joints = { ...sprite.joints };
  if (!joints["top-of-head"] && joints.top_of_head) {
    joints["top-of-head"] = { ...joints.top_of_head };
  }
  if (!joints.top) {
    if (joints["top-of-head"]) joints.top = { ...joints["top-of-head"] };
    else if (joints.head) joints.top = { x: joints.head.x, y: 0 };
    else if (joints.origin) joints.top = { x: joints.origin.x, y: 0 };
  }
  if (
    joints.top &&
    joints.head &&
    joints["top-of-head"] &&
    joints.top.y === joints["top-of-head"].y &&
    joints.head.y > joints["top-of-head"].y
  ) {
    joints["top-of-head"] = { ...joints.head };
  }
  return new Sprite({
    name: sprite.name,
    image: sprite.image,
    joints,
    color: sprite.color,
  });
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
  const image = new Image();
  image.src = out.toDataURL("image/png");
  if (image.decode) await image.decode();
  else {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("trimSprite(): decode failed"));
    });
  }
  const joints = {};
  for (const [name, pt] of Object.entries(sprite.joints)) {
    joints[name] = { x: pt.x - minX, y: pt.y - minY };
  }
  return new Sprite({
    name: sprite.name,
    image,
    joints,
    color: sprite.color,
  });
}

async function loadCompositeSprite(recipe, color) {
  const tint = color ? { color } : {};
  let sprite = await loadSprite(recipe.base, tint);
  for (const part of recipe.parts || []) {
    sprite = await attachAt(
      sprite,
      await loadSprite(part.jsonUrl, tint),
      part.joint,
    );
  }
  sprite = await trimSprite(sprite);
  sprite = ensureScaleJoints(
    new Sprite({
      name: sprite.name,
      image: sprite.image,
      joints: sprite.joints,
      color,
    }),
  );
  if (color) sprite = await withThickenedLines(sprite, 1);
  return sprite;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function loadCharacterSprite(char) {
  const color = char.color
    ? char.color.startsWith("#")
      ? char.color
      : `#${char.color}`
    : null;

  if (char.composite?.base) {
    try {
      return await loadCompositeSprite(char.composite, color);
    } catch (err) {
      console.warn("composite failed, falling back to single image:", err);
    }
  }

  const jsonUrl = char.imageUrl.replace(/\.[^.]+$/, ".json");
  try {
    let sprite = ensureScaleJoints(
      await trimSprite(await loadSprite(jsonUrl, color ? { color } : {})),
    );
    if (color) sprite = await withThickenedLines(sprite, 1);
    return sprite;
  } catch (err) {
    console.warn(
      `No sprite JSON for ${char.imageUrl}, using defaults:`,
      err.message || err,
    );
    return spriteFromArt(await loadImage(char.imageUrl), {
      name: char.name,
      earsOffset: char.earsOffset,
      color: char.color,
    });
  }
}

/**
 * @param {object} config lineup payload from Flask
 * @returns {Promise<Blob>}
 */
export async function exportLineupPreviewPng(config) {
  const frameWidth = config.exportWidth || 1200;
  const frameHeight = config.exportHeight || 630;
  const host = Object.assign(Object.create(HTMLElement.prototype), {
    appendChild(child) {
      this._child = child;
      return child;
    },
  });

  const canvas = createScaleCanvas(host, {
    maxWidth: frameWidth,
    maxHeight: frameHeight,
    padding: 20,
    gapInches: 2,
    background: "#ffffff",
    showGrid: true,
    showHeightMarks: true,
  });

  const measure = config.measureToHead ? "top-of-head" : "top";
  const scaleHeight = Boolean(config.scaleHeight);
  const sprites = await Promise.all(
    config.characters.map((char) => loadCharacterSprite(char)),
  );

  sprites.forEach((sprite, i) => {
    const char = config.characters[i];
    const useMeasure =
      measure === "top-of-head" && !sprite.hasJoint("top-of-head")
        ? "top"
        : measure;
    canvas.put(sprite, {
      heightInches: char.heightInches,
      measure: useMeasure,
      heightMark: true,
      label: heightMarkLabel(char, scaleHeight),
      caption: char.name,
    });
  });

  return canvas.exportPngBlob({
    pixelRatio: 1,
    frameWidth,
    frameHeight,
    frameBackground: "#ffffff",
  });
}
