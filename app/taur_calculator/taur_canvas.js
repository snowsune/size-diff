function initTaurCanvas(config) {
    const {
        jointWorldPosition,
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

    function scaled(layerKey, anchorJoint, worldX, worldY) {
        return placeScaledLayer({
            layerKey,
            layerDef: layerDef(layerKey),
            image: layers[layerKey],
            anchorJoint,
            worldX,
            worldY,
            result: window.taurLastResult,
            form,
            placementFromJoint,
            anchorJointOnPlacement,
            jointLocalPosition,
        });
    }

    function buildPlacements() {
        const centerX = taurData.canvas.width / 2;
        const groundY = floorY();
        const showRider = document.getElementById('show_rider')?.checked;

        const [upperX, upperY] = jointWorldPosition(
            layerDef('lBody'), 'upper_attach', 'floor', centerX, groundY
        );
        const [tailX, tailY] = jointWorldPosition(
            layerDef('lBody'), 'tail_attach', 'floor', centerX, groundY
        );

        const placements = [
            {
                layerKey: 'lBody',
                visible: true,
                ...placementFromJoint(
                    layerDef('lBody'), layers.lBody, 'floor', centerX, groundY,
                    { layerKey: 'lBody' }
                ),
            },
            scaled('uBody', 'lower_attach', upperX, upperY),
            scaled('tail', 'body_attach', tailX, tailY),
        ];

        if (showRider) {
            const lBodyPlacement = placements.find((p) => p.layerKey === 'lBody');
            const [rx, ry] = jointLocalPosition(layerDef('lBody'), 'rider_attach');
            const [riderX, riderY] = placementLocalToWorld(lBodyPlacement, rx, ry);
            placements.push(scaled('rider', 'seat_attach', riderX, riderY));
        }

        return placements;
    }

    const debugHud = attachLayerDebugHud(canvas, {
        view,
        enabled: () => debug,
        getPlacements: () => latestPlacements,
    });

    function drawScene() {
        latestPlacements = buildPlacements();
        const centerX = taurData.canvas.width / 2;

        let contentBounds = unionBounds(
            computePlacementBounds(latestPlacements),
            computePlacementBounds(latestPlacements, { ignoreScale: true })
        );
        contentBounds = expandBounds(contentBounds, {
            left: 72,
            top: 48,
            right: 48,
            bottom: 8,
        });

        view.update({
            contentBounds,
            centerX,
            paddingX: 20,
            paddingY: 20,
            alignY: 'bottom',
        });
        view.clear(ctx);

        const groundY = floorY();
        const logicalW = taurData.canvas.width;

        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 3 / view.getViewState().scale;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(logicalW, groundY);
        ctx.stroke();

        for (const placement of latestPlacements) {
            const image = layers[placement.layerKey];
            const mask = layers[`${placement.layerKey}_mask`] ?? null;
            const color = BODY_LAYER_KEYS.has(placement.layerKey)
                ? bodyColor()
                : riderColor();
            drawLayer(ctx, image, placement, { color, mask });
        }

        const showLines = document.getElementById('show_measurements')?.checked ?? false;
        if (showLines) {
            const measurementScene = TaurMeasurements.buildScene({
                measurementDefs: taurData.measurements ?? {},
                placements: latestPlacements,
                groundY,
                result: window.taurLastResult,
                placementLocalToWorld,
            });

            if (measurementScene) {
                view.applyWorldTransform(ctx);
                for (const line of measurementScene.measurements) {
                    drawMeasurement(ctx, view, line);
                }
            }
        }

        debugHud.draw(ctx);
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
}

if (window.taurCanvasConfig) {
    initTaurCanvas(window.taurCanvasConfig);
}
