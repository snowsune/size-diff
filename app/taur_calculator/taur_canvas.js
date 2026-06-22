function initTaurCanvas(config) {
    const {
        jointLocalPosition,
        placementFromJoint,
        placementLocalToWorld,
        anchorJointOnPlacement,
        drawLayer,
        drawMeasurement,
        createCanvasView,
        attachLayerDebugHud,
        loadImages,
        computePlacementBounds,
        unionBounds,
        expandBounds,
    } = window.SizeDiffCompositor;

    const canvas = document.getElementById('taur-canvas');
    const ctx = canvas.getContext('2d');
    const form = document.getElementById('taur-form');
    const { taurData, layerSources, debug = false } = config;
    const BODY_LAYER_KEYS = new Set(['lBody', 'uBody', 'tail']);
    const DEFAULT_BODY_COLOR = '#ff0000';
    const DEFAULT_RIDER_COLOR = '#ff8800';
    const DEFAULT_STANDING_COLOR = '#007516';
    const STANDING_CHAR_FLOOR_X = 400;
    const TRIM_ART_COMMAND = 'python3 scripts/trim_art.py';
    const SHARE_EXPORT_WIDTH = 1200;
    const SHARE_EXPORT_HEIGHT = 900;

    const { placeScaledLayer } = TaurMeasurements;

    const view = createCanvasView(
        canvas,
        taurData.canvas.width,
        taurData.canvas.height
    );

    let layers = {};
    let latestPlacements = [];

    function layerDef(key) {
        return taurData.layers[key];
    }

    function floorY() {
        return taurData.canvas.height - taurData.canvas.floor_margin;
    }

    function bodyColor() {
        return document.getElementById('taur_body_color')?.value || DEFAULT_BODY_COLOR;
    }

    function riderColor() {
        return document.getElementById('taur_rider_color')?.value || DEFAULT_RIDER_COLOR;
    }

    function standingColor() {
        return document.getElementById('taur_standing_color')?.value || DEFAULT_STANDING_COLOR;
    }

    function placementColor(layerKey) {
        if (layerKey === 'standingChar') {
            return standingColor();
        }
        if (layerKey === 'rider') {
            return riderColor();
        }
        return bodyColor();
    }

    const OVERLAY_CORNER_PAD = 56;

    function overlayFontSizes(displayH) {
        return {
            heading: Math.max(13, displayH * 0.021),
            body: Math.max(12, displayH * 0.019),
            lineHeight: Math.max(15, displayH * 0.023),
        };
    }

    function wrapTextLines(ctx, text, maxWidth) {
        const words = String(text).split(/\s+/);
        const lines = [];
        let line = '';

        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(candidate).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }

        if (line) {
            lines.push(line);
        }

        return lines;
    }

    function drawResultsOverlay(targetCtx, targetView) {
        const overlay = window.taurResultsOverlay ?? { name: '', rows: [] };
        if (!overlay.name && !overlay.rows?.length) {
            return;
        }

        const vs = targetView.getViewState();
        const fonts = overlayFontSizes(vs.displayH);
        const color = bodyColor();
        const rightX = vs.displayW - OVERLAY_CORNER_PAD;
        const maxBlockWidth = Math.min(
            vs.displayW * 0.48,
            vs.displayW - OVERLAY_CORNER_PAD * 2
        );
        let y = OVERLAY_CORNER_PAD;

        targetCtx.save();
        targetCtx.setTransform(1, 0, 0, 1, 0, 0);
        targetCtx.fillStyle = color;
        targetCtx.textBaseline = 'top';

        let keyWidth = 0;
        if (overlay.rows?.length) {
            targetCtx.font = `bold ${fonts.body}px sans-serif`;
            for (const [key] of overlay.rows) {
                keyWidth = Math.max(keyWidth, targetCtx.measureText(key).width);
            }
            keyWidth = Math.ceil(keyWidth) + 10;
        }

        const valueWidth = Math.max(80, maxBlockWidth - keyWidth);
        const rowLayouts = [];
        let blockWidth = 0;

        if (overlay.name) {
            targetCtx.font = `bold ${fonts.heading}px sans-serif`;
            blockWidth = Math.max(blockWidth, targetCtx.measureText(overlay.name).width);
        }

        if (overlay.rows?.length) {
            targetCtx.font = `bold ${fonts.heading}px sans-serif`;
            blockWidth = Math.max(
                blockWidth,
                targetCtx.measureText('Calculation Results').width
            );

            targetCtx.font = `${fonts.body}px sans-serif`;
            for (const [key, value] of overlay.rows) {
                const valueLines = wrapTextLines(targetCtx, value, valueWidth);
                let rowWidth = keyWidth;
                for (const line of valueLines) {
                    rowWidth = Math.max(rowWidth, keyWidth + targetCtx.measureText(line).width);
                }
                blockWidth = Math.max(blockWidth, rowWidth);
                rowLayouts.push({ key, valueLines });
            }
        }

        const x = rightX - blockWidth;

        if (overlay.name) {
            targetCtx.font = `bold ${fonts.heading}px sans-serif`;
            targetCtx.textAlign = 'right';
            targetCtx.fillText(overlay.name, rightX, y);
            targetCtx.textAlign = 'left';
            y += fonts.heading + fonts.lineHeight * 0.45;
        }

        if (overlay.rows?.length) {
            targetCtx.font = `bold ${fonts.heading}px sans-serif`;
            targetCtx.textAlign = 'right';
            targetCtx.fillText('Calculation Results', rightX, y);
            targetCtx.textAlign = 'left';
            y += fonts.heading + fonts.lineHeight * 0.4;

            for (const { key, valueLines } of rowLayouts) {
                const rowColor = key === 'RH' && document.getElementById('show_rider')?.checked
                    ? riderColor()
                    : key === 'StH' && document.getElementById('show_standing')?.checked
                        ? standingColor()
                        : color;
                targetCtx.fillStyle = rowColor;

                targetCtx.font = `bold ${fonts.body}px sans-serif`;
                targetCtx.fillText(key, x, y);

                targetCtx.font = `${fonts.body}px sans-serif`;
                const valueX = x + keyWidth;
                for (let i = 0; i < valueLines.length; i += 1) {
                    targetCtx.fillText(valueLines[i], valueX, y + i * fonts.lineHeight);
                }
                y += fonts.lineHeight * Math.max(1, valueLines.length);
            }
        }

        targetCtx.restore();
    }

    function scaled(layerKey, anchorJoint, worldX, worldY, pixelsPerInch) {
        return placeScaledLayer({
            layerKey,
            layerDef: layerDef(layerKey),
            image: layers[layerKey],
            anchorJoint,
            worldX,
            worldY,
            result: window.taurLastResult,
            pixelsPerInch,
            placementFromJoint,
            anchorJointOnPlacement,
            jointLocalPosition,
        });
    }

    function hasJoint(layerKey, jointName) {
        return Boolean(taurData.layers[layerKey]?.joints?.[jointName]);
    }

    function buildPlacements() {
        const centerX = taurData.canvas.width / 2;
        const groundY = floorY();
        const showRider = document.getElementById('show_rider')?.checked;
        const showStanding = document.getElementById('show_standing')?.checked;
        const lBodyDef = layerDef('lBody');
        const scenePpi = TaurMeasurements.scenePixelsPerInch(taurData.canvas) ?? 1;
        const placements = [];

        if (showStanding && layerDef('standingChar')?.joints?.floor) {
            placements.push(
                scaled('standingChar', 'floor', STANDING_CHAR_FLOOR_X, groundY, scenePpi)
            );
        }

        const lBodyPlacement = scaled('lBody', 'floor', centerX, groundY, scenePpi);
        placements.push(lBodyPlacement);

        const [lx, ly] = jointLocalPosition(lBodyDef, 'upper_attach');
        const [upperX, upperY] = placementLocalToWorld(lBodyPlacement, lx, ly);
        placements.push(scaled('uBody', 'lower_attach', upperX, upperY, scenePpi));

        function lBodyJointWorld(jointName) {
            const [jx, jy] = jointLocalPosition(lBodyDef, jointName);
            return placementLocalToWorld(lBodyPlacement, jx, jy);
        }

        const [tailX, tailY] = lBodyJointWorld('tail_attach');
        placements.push(scaled('tail', 'body_attach', tailX, tailY, scenePpi));

        if (showRider && hasJoint('lBody', 'rider_attach') && hasJoint('rider', 'seat_attach')) {
            const [riderX, riderY] = lBodyJointWorld('rider_attach');
            placements.push(scaled('rider', 'seat_attach', riderX, riderY, scenePpi));
        } else if (showRider) {
            console.warn(
                'Rider not shown: missing lBody.rider_attach or rider.seat_attach in taur_data.json'
            );
        }

        return placements;
    }

    function renderScene(targetCanvas, targetView, targetCtx, { includeMeasurements, drawDebug }) {
        const placements = buildPlacements();
        const centerX = taurData.canvas.width / 2;

        let contentBounds = unionBounds(
            computePlacementBounds(placements),
            computePlacementBounds(placements, { ignoreScale: true })
        );
        contentBounds = expandBounds(contentBounds, {
            left: 72,
            top: 48,
            right: 72,
            bottom: 8,
        });

        targetView.update({
            contentBounds,
            centerX,
            paddingX: 20,
            paddingY: 20,
            alignY: 'bottom',
        });
        targetView.clear(targetCtx);

        const groundY = floorY();
        const vs = targetView.getViewState();
        const groundScreenY = groundY * vs.scale + vs.offsetY;

        targetCtx.save();
        targetCtx.setTransform(1, 0, 0, 1, 0, 0);
        targetCtx.strokeStyle = '#bbb';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.moveTo(0, groundScreenY);
        targetCtx.lineTo(vs.displayW, groundScreenY);
        targetCtx.stroke();
        targetCtx.restore();

        for (const placement of placements) {
            const image = layers[placement.layerKey];
            const mask = layers[`${placement.layerKey}_mask`] ?? null;
            const color = placementColor(placement.layerKey);
            drawLayer(targetCtx, image, placement, { color, mask });
        }

        if (includeMeasurements && window.taurLastResult) {
            const measurementScene = TaurMeasurements.buildScene({
                measurementDefs: taurData.measurements ?? {},
                placements,
                groundY,
                result: window.taurLastResult,
                placementLocalToWorld,
            });

            if (measurementScene) {
                targetView.applyWorldTransform(targetCtx);
                for (const line of measurementScene.measurements) {
                    drawMeasurement(targetCtx, targetView, line);
                }
            }
        }

        if (drawDebug && window.taurLastResult) {
            debugHud.draw(targetCtx);

            const scenePpi = TaurMeasurements.scenePixelsPerInch(taurData.canvas);
            const measuredTfhPpi = TaurMeasurements.measuredTfhPixelsPerInch({
                canvasConfig: taurData.canvas ?? {},
                measurementDefs: taurData.measurements ?? {},
                placements,
                groundY,
                result: window.taurLastResult,
                placementLocalToWorld,
            });
            const ttWorld = TaurMeasurements.measureDefinitionWorldDistance(
                taurData.measurements?.TT,
                placements,
                groundY,
                placementLocalToWorld
            );
            const { TFH, TT } = window.taurLastResult;
            console.debug('Taur scene ruler', {
                scenePpi,
                measuredTfhPpi,
                tfhWorld: measuredTfhPpi != null && TFH != null ? measuredTfhPpi * TFH : null,
                tfhExpected: TFH != null && scenePpi != null ? TFH * scenePpi : null,
                ttWorld,
                ttExpected: TT != null && scenePpi != null ? TT * scenePpi : null,
            });
        } else if (drawDebug) {
            debugHud.draw(targetCtx);
        }

        drawResultsOverlay(targetCtx, targetView);

        return placements;
    }

    const debugHud = attachLayerDebugHud(canvas, {
        view,
        enabled: () => debug,
        getPlacements: () => latestPlacements,
    });

    function drawScene() {
        try {
            latestPlacements = renderScene(canvas, view, ctx, {
                includeMeasurements: document.getElementById('show_measurements')?.checked ?? false,
                drawDebug: true,
            });
        } catch (err) {
            console.error('Taur buildPlacements failed:', err);
        }
    }

    function exportSharePng() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = SHARE_EXPORT_WIDTH;
        exportCanvas.height = SHARE_EXPORT_HEIGHT;
        exportCanvas.style.width = `${SHARE_EXPORT_WIDTH}px`;
        exportCanvas.style.height = `${SHARE_EXPORT_HEIGHT}px`;
        exportCanvas.style.position = 'fixed';
        exportCanvas.style.left = '-10000px';
        document.body.appendChild(exportCanvas);

        const exportView = createCanvasView(
            exportCanvas,
            taurData.canvas.width,
            taurData.canvas.height
        );
        const exportCtx = exportCanvas.getContext('2d');

        try {
            renderScene(exportCanvas, exportView, exportCtx, {
                includeMeasurements: false,
                drawDebug: false,
            });
        } finally {
            document.body.removeChild(exportCanvas);
        }

        return new Promise((resolve, reject) => {
            exportCanvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to export preview image'));
                }
            }, 'image/png');
        });
    }

    loadImages(layerSources, {
        onError: (key, source) => {
            const path = typeof source === 'string' ? source : source.path;
            console.error(
                `Failed to load taur layer "${key}" (art/dist/${path}). ` +
                `Run \`${TRIM_ART_COMMAND}\` first.`
            );
        },
    }).then((loaded) => {
        layers = loaded;
        drawScene();
    });

    canvas.addEventListener('compositor-redraw', drawScene);
    window.addEventListener('resize', drawScene);
    window.taurExportSharePng = exportSharePng;
}

if (window.taurCanvasConfig) {
    initTaurCanvas(window.taurCanvasConfig);
}
