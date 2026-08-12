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

/** @type {Map<string, Promise<import("/lib/painters-canvas/src/index.js").Sprite>>} */
const spriteCache = new Map();

/** @param {LineupCharacter} char */
function spriteCacheKey(char) {
  const color = char.color || "";
  const composite = char.composite?.base
    ? `${char.composite.base}|${(char.composite.parts || [])
        .map((p) => `${p.joint}:${p.jsonUrl}`)
        .join(",")}`
    : "";
  return `${char.imageUrl}|${color}|${composite}|${char.earsOffset || 0}`;
}

/**
 * Composite recipe from the server, else single-image sprite JSON, else invent joints.
 *
 * @param {LineupCharacter} char
 */
export async function loadCharacterSprite(char) {
  const key = spriteCacheKey(char);
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const pending = (async () => {
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
      console.warn(
        `No sprite JSON for ${char.imageUrl}, using defaults:`,
        err.message || err,
      );
      const image = await loadImage(char.imageUrl);
      return spriteFromArt(image, {
        name: char.name,
        earsOffset: char.earsOffset,
        color: char.color,
      });
    }
  })();

  spriteCache.set(key, pending);
  try {
    return await pending;
  } catch (err) {
    spriteCache.delete(key);
    throw err;
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
 *   gender?: string,
 *   heightInches: number,
 *   anthroHeightInches: number,
 *   feet?: number,
 *   inches?: number,
 *   imageUrl: string,
 *   color: string | null,
 *   earsOffset: number,
 *   composite?: { base: string, parts: { joint: string, jsonUrl: string }[] },
 * }} LineupCharacter
 */

/**
 * @typedef {{
 *   characters: LineupCharacter[],
 *   measureToHead: boolean,
 *   scaleHeight: boolean,
 *   charactersQuery?: string,
 *   exportWidth?: number,
 *   exportHeight?: number,
 *   pagePath?: string,
 * }} LineupConfig
 */

/** @type {LineupConfig | null} */
let currentConfig = null;

/** @type {number} */
let softNavSeq = 0;

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
  const leftover =
    window.innerHeight - host.getBoundingClientRect().top - controlsH - gutter;
  const maxHeight = Math.round(Math.min(480, Math.max(240, leftover)));
  const viewportW =
    Math.max(host.clientWidth || 0, window.innerWidth || 0) - gutter;
  const maxWidth = Math.round(Math.min(2400, Math.max(viewportW, 900)));
  return { maxWidth, maxHeight };
}

/**
 * @param {HTMLElement} host
 * @param {LineupConfig} config
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
 * @param {LineupConfig} config
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
 * @param {any} canvas
 * @param {LineupConfig} config
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

/** @param {LineupConfig} config */
function rebuildCharacterControls(config) {
  const row = document.getElementById("character-controls");
  if (!row) return;

  const measureEars = config.measureToHead !== false;
  const scaleHeight = Boolean(config.scaleHeight);
  const charactersQuery = config.charactersQuery || "";

  row.replaceChildren();
  config.characters.forEach((entry, i) => {
    const card = document.createElement("div");
    card.className = "character-control";
    card.dataset.slotIndex = String(i);

    const form = document.createElement("form");
    form.className = "control-form";
    form.method = "get";
    form.action = `/update/${i}`;

    const hiddenChars = document.createElement("input");
    hiddenChars.type = "hidden";
    hiddenChars.name = "characters";
    hiddenChars.value = charactersQuery;
    form.appendChild(hiddenChars);

    if (!measureEars) {
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "measure_ears";
      hidden.value = "false";
      form.appendChild(hidden);
    }
    if (scaleHeight) {
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "scale_height";
      hidden.value = "true";
      form.appendChild(hidden);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "control-name";
    nameEl.textContent = entry.name;
    card.appendChild(nameEl);

    const heightLabel = document.createElement("label");
    heightLabel.className = "control-field";
    heightLabel.innerHTML = `<span>Height</span><span class="height-inputs"></span>`;
    const heightInputs = heightLabel.querySelector(".height-inputs");
    const feet = document.createElement("input");
    feet.type = "number";
    feet.name = "feet";
    feet.min = "0";
    feet.max = "40";
    feet.step = "1";
    feet.value = String(entry.feet ?? Math.floor(entry.anthroHeightInches / 12));
    feet.setAttribute("aria-label", `${entry.name} feet`);
    const inch = document.createElement("input");
    inch.type = "number";
    inch.name = "inches";
    inch.min = "0";
    inch.max = "11.99";
    inch.step = "0.5";
    inch.value = String(
      entry.inches ?? Math.round(entry.anthroHeightInches % 12),
    );
    inch.setAttribute("aria-label", `${entry.name} inches`);
    heightInputs.append(
      feet,
      Object.assign(document.createElement("span"), {
        className: "unit",
        textContent: "'",
      }),
      inch,
      Object.assign(document.createElement("span"), {
        className: "unit",
        textContent: '"',
      }),
    );
    form.appendChild(heightLabel);

    const colorLabel = document.createElement("label");
    colorLabel.className = "control-field";
    const colorSpan = document.createElement("span");
    colorSpan.textContent = "Color";
    const color = document.createElement("input");
    color.type = "color";
    color.name = "color";
    color.value = entry.color || "#888888";
    color.setAttribute("aria-label", `${entry.name} color`);
    colorLabel.append(colorSpan, color);
    form.appendChild(colorLabel);

    const actions = document.createElement("div");
    actions.className = "control-actions";
    const remove = document.createElement("a");
    remove.className = "control-remove";
    remove.textContent = "Remove";
    const removeParams = new URLSearchParams();
    removeParams.set("characters", charactersQuery);
    if (!measureEars) removeParams.set("measure_ears", "false");
    if (scaleHeight) removeParams.set("scale_height", "true");
    remove.href = `/remove/${i}?${removeParams.toString()}`;
    actions.append(remove);
    form.appendChild(actions);

    card.appendChild(form);
    row.appendChild(card);
  });
}

function updateShareLink(pagePath) {
  const link = document.querySelector(".share-link a");
  if (!link || !pagePath) return;
  const url = new URL(pagePath, window.location.origin).href;
  link.href = url;
  link.textContent = url;
}

function syncSettingsCheckboxes(config) {
  const measure = document.getElementById("measure_ears");
  const scale = document.getElementById("scale_height");
  if (measure instanceof HTMLInputElement) {
    measure.checked = config.measureToHead !== false;
  }
  if (scale instanceof HTMLInputElement) {
    scale.checked = Boolean(config.scaleHeight);
  }
}

function ensureLineupShell() {
  let container = document.querySelector(".image-container");
  if (container) return container;

  const form = document.querySelector(".form-container");
  container = document.createElement("div");
  container.className = "image-container";
  container.innerHTML = `
    <div class="lineup-scroll">
      <div class="lineup-stack">
        <div id="size-diff-canvas" class="lineup-host" aria-label="Size comparison"></div>
        <div class="character-controls" id="character-controls"></div>
      </div>
    </div>
  `;
  form?.after(container);

  if (!document.querySelector(".share-link")) {
    const share = document.createElement("div");
    share.className = "share-link";
    share.innerHTML = `<p>Share this lineup:</p><a href="${window.location.href}">${window.location.href}</a>`;
    container.after(share);
  }
  return container;
}

/**
 * Apply a lineup payload: controls + canvas + URL.
 * @param {LineupConfig} config
 * @param {{ pushState?: boolean }} [opts]
 */
export async function applyLineupState(config, opts = {}) {
  if (!config?.characters?.length) {
    throw new Error("can't update lineup: missing characters");
  }
  const seq = ++softNavSeq;
  currentConfig = config;
  ensureLineupShell();
  rebuildCharacterControls(config);
  syncSettingsCheckboxes(config);

  const host = document.getElementById("size-diff-canvas");
  if (!(host instanceof HTMLElement)) return null;

  host.textContent = "Drawing…";
  const canvas = await renderLineup(host, config);
  if (seq !== softNavSeq) return null;

  const pagePath = config.pagePath || pagePathFromConfig(config);
  if (opts.pushState !== false && pagePath) {
    history.pushState({ softNav: true }, "", pagePath);
  }
  updateShareLink(pagePath);
  return canvas;
}

/** @param {LineupConfig} config */
function pagePathFromConfig(config) {
  const params = new URLSearchParams();
  if (config.charactersQuery) params.set("characters", config.charactersQuery);
  if (config.measureToHead === false) params.set("measure_ears", "false");
  if (config.scaleHeight) params.set("scale_height", "true");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

async function fetchLineupFromPagePath(pagePath) {
  const page = new URL(pagePath, window.location.origin);
  const api = new URL("/api/lineup", window.location.origin);
  api.search = page.search;
  const res = await fetch(api, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`lineup fetch failed (${res.status})`);
  return res.json();
}

/**
 * Hit a mutation route; ?format=json makes Flask return the lineup payload.
 * @param {string} url
 * @param {RequestInit} [init]
 */
async function mutateLineup(url, init = {}) {
  const target = new URL(url, window.location.origin);
  target.searchParams.set("format", "json");

  const headers = new Headers(init.headers || {});
  headers.set("X-Size-Diff-Soft", "1");

  const res = await fetch(target, { ...init, headers, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("Location");
    if (!loc) throw new Error("update redirected with no Location");
    return fetchLineupFromPagePath(loc);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `request failed (${res.status})`);
  }
  if (!data?.characters) {
    throw new Error("server did not return lineup JSON");
  }
  return data;
}

function showSoftNavError(err) {
  console.error(err);
  const host = document.getElementById("size-diff-canvas");
  if (host) {
    host.textContent = `Failed to update lineup: ${err.message || err}`;
  }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let controlEditTimer = null;

/** @param {HTMLFormElement} form */
function commitControlForm(form) {
  const action = form.getAttribute("action") || form.action;
  const params = new URLSearchParams(new FormData(form));
  const url = `${action}?${params.toString()}`;
  return mutateLineup(url)
    .then((data) => applyLineupState(data))
    .catch(showSoftNavError);
}

/** @param {HTMLFormElement} form */
function scheduleControlFormCommit(form) {
  if (controlEditTimer) clearTimeout(controlEditTimer);
  controlEditTimer = setTimeout(() => {
    controlEditTimer = null;
    commitControlForm(form);
  }, 350);
}

function wireSoftNav() {
  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const form = target.closest("form.control-form");
      if (!(form instanceof HTMLFormElement)) return;
      scheduleControlFormCommit(form);
    },
    true,
  );

  document.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const form = target.closest("form.control-form");
      if (!(form instanceof HTMLFormElement)) return;
      // Color pickers / number steppers: commit as soon as the value settles.
      if (controlEditTimer) clearTimeout(controlEditTimer);
      controlEditTimer = null;
      commitControlForm(form);
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (form.classList.contains("control-form")) {
        event.preventDefault();
        if (controlEditTimer) clearTimeout(controlEditTimer);
        controlEditTimer = null;
        commitControlForm(form);
        return;
      }

      if (form.classList.contains("form-container")) {
        event.preventDefault();
        const body = new FormData(form);
        const chars =
          currentConfig?.charactersQuery ||
          new URL(window.location.href).searchParams.get("characters") ||
          "";
        const postUrl = chars
          ? `/?characters=${encodeURIComponent(chars)}`
          : "/";
        mutateLineup(postUrl, { method: "POST", body })
          .then((data) => {
            const name = document.getElementById("name");
            const height = document.getElementById("anthro_height");
            if (name instanceof HTMLInputElement) name.value = "";
            if (height instanceof HTMLInputElement) height.value = "";
            const addBtn = document.getElementById("add-btn");
            if (addBtn instanceof HTMLButtonElement) addBtn.disabled = true;
            return applyLineupState(data);
          })
          .catch(showSoftNavError);
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const remove = target.closest("a.control-remove");
      if (remove instanceof HTMLAnchorElement) {
        event.preventDefault();
        mutateLineup(remove.href)
          .then((data) => applyLineupState(data))
          .catch(showSoftNavError);
        return;
      }

      const presetBtn = target.closest("#preset-add-btn");
      if (presetBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const input = document.getElementById("preset-autocomplete");
        softAddPreset(input instanceof HTMLInputElement ? input.value : "").catch(
          showSoftNavError,
        );
      }
    },
    true,
  );

  const measure = document.getElementById("measure_ears");
  const scale = document.getElementById("scale_height");
  const onSettingChange = () => {
    const params = new URLSearchParams();
    const chars =
      currentConfig?.charactersQuery ||
      new URL(window.location.href).searchParams.get("characters") ||
      "";
    if (chars) params.set("characters", chars);
    if (measure instanceof HTMLInputElement && !measure.checked) {
      params.set("measure_ears", "false");
    }
    if (scale instanceof HTMLInputElement && scale.checked) {
      params.set("scale_height", "true");
    }
    fetchLineupFromPagePath(`/?${params.toString()}`)
      .then((data) => applyLineupState(data))
      .catch(showSoftNavError);
  };
  measure?.addEventListener("change", onSettingChange);
  scale?.addEventListener("change", onSettingChange);

  window.addEventListener("popstate", () => {
    fetchLineupFromPagePath(window.location.pathname + window.location.search)
      .then((data) => applyLineupState(data, { pushState: false }))
      .catch(showSoftNavError);
  });
}

/**
 * Soft-add a preset without full reload.
 * @param {string} val
 */
async function softAddPreset(val) {
  /** @type {Record<string, string> | undefined} */
  const presetMap = /** @type {any} */ (window).sizeDiffPresetMap;
  if (!presetMap) return;

  let presetVal = presetMap[val] || null;
  if (!presetVal) {
    for (const key in presetMap) {
      if (key.toLowerCase().startsWith(val.toLowerCase())) {
        presetVal = presetMap[key];
        break;
      }
    }
  }
  if (!presetVal) return;

  const params = new URLSearchParams();
  params.set("preset", presetVal);
  const chars =
    currentConfig?.charactersQuery ||
    new URL(window.location.href).searchParams.get("characters") ||
    "";
  if (chars) params.set("characters", chars);
  const measure = document.getElementById("measure_ears");
  const scale = document.getElementById("scale_height");
  if (measure instanceof HTMLInputElement && !measure.checked) {
    params.set("measure_ears", "false");
  }
  if (scale instanceof HTMLInputElement && scale.checked) {
    params.set("scale_height", "true");
  }

  const data = await mutateLineup(`/add-preset?${params.toString()}`);
  await applyLineupState(data);
}

/**
 * Boot from the JSON blob the template stuffed into the page.
 * @param {string} [hostId]
 */
export async function bootLineup(hostId = "size-diff-canvas") {
  wireSoftNav();

  const host = document.getElementById(hostId);
  const raw = document.getElementById("size-diff-lineup");
  if (!host || !raw) return null;

  /** @type {LineupConfig} */
  const config = JSON.parse(raw.textContent || "{}");
  if (!config.characters?.length) {
    host.textContent = "No characters to draw.";
    return null;
  }

  host.textContent = "Drawing…";
  try {
    return await applyLineupState(config, { pushState: false });
  } catch (err) {
    console.error(err);
    host.textContent = `Failed to draw lineup: ${err.message || err}`;
    throw err;
  }
}

bootLineup().catch(() => {});
