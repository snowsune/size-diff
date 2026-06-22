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

    function scaled(layerKey, anchorJoint, worldX, worldY, pixelsPerInch = null) {
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
        const lBodyDef = layerDef('lBody');
        const result = window.taurLastResult;

        function attachTailAndRider(placements, lBodyPlacement, pixelsPerInch) {
            function lBodyJointWorld(jointName) {
                const [lx, ly] = jointLocalPosition(lBodyDef, jointName);
                return placementLocalToWorld(lBodyPlacement, lx, ly);
            }

            const [tailX, tailY] = lBodyJointWorld('tail_attach');
            placements.push(scaled('tail', 'body_attach', tailX, tailY, pixelsPerInch));

            if (showRider && hasJoint('lBody', 'rider_attach') && hasJoint('rider', 'seat_attach')) {
                const [riderX, riderY] = lBodyJointWorld('rider_attach');
                placements.push(scaled('rider', 'seat_attach', riderX, riderY, pixelsPerInch));
            } else if (showRider) {
                console.warn(
                    'Rider not shown: missing lBody.rider_attach or rider.seat_attach in taur_data.json'
                );
            }

            return placements;
        }

        // Pass 1: place body layers so we can read the live TFH line.
        const lBodyPlacement = scaled('lBody', 'floor', centerX, groundY);
        const placements = [lBodyPlacement];

        const [upperX, upperY] = (() => {
            const [lx, ly] = jointLocalPosition(lBodyDef, 'upper_attach');
            return placementLocalToWorld(lBodyPlacement, lx, ly);
        })();

        placements.push(scaled('uBody', 'lower_attach', upperX, upperY));

        const scenePixelsPerInch = TaurMeasurements.deriveScenePixelsPerInch({
            canvasConfig: taurData.canvas ?? {},
            measurementDefs: taurData.measurements ?? {},
            placements,
            groundY,
            result,
            placementLocalToWorld,
        });

        return attachTailAndRider(placements, lBodyPlacement, scenePixelsPerInch);
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
            right: 48,
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
        const logicalW = taurData.canvas.width;

        targetCtx.strokeStyle = '#bbb';
        targetCtx.lineWidth = 3 / targetView.getViewState().scale;
        targetCtx.beginPath();
        targetCtx.moveTo(0, groundY);
        targetCtx.lineTo(logicalW, groundY);
        targetCtx.stroke();

        for (const placement of placements) {
            const image = layers[placement.layerKey];
            const mask = layers[`${placement.layerKey}_mask`] ?? null;
            const color = BODY_LAYER_KEYS.has(placement.layerKey)
                ? bodyColor()
                : riderColor();
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

        if (drawDebug) {
            debugHud.draw(targetCtx);
        }

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
