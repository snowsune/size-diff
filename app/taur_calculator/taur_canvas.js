/**
 * CalculaTAUR on Painter's Canvas.
 *
 * Bake parts with attachAt() at independent inch scales, then
 * ScaleCanvas.put({ heightInches: TFH }) so origin → skull is TFH on the grid.
 * The rider is decorative: seat-only joints, never origin/top.
 */

import {
    Sprite,
    loadSprite,
    attachAt,
    createScaleCanvas,
} from "/lib/painters-canvas/src/index.js";
import { worldMetrics } from "/lib/painters-canvas/src/scale-canvas/metrics.js";

const DEFAULT_BODY_COLOR = "#ff0000";
const DEFAULT_RIDER_COLOR = "#ff8800";
const DEFAULT_STANDING_COLOR = "#007516";

function formatInches(inches) {
    return window.SizeDiffUnits?.formatInches(inches) ?? `${inches}"`;
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

function measureToHead() {
    return document.getElementById("measure_to_head")?.checked !== false;
}

function heightMeasureName(sprite) {
    if (measureToHead() && sprite.hasJoint("top-of-head")) {
        return "top-of-head";
    }
    return "top";
}

/** ScaleCanvas wants `top` (highest / ear-tip). TFH measures `top-of-head`. */
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
    return spriteWithJoints(sprite, joints);
}

async function canvasToImage(canvas) {
    const image = new Image();
    image.src = canvas.toDataURL("image/png");
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
        trim.x, trim.y, trim.width, trim.height,
        0, 0, trim.width, trim.height,
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

    let minX = width, minY = height, maxX = -1, maxY = -1;
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

function jointsForLayer(key, loaded, layerDef) {
    const trim = layerDef.trim;
    const joints = {};
    for (const [name, pt] of Object.entries(loaded.joints)) {
        joints[name] = localPoint(pt, trim);
    }
    if (Array.isArray(layerDef.joints?.floor)) {
        const [x, y] = layerDef.joints.floor;
        joints.origin = localPoint({ x, y }, trim);
    }
    const tl = window.taurCanvasConfig?.taurData?.measurements?.TL;
    if (key === "lBody" && tl?.start) {
        joints["tl-a"] = { x: tl.start[1], y: tl.start[2] };
    }
    return joints;
}

async function loadLayerSprite(key, source, layerDef) {
    const loaded = source?.json
        ? await loadSprite(source.json)
        : new Sprite({
            name: key,
            image: await loadPlainImage(
                typeof source === "string" ? source : source.url,
            ),
            joints: {},
        });
    return new Sprite({
        name: key,
        image: await cropToImage(loaded.image, layerDef.trim),
        joints: jointsForLayer(key, loaded, layerDef),
        color: loaded.color,
    });
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

function sceneLayout(scaleCanvas) {
    const items = scaleCanvas.items;
    if (!items.length) return null;
    const metrics = items.map((item) => worldMetrics(item));
    const pad = scaleCanvas.padding;
    const labelGutter = scaleCanvas.showGrid ? 36 : 0;
    let totalWidthInches = 0;
    let maxAbove = 0;
    let maxBelow = 0;
    for (let i = 0; i < metrics.length; i++) {
        totalWidthInches += metrics[i].widthInches;
        if (i < metrics.length - 1) totalWidthInches += scaleCanvas.gapInches;
        maxAbove = Math.max(maxAbove, metrics[i].aboveOriginInches);
        maxBelow = Math.max(maxBelow, metrics[i].belowOriginInches);
    }
    const captionRoom = items.some((item) => item.caption) ? 20 : 0;
    const ppi = Math.min(
        Math.max(1, scaleCanvas.maxWidth - pad * 2 - labelGutter) / totalWidthInches,
        Math.max(1, scaleCanvas.maxHeight - pad * 2 - captionRoom) / (maxAbove + maxBelow),
    );
    const groundY = pad + maxAbove * ppi;
    let cursorX = pad + labelGutter;
    const placed = items.map((item, i) => {
        const m = metrics[i];
        const entry = {
            item,
            drawScale: (item.heightInches * ppi) / m.heightPx,
            originCanvasX: cursorX + m.originXInches * ppi,
            originCanvasY: groundY,
        };
        cursorX += m.widthInches * ppi;
        if (i < items.length - 1) cursorX += scaleCanvas.gapInches * ppi;
        return entry;
    });
    return { ppi, placed };
}

function jointCanvas(placed, name) {
    const sprite = placed.item.sprite;
    if (!sprite.hasJoint(name) || !sprite.hasJoint("origin")) return null;
    const origin = sprite.joint("origin");
    const j = sprite.joint(name);
    return [
        placed.originCanvasX + (j.x - origin.x) * placed.drawScale,
        placed.originCanvasY + (j.y - origin.y) * placed.drawScale,
    ];
}

function drawDimLine(ctx, start, end, label) {
    if (!start || !end) return;
    const [x0, y0] = start;
    const [x1, y1] = end;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 2) return;
    const nx = (-(y1 - y0) / len) * 6;
    const ny = ((x1 - x0) / len) * 6;
    ctx.save();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.moveTo(x0 - nx, y0 - ny);
    ctx.lineTo(x0 + nx, y0 + ny);
    ctx.moveTo(x1 - nx, y1 - ny);
    ctx.lineTo(x1 + nx, y1 + ny);
    ctx.stroke();
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    const w = ctx.measureText(label).width + 6;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(midX - w / 2, midY - 16, w, 14);
    ctx.fillStyle = "#222";
    ctx.fillText(label, midX, midY - 3);
    ctx.restore();
}

function canvasCssSize(canvas) {
    return {
        width: canvas.clientWidth || parseFloat(canvas.style.width) || canvas.width,
        height: canvas.clientHeight || parseFloat(canvas.style.height) || canvas.height,
    };
}

function drawTfhLabel(ctx, canvas, result) {
    if (!(result?.TFH > 0)) return;
    ctx.save();
    ctx.fillStyle = "#222";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`TFH ${formatInches(result.TFH)}`, 48, 16);
    ctx.restore();
}

function drawResultsOverlay(ctx, canvas) {
    const overlay = window.taurResultsOverlay ?? { name: "", rows: [] };
    if (!overlay.name && !overlay.rows?.length) return;

    const { width, height } = canvasCssSize(canvas);
    const heading = Math.max(13, height * 0.021);
    const body = Math.max(12, height * 0.019);
    const lineHeight = Math.max(15, height * 0.023);
    const color = document.getElementById("taur_body_color")?.value || DEFAULT_BODY_COLOR;
    const rightX = width - 24;
    let y = 16;

    ctx.save();
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.textAlign = "right";

    if (overlay.name) {
        ctx.font = `bold ${heading}px sans-serif`;
        ctx.fillText(overlay.name, rightX, y);
        y += heading + lineHeight * 0.4;
    }
    if (!overlay.rows?.length) {
        ctx.restore();
        return;
    }

    ctx.font = `bold ${heading}px sans-serif`;
    ctx.fillText("Calculation Results", rightX, y);
    y += heading + lineHeight * 0.35;

    for (const [key, value] of overlay.rows) {
        const rowColor =
            key === "RH" && document.getElementById("show_rider")?.checked
                ? document.getElementById("taur_rider_color")?.value || DEFAULT_RIDER_COLOR
                : key === "StH" && document.getElementById("show_standing")?.checked
                    ? document.getElementById("taur_standing_color")?.value || DEFAULT_STANDING_COLOR
                    : color;
        ctx.fillStyle = rowColor;
        ctx.font = `${body}px sans-serif`;
        const valueWidth = ctx.measureText(value).width;
        ctx.fillText(value, rightX, y);
        ctx.font = `bold ${body}px sans-serif`;
        ctx.fillText(key, rightX - valueWidth - 12, y);
        y += lineHeight;
    }
    ctx.restore();
}

function initTaurCanvas(config) {
    const host = document.getElementById("taur-canvas");
    const { taurData, layerSources } = config;
    const baseSprites = {};
    const tintCache = new Map();
    let scaleCanvas = null;
    let ready = false;
    let drawSeq = 0;

    const bodyColor = () =>
        document.getElementById("taur_body_color")?.value || DEFAULT_BODY_COLOR;
    const riderColor = () =>
        document.getElementById("taur_rider_color")?.value || DEFAULT_RIDER_COLOR;
    const standingColor = () =>
        document.getElementById("taur_standing_color")?.value || DEFAULT_STANDING_COLOR;

    function ensureCanvas() {
        const box = host.parentElement ?? host;
        const maxWidth = Math.max(320, Math.floor((box.clientWidth || 900) - 4));
        const maxHeight = Math.max(240, Math.floor((box.clientHeight || 600) - 4));
        if (!scaleCanvas) {
            scaleCanvas = createScaleCanvas(host, {
                maxWidth,
                maxHeight,
                padding: 28,
                gapInches: 8,
                background: "#ffffff",
                showGrid: true,
                showHeightMarks: true,
            });
        } else {
            scaleCanvas.maxWidth = maxWidth;
            scaleCanvas.maxHeight = maxHeight;
        }
        return scaleCanvas;
    }

    async function tinted(key, color) {
        const cacheKey = `${key}:${color || ""}`;
        if (tintCache.has(cacheKey)) return tintCache.get(cacheKey);
        const base = baseSprites[key];
        const sprite = color ? await base.recolor(color) : base;
        tintCache.set(cacheKey, sprite);
        return sprite;
    }

    async function bakeTaur(result) {
        const th = result.TH;
        const ubh = result.UBH ?? result.TFH - result.TH;
        const color = bodyColor();

        let body = ensureScaleJoints(await tinted("lBody", color));
        const uBody = ensureScaleJoints(await tinted("uBody", color));
        const tail = await tinted("tail", color);

        const thPx = spanY(body, "origin", "body");
        const ubhJoint = heightMeasureName(uBody);
        const ubhPx = uBody.hasJoint(ubhJoint)
            ? spanY(uBody, "body", ubhJoint)
            : spanY(uBody, "body", "head");
        const ttPx = tail.hasJoint("tt-a") && tail.hasJoint("tt-b")
            ? Math.abs(tail.joint("tt-a").x - tail.joint("tt-b").x)
            : tail.width;

        body = await attachAt(body, uBody, "body", {
            scale: attachScale(ubhPx, ubh, thPx, th),
        });
        body = await attachAt(body, tail, "tail", {
            scale: attachScale(ttPx, result.TT, thPx, th),
        });

        // Rider is decoration. Keep only `seat` so origin/top stay on the taur.
        const showRider = document.getElementById("show_rider")?.checked;
        if (showRider && result.RH && baseSprites.rider?.hasJoint("seat")) {
            const riderFull = await tinted("rider", riderColor());
            const rhPx = riderFull.hasJoint("origin") && riderFull.hasJoint("top-of-head")
                ? spanY(riderFull, "origin", "top-of-head")
                : riderFull.height;
            body = await attachAt(
                body,
                onlyJoints(riderFull, ["seat"]),
                "seat",
                { scale: attachScale(rhPx, result.RH, thPx, th) },
            );
        }

        return ensureScaleJoints(await trimSprite(body));
    }

    function drawExtraMeasurements(result) {
        const layout = sceneLayout(scaleCanvas);
        if (!layout) return;
        const taur = layout.placed.find((p) => p.item.label === "") ?? layout.placed.at(-1);
        if (!taur) return;
        const ctx = scaleCanvas.ctx;
        const ppi = layout.ppi;
        const line = (from, dx, dy, inches, label) => {
            if (inches == null) return;
            const start = jointCanvas(taur, from);
            if (!start) return;
            drawDimLine(
                ctx,
                start,
                [start[0] + dx * ppi, start[1] - dy * ppi],
                `${label}: ${formatInches(inches)}`,
            );
        };
        line("origin", -0.4, result.TH, result.TH, "TH");
        line("tail", result.TT, 0, result.TT, "TT");
        line("tl-a", result.TL, 0, result.TL, "TL");
        line("body", 0, result.TTo, result.TTo, "TTo");
        line("top-of-head", 0, -result.THe, result.THe, "THe");
    }

    async function renderScene(seq) {
        if (!ready) return;
        const canvas = ensureCanvas();
        canvas.clear();

        const result = window.taurLastResult;
        if (!(result?.TFH > 0)) {
            drawResultsOverlay(canvas.ctx, canvas.canvas);
            return;
        }

        const showMeasurements = Boolean(
            document.getElementById("show_measurements")?.checked,
        );
        canvas.showHeightMarks = showMeasurements;

        if (
            document.getElementById("show_standing")?.checked &&
            result.StH > 0 &&
            baseSprites.standingChar
        ) {
            const standing = ensureScaleJoints(
                await tinted("standingChar", standingColor()),
            );
            if (seq !== drawSeq) return;
            canvas.put(standing, {
                heightInches: result.StH,
                measure: heightMeasureName(standing),
                heightMark: showMeasurements,
                label: `StH ${formatInches(result.StH)}`,
            });
        }

        const taur = await bakeTaur(result);
        if (seq !== drawSeq) return;
        const name = document.getElementById("name")?.value?.trim();
        canvas.put(taur, {
            heightInches: result.TFH,
            measure: heightMeasureName(taur),
            heightMark: showMeasurements,
            label: "",
            caption: name || undefined,
        });

        if (showMeasurements) drawExtraMeasurements(result);
        drawTfhLabel(canvas.ctx, canvas.canvas, result);
        drawResultsOverlay(canvas.ctx, canvas.canvas);
    }

    function drawScene() {
        const seq = ++drawSeq;
        renderScene(seq).catch((err) => {
            console.error("Taur ScaleCanvas draw failed:", err);
        });
    }

    Promise.all(
        Object.entries(layerSources).map(async ([key, source]) => {
            baseSprites[key] = await loadLayerSprite(key, source, taurData.layers[key]);
        }),
    )
        .then(() => {
            ready = true;
            drawScene();
        })
        .catch((err) => {
            console.error("Failed to load taur layers:", err);
            host.textContent = `Failed to load taur art: ${err.message || err}`;
        });

    host.addEventListener("compositor-redraw", drawScene);
    window.addEventListener("resize", drawScene);
}

if (window.taurCanvasConfig) {
    initTaurCanvas(window.taurCanvasConfig);
}
