/**
 * Size Diff lineup, now client-side rendered!
 */

import {
  createScaleCanvas,
  formatHeight,
  loadCharacterSprite,
  placeLineupCharacters,
} from "./size_diff/lineup_draw.js";

export { formatHeight, loadCharacterSprite };

/* Sprite load + ScaleCanvas put live in ./size_diff/lineup_draw.js (shared with preview). */

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
 *   previewPath?: string,
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

  const canvas = createScaleCanvas(host, {
    maxWidth,
    maxHeight,
    padding: opts.padding ?? 20,
    gapInches: 2,
    background: "#ffffff",
    showGrid: true,
    showHeightMarks: true,
  });

  await placeLineupCharacters(canvas, config);

  if (!opts.lightbox) {
    layoutCharacterControls(canvas);
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
    const linkParams = new URLSearchParams();
    linkParams.set("characters", charactersQuery);
    if (!measureEars) linkParams.set("measure_ears", "false");
    if (scaleHeight) linkParams.set("scale_height", "true");
    const qs = linkParams.toString();

    if (i > 0) {
      const left = document.createElement("a");
      left.className = "control-move";
      left.textContent = "←";
      left.title = "Move left";
      left.setAttribute("aria-label", `Move ${entry.name} left`);
      left.href = `/move/${i}/left?${qs}`;
      actions.append(left);
    }
    if (i < config.characters.length - 1) {
      const right = document.createElement("a");
      right.className = "control-move";
      right.textContent = "→";
      right.title = "Move right";
      right.setAttribute("aria-label", `Move ${entry.name} right`);
      right.href = `/move/${i}/right?${qs}`;
      actions.append(right);
    }

    const remove = document.createElement("a");
    remove.className = "control-remove";
    remove.textContent = "Remove";
    remove.href = `/remove/${i}?${qs}`;
    actions.append(remove);
    form.appendChild(actions);

    card.appendChild(form);
    row.appendChild(card);
  });
}

function updateShareLink(pagePath) {
  const btn = document.querySelector(".share-copy");
  if (!btn || !pagePath) return;
  const url = new URL(pagePath, window.location.origin).href;
  btn.dataset.url = url;
  if (!btn.classList.contains("is-copied")) {
    btn.textContent = url;
  }
}

function previewUrlFromShareUrl(shareUrl) {
  const preview = new URL(shareUrl, window.location.origin);
  preview.pathname = "/preview.png";
  return preview.href;
}

/** Kick /preview.png so Node+CF have the PNG before someone pastes the link! (hopefully...) */
function warmSharePreview(shareUrl) {
  try {
    fetch(previewUrlFromShareUrl(shareUrl)).catch((err) => {
      console.warn("preview warmup failed:", err);
    });
  } catch {
    /* ignore malformed share urls */
  }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let shareCopiedTimer = null;

async function copyShareLink(btn) {
  const url = btn.dataset.url || window.location.href;
  warmSharePreview(url);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Older browsers fallback (and also locally)
    const field = document.createElement("textarea");
    field.value = url;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }

  btn.classList.add("is-copied");
  btn.textContent = "Copied!";
  if (shareCopiedTimer) clearTimeout(shareCopiedTimer);
  shareCopiedTimer = setTimeout(() => {
    btn.classList.remove("is-copied");
    btn.textContent = btn.dataset.url || url;
    shareCopiedTimer = null;
  }, 1400);
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
    const url = window.location.href;
    const share = document.createElement("div");
    share.className = "share-link";
    share.innerHTML = `
      <p>Share this lineup: <span class="share-hint">(click to copy)</span></p>
      <button type="button" class="share-copy" data-url="${url}" title="Copy lineup link">${url}</button>
    `;
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
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest(".share-copy");
      if (btn instanceof HTMLButtonElement) {
        event.preventDefault();
        copyShareLink(btn).catch((err) => console.warn("copy failed:", err));
        return;
      }

      const moveOrRemove = target.closest("a.control-move, a.control-remove");
      if (moveOrRemove instanceof HTMLAnchorElement) {
        event.preventDefault();
        mutateLineup(moveOrRemove.href)
          .then((data) => applyLineupState(data))
          .catch(showSoftNavError);
        return;
      }

      const presetBtn = target.closest("#preset-add-btn");
      if (presetBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const ts = /** @type {any} */ (window).sizeDiffPresetSelect;
        const value =
          ts && typeof ts.getValue === "function" ? ts.getValue() : "";
        softAddPreset(typeof value === "string" ? value : "").catch(
          showSoftNavError,
        );
      }
    },
    true,
  );

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
 * @param {string} presetVal Tom Select option value (preset query string)
 */
async function softAddPreset(presetVal) {
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

  const ts = /** @type {any} */ (window).sizeDiffPresetSelect;
  if (ts && typeof ts.clear === "function") ts.clear(true);
  const presetBtn = document.getElementById("preset-add-btn");
  if (presetBtn instanceof HTMLButtonElement) presetBtn.disabled = true;
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
