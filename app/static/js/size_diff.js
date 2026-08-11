/**
 * Size Diff lineup, now client-side rendered!
 */

import {
  Sprite,
  tintMask,
  loadSprite,
  attachAt,
  createScaleCanvas,
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
  const width = /** @type {any} */ (source).naturalWidth || /** @type {any} */ (source).width;
  const height = /** @type {any} */ (source).naturalHeight || /** @type {any} */ (source).height;
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
 * Authored JSON often has `head` / `top_of_head` but ScaleCanvas wants `top`
 * and `top-of-head`. Fill in the blanks so we dont explode.
 *
 * @param {Sprite} sprite
 * @returns {Sprite}
 */
function ensureScaleJoints(sprite) {
  const joints = { ...sprite.joints };

  if (!joints["top-of-head"] && joints.top_of_head) {
    joints["top-of-head"] = { ...joints.top_of_head };
  }

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
 * Crop transparent padding and shift joints. Keeps 3000x3000 taur plates usable.
 * @param {Sprite} sprite
 * @param {number} [pad=2]
 * @returns {Promise<Sprite>}
 */
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
  const octx = out.getContext("2d");
  if (!octx) return sprite;
  octx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);

  const image = new Image();
  image.src = out.toDataURL("image/png");
  if (image.decode) await image.decode();
  else {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("trimSprite(): decode failed"));
    });
  }

  /** @type {Record<string, { x: number, y: number }>} */
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

/**
 * Stick composite parts together (e.g. taur body + torso + tail).
 *
 * @param {{ base: string, parts: { joint: string, jsonUrl: string }[] }} recipe
 * @param {string | null} color
 * @returns {Promise<Sprite>}
 */
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

/**
 * Composite recipe from the server, else single-image sprite JSON, else invent joints.
 *
 * @param {LineupCharacter} char
 */
export async function loadCharacterSprite(char) {
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
 *   composite?: { base: string, parts: { joint: string, jsonUrl: string }[] },
 * }} LineupCharacter
 */

/**
 * Fit the lineup into the viewport: as wide as the screen allows, but short
 * enough that the per-character controls stay on-screen without a long scroll.
 * @param {HTMLElement} host
 */
function lineupDrawBudget(host) {
  const gutter = 24;
  const controlsH = Math.max(
    document.getElementById("character-controls")?.offsetHeight || 0,
    140,
  );
  const leftover = window.innerHeight - host.getBoundingClientRect().top - controlsH - gutter;
  const maxHeight = Math.round(Math.min(480, Math.max(240, leftover)));
  const viewportW = Math.max(host.clientWidth || 0, window.innerWidth || 0) - gutter;
  const maxWidth = Math.round(Math.min(2400, Math.max(viewportW, 900)));
  return { maxWidth, maxHeight };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   characters: LineupCharacter[],
 *   measureToHead: boolean,
 *   scaleHeight: boolean,
 *   charactersQuery?: string,
 *   exportWidth?: number,
 *   exportHeight?: number,
 * }} config
 * @param {{
 *   maxWidth?: number,
 *   maxHeight?: number,
 *   padding?: number,
 *   lightbox?: boolean,
 * }} [opts]
 */
export async function renderLineup(host, config, opts = {}) {
  host.replaceChildren();
  host.classList.add("lineup-host");

  const budget = lineupDrawBudget(host);
  const maxWidth = opts.maxWidth ?? budget.maxWidth;
  const maxHeight = opts.maxHeight ?? budget.maxHeight;
  const scaleHeight = Boolean(config.scaleHeight);

  const canvas = createScaleCanvas(host, {
    maxWidth,
    maxHeight,
    padding: opts.padding ?? 20,
    gapInches: 2,
    background: "#ffffff",
    showGrid: true,
    showHeightMarks: true,
  });

  const measure = config.measureToHead ? "top-of-head" : "top";

  for (const char of config.characters) {
    const sprite = await loadCharacterSprite(char);
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
  }

  if (!opts.lightbox) {
    layoutCharacterControls(canvas);
    uploadLineupPreview(canvas, config).catch((err) => {
      console.warn("preview upload failed:", err);
    });
    enableLineupLightbox(canvas, config);
  }

  return canvas;
}

/** Click the lineup canvas to open a bigger fullscreen view. */
function enableLineupLightbox(canvas, config) {
  const el = canvas?.canvas;
  if (!el) return;
  el.style.cursor = "zoom-in";
  el.title = "Click for a larger view";
  el.addEventListener("click", () => {
    openLineupLightbox(config).catch((err) => {
      console.warn("lightbox failed:", err);
    });
  });
}

function closeLineupLightbox() {
  const overlay = document.getElementById("lineup-lightbox");
  if (!overlay) return;
  overlay.remove();
  document.body.classList.remove("lineup-lightbox-open");
  window.removeEventListener("keydown", lightboxKeyHandler);
}

function lightboxKeyHandler(event) {
  if (event.key === "Escape") closeLineupLightbox();
}

/**
 * @param {Parameters<typeof renderLineup>[1]} config
 */
async function openLineupLightbox(config) {
  closeLineupLightbox();

  const overlay = document.createElement("div");
  overlay.id = "lineup-lightbox";
  overlay.className = "lineup-lightbox";
  overlay.innerHTML = `
    <div class="lineup-lightbox-panel" role="dialog" aria-modal="true" aria-label="Larger size comparison">
      <button type="button" class="lineup-lightbox-close" aria-label="Close">Close</button>
      <div class="lineup-lightbox-scroll">
        <div id="lineup-lightbox-host" class="lineup-host"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("lineup-lightbox-open");

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeLineupLightbox();
  });
  overlay
    .querySelector(".lineup-lightbox-close")
    ?.addEventListener("click", closeLineupLightbox);
  window.addEventListener("keydown", lightboxKeyHandler);

  const host = /** @type {HTMLElement} */ (
    document.getElementById("lineup-lightbox-host")
  );
  host.textContent = "Drawing…";

  const maxWidth = Math.min(2400, Math.max(900, window.innerWidth - 48));
  const maxHeight = Math.min(1400, Math.max(500, window.innerHeight - 96));

  await renderLineup(host, config, {
    lightbox: true,
    maxWidth,
    maxHeight,
    padding: 36,
  });
}

/** Park each control column under that character's origin on the canvas. */
function layoutCharacterControls(canvas) {
  const row = document.getElementById("character-controls");
  if (!row || !canvas?.canvas) return;

  const width = canvas.canvas.clientWidth || 0;
  const stack = row.closest(".lineup-stack");
  if (width) {
    row.style.width = `${width}px`;
    if (stack instanceof HTMLElement) stack.style.width = `${width}px`;
  }

  const slots = canvas.slots || [];
  const cards = [...row.querySelectorAll(".character-control")];
  if (!slots.length || slots.length !== cards.length) {
    row.classList.remove("is-placed");
    return;
  }

  row.classList.add("is-placed");
  let tallest = 0;
  cards.forEach((card, i) => {
    card.style.left = `${slots[i].centerX}px`;
    tallest = Math.max(tallest, card.offsetHeight);
  });
  row.style.minHeight = `${tallest}px`;
}

/**
 * Draw the lineup into a 1200x630 frame and POST it so crawlers can see it.
 *
 * @param {ScaleCanvas} canvas
 * @param {{
 *   charactersQuery?: string,
 *   measureToHead?: boolean,
 *   scaleHeight?: boolean,
 *   exportWidth?: number,
 *   exportHeight?: number,
 * }} config
 */
async function uploadLineupPreview(canvas, config) {
  const characters = config.charactersQuery;
  if (!characters || typeof canvas.exportPngBlob !== "function") return;

  const frameWidth = config.exportWidth || 1200;
  const frameHeight = config.exportHeight || 630;

  const blob = await canvas.exportPngBlob({
    pixelRatio: 1,
    frameWidth,
    frameHeight,
    frameBackground: "#ffffff",
  });

  const body = new FormData();
  body.set("characters", characters);
  body.set("measure_ears", config.measureToHead === false ? "false" : "true");
  body.set("scale_height", config.scaleHeight ? "true" : "false");
  body.set("preview", blob, "preview.png");

  const res = await fetch("/api/shares/lineup", { method: "POST", body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Boot from the JSON blob the template stuffed into the page.
 * @param {string} [hostId]
 */
export async function bootLineup(hostId = "size-diff-canvas") {
  const host = document.getElementById(hostId);
  const raw = document.getElementById("size-diff-lineup");
  if (!host || !raw) return null;

  /** @type {{
   *   characters: LineupCharacter[],
   *   measureToHead: boolean,
   *   scaleHeight: boolean,
   *   charactersQuery?: string,
   *   exportWidth?: number,
   *   exportHeight?: number,
   * }} */
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
