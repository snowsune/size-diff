/**
 * Size Diff lineup, now client-side rendered!
 */

import {
  Sprite,
  tintMask,
  loadSprite,
  createScaleCanvas,
  ScaleCanvas,
  formatHeightInches,
} from "/lib/painters-canvas/src/index.js";

/**
 * @param {number} inches
 * @returns {string}
 */
export function formatHeight(inches) {
  if (!(inches > 0)) return '0"';
  if (inches < 30) {
    const whole = Math.floor(inches);
    const eighths = Math.round((inches - whole) * 8);
    if (eighths === 0) return `${whole}"`;
    if (eighths === 8) return `${whole + 1}"`;
    const g = gcd(eighths, 8);
    return whole ? `${whole} ${eighths / g}/${8 / g}"` : `${eighths / g}/${8 / g}"`;
  }
  return formatHeightInches(inches);
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** @param {string} species */
function formatSpecies(species) {
  return species.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Text up by the height mark.
 * Line 1: species + anthro height
 * Line 2 (only if species scaling): (species size)
 *
 * @param {LineupCharacter} char
 * @param {boolean} scaleHeight
 */
function heightMarkLabel(char, scaleHeight) {
  const species = formatSpecies(char.species);
  const anthro = formatHeight(char.anthroHeightInches);
  const speciesSize = formatHeight(char.heightInches);
  const scaled =
    scaleHeight ||
    Math.abs(char.anthroHeightInches - char.heightInches) > 0.05;

  if (scaled) {
    // species size goes under the anthro line, closer to the dashed mark
    return `${species} ${anthro}\n(${speciesSize})`;
  }
  return `${species} ${anthro}`;
}

/**
 * Fat up thin strokes a tiny bit so 1px line art doesnt vanish when we scale it.
 * Just stamps the image around itself then draws the original on top. Cheesy. Works.
 *
 * @param {CanvasImageSource} source
 * @param {number} [radius=1]
 * @returns {Promise<HTMLImageElement>}
 */
async function thickenLines(source, radius = 1) {
  const width =
    /** @type {any} */ (source).naturalWidth ??
    /** @type {any} */ (source).videoWidth ??
    /** @type {any} */ (source).width;
  const height =
    /** @type {any} */ (source).naturalHeight ??
    /** @type {any} */ (source).videoHeight ??
    /** @type {any} */ (source).height;

  if (!(width > 0 && height > 0)) {
    throw new Error("thickenLines(): source has no dimensions yet");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("thickenLines(): could not get 2d context");

  const r = Math.max(1, Math.round(radius));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx === 0 && dy === 0) continue;
      // round-ish kernel so we dont get weird square blobs on the corners
      if (dx * dx + dy * dy > r * r + 0.25) continue;
      ctx.drawImage(source, dx, dy);
    }
  }
  ctx.drawImage(source, 0, 0);

  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  if (image.decode) {
    await image.decode();
  } else {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("thickenLines(): failed to decode"));
    });
  }
  return image;
}

/**
 * @param {Sprite} sprite
 * @param {number} [radius]
 */
async function withThickenedLines(sprite, radius = 1) {
  const image = await thickenLines(sprite.image, radius);
  return new Sprite({
    name: sprite.name,
    image,
    joints: sprite.joints,
    color: sprite.color,
  });
}

/**
 * No sidecar JSON yet? Invent scale joints from the image box.
 * origin at the feet, top at the tip, top-of-head nudged down by earsOffset.
 *
 * @param {HTMLImageElement} image
 * @param {{ name: string, earsOffset?: number, color?: string | null }} opts
 * @returns {Promise<Sprite>}
 */
export async function spriteFromArt(image, opts) {
  const earsOffset = Number(opts.earsOffset) || 0;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const cx = w / 2;

  /** @type {Record<string, { x: number, y: number }>} */
  const joints = {
    origin: { x: cx, y: h },
    top: { x: cx, y: 0 },
  };

  if (earsOffset > 0) {
    // same math the old pillow path used:
    // visual = height * (1 + ears/100), so head line is ears/(100+ears) down from the tip
    joints["top-of-head"] = {
      x: cx,
      y: h * (earsOffset / (100 + earsOffset)),
    };
  }

  let colored = image;
  let color = opts.color ?? null;
  if (color) {
    if (!color.startsWith("#")) color = `#${color}`;
    colored = await tintMask(image, color);
    // tinted refs are usually 1px line art. fat em up a hair.
    colored = await thickenLines(colored, 1);
  }

  return new Sprite({
    name: opts.name,
    image: colored,
    joints,
    color,
  });
}

/**
 * Authored JSON often has `head` + `top-of-head` but ScaleCanvas wants `top`.
 * Fill in the blanks so we dont explode.
 *
 * @param {Sprite} sprite
 * @returns {Sprite}
 */
function ensureScaleJoints(sprite) {
  const joints = { ...sprite.joints };

  if (!joints.top) {
    if (joints["top-of-head"]) {
      joints.top = { ...joints["top-of-head"] };
    } else if (joints.head) {
      joints.top = { x: joints.head.x, y: 0 };
    } else if (joints.origin) {
      joints.top = { x: joints.origin.x, y: 0 };
    }
  }

  // if we cloned top from top-of-head, steal `head` as the real skull mark
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

/**
 * Try the .json next to the png. If that flops, invent joints from the image.
 *
 * @param {LineupCharacter} char
 */
export async function loadCharacterSprite(char) {
  const jsonUrl = char.imageUrl.replace(/\.[^.]+$/, ".json");
  const color = char.color
    ? char.color.startsWith("#")
      ? char.color
      : `#${char.color}`
    : null;

  try {
    let sprite = ensureScaleJoints(
      await loadSprite(jsonUrl, color ? { color } : {}),
    );
    // tinted line art gets the 1px fatten pass too
    if (color) {
      sprite = await withThickenedLines(sprite, 1);
    }
    return sprite;
  } catch (err) {
    console.warn(`No sprite JSON for ${char.imageUrl}, using defaults:`, err.message || err);
    const image = await loadImage(char.imageUrl);
    return spriteFromArt(image, {
      name: char.name,
      earsOffset: char.earsOffset,
      color: char.color,
    });
  }
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * @typedef {{
 *   name: string,
 *   species: string,
 *   heightInches: number,
 *   anthroHeightInches: number,
 *   imageUrl: string,
 *   color: string | null,
 *   earsOffset: number,
 * }} LineupCharacter
 */

/**
 * @param {HTMLElement} host
 * @param {{
 *   characters: LineupCharacter[],
 *   measureToHead: boolean,
 *   scaleHeight: boolean,
 * }} config
 */
export async function renderLineup(host, config) {
  host.replaceChildren();
  host.classList.add("lineup-host");

  // phones get a real draw width; css scrolls sideways instead of squishing everyone
  const drawWidth = Math.min(1800, Math.max(host.clientWidth || 0, 1100));
  const scaleHeight = Boolean(config.scaleHeight);

  const canvas = createScaleCanvas(host, {
    maxWidth: drawWidth,
    maxHeight: 900,
    padding: 44,
    gapInches: 2,
    background: "#ffffff",
    showGrid: true,
    showHeightMarks: true,
  });

  const measure = config.measureToHead ? "top-of-head" : "top";

  /** @type {{ sprite: Sprite, char: LineupCharacter }[]} */
  const placed = [];

  for (const char of config.characters) {
    const sprite = await loadCharacterSprite(char);

    let useMeasure = measure;
    if (useMeasure === "top-of-head" && !sprite.hasJoint("top-of-head")) {
      useMeasure = "top";
    }

    canvas.put(sprite, {
      heightInches: char.heightInches,
      measure: useMeasure,
      heightMark: true,
      label: heightMarkLabel(char, scaleHeight),
    });
    placed.push({ sprite, char });
  }

  drawNameLabels(canvas, placed);
  const _render = canvas.render.bind(canvas);
  canvas.render = function patchedRender() {
    _render();
    drawNameLabels(canvas, placed);
    return canvas;
  };

  return canvas;
}

/**
 * Names go under the feet. Species / sizes live up on the height marks.
 *
 * @param {ScaleCanvas} canvas
 * @param {{ sprite: Sprite, char: LineupCharacter }[]} placed
 */
function drawNameLabels(canvas, placed) {
  if (!placed.length || canvas.items.length === 0) return;

  const ctx = canvas.ctx;
  const pad = canvas.padding;
  const labelGutter = canvas.showGrid ? 36 : 0;
  const contentLeft = pad + labelGutter;
  const metrics = canvas.items.map((item) => ScaleCanvas.worldMetrics(item));

  let totalWidthInches = 0;
  for (let i = 0; i < metrics.length; i++) {
    totalWidthInches += metrics[i].widthInches;
    if (i < metrics.length - 1) totalWidthInches += canvas.gapInches;
  }

  let maxAbove = 0;
  let maxBelow = 0;
  for (const m of metrics) {
    maxAbove = Math.max(maxAbove, m.aboveOriginInches);
    maxBelow = Math.max(maxBelow, m.belowOriginInches);
  }

  const totalHeightInches = maxAbove + maxBelow;
  const innerMaxW = Math.max(1, canvas.maxWidth - pad * 2 - labelGutter);
  const innerMaxH = Math.max(1, canvas.maxHeight - pad * 2);
  const ppi = Math.min(
    innerMaxW / totalWidthInches,
    innerMaxH / totalHeightInches,
  );
  const groundY = pad + maxAbove * ppi;

  // make a little room under the ground line for names
  const labelRoom = 36;
  const need = groundY + labelRoom;
  const dpr = canvas.pixelRatio || 1;
  const cssW = canvas.canvas.width / dpr;
  const cssH = canvas.canvas.height / dpr;
  if (cssH < need) {
    const prev = ctx.getImageData(0, 0, canvas.canvas.width, canvas.canvas.height);
    canvas._setCanvasSize(cssW, need);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(prev, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) {
      ctx.imageSmoothingQuality = "high";
    }
    ctx.fillStyle = canvas.background || "#ffffff";
    ctx.fillRect(0, cssH, cssW, need - cssH);
  }

  ctx.save();
  ctx.font = "bold 13px sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  let cursorX = contentLeft;
  for (let i = 0; i < canvas.items.length; i++) {
    const m = metrics[i];
    const { char } = placed[i];
    const originCanvasX = cursorX + m.originXInches * ppi;

    ctx.fillStyle = char.color
      ? char.color.startsWith("#")
        ? char.color
        : `#${char.color}`
      : "#222";
    ctx.fillText(char.name, originCanvasX, groundY + 8);

    cursorX += m.widthInches * ppi;
    if (i < canvas.items.length - 1) cursorX += canvas.gapInches * ppi;
  }

  ctx.restore();
}

/**
 * Boot from the JSON blob the template stuffed into the page.
 * @param {string} [hostId]
 */
export async function bootLineup(hostId = "size-diff-canvas") {
  const host = document.getElementById(hostId);
  const raw = document.getElementById("size-diff-lineup");
  if (!host || !raw) return null;

  /** @type {{ characters: LineupCharacter[], measureToHead: boolean, scaleHeight: boolean }} */
  const config = JSON.parse(raw.textContent || "{}");
  if (!config.characters?.length) {
    host.textContent = "No characters to draw.";
    return null;
  }

  host.textContent = "Drawing…";
  try {
    return await renderLineup(host, config);
  } catch (err) {
    console.error(err);
    host.textContent = `Failed to draw lineup: ${err.message || err}`;
    throw err;
  }
}

bootLineup().catch(() => {});
