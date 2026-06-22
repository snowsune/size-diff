function initTaurCanvas(config) {
    const {
        jointWorldPosition,
        placementFromJoint,
        drawLayer,
        createCanvasView,
        attachLayerDebugHud,
        loadImages,
        computePlacementBounds,
    } = window.SizeDiffCompositor;

    const canvas = document.getElementById('taur-canvas');
    const ctx = canvas.getContext('2d');
    const { taurData, layerSources, debug = false } = config;
    const BODY_LAYER_KEYS = new Set(['lBody', 'uBody', 'tail']);
    const DEFAULT_BODY_COLOR = '#ff0000'; // Volnar red
    const DEFAULT_RIDER_COLOR = '#ff8800'; // Felix orange
    const TRIM_ART_COMMAND = 'python3 scripts/trim_art.py';
    const LAYER_LABELS = {
        lBody: 'LowerBody',
        uBody: 'UpperBody',
        tail: 'Tail',
        rider: 'Rider',
    };

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

    function riderScale() {
        const raw = document.getElementById('rider_height')?.value;
        const height = parseFloat(raw);
        if (!raw || Number.isNaN(height)) {
            return 1;
        }
        return height / 100;
    }

    function buildPlacements() {
        const centerX = taurData.canvas.width / 2;
        const groundY = floorY();
        const showRider = document.getElementById('show_rider')?.checked;

        const [upperX, upperY] = jointWorldPosition(
            layerDef('lBody'),
            'upper_attach',
            'floor',
            centerX,
            groundY
        );
        const [tailX, tailY] = jointWorldPosition(
            layerDef('lBody'),
            'tail_attach',
            'floor',
            centerX,
            groundY
        );

        const placements = [
            {
                layerKey: 'lBody',
                visible: true,
                ...placementFromJoint(
                    layerDef('lBody'),
                    layers.lBody,
                    'floor',
                    centerX,
                    groundY,
                    { layerKey: 'lBody', label: LAYER_LABELS.lBody }
                ),
            },
            {
                layerKey: 'uBody',
                visible: true,
                ...placementFromJoint(
                    layerDef('uBody'),
                    layers.uBody,
                    'lower_attach',
                    upperX,
                    upperY,
                    { layerKey: 'uBody', label: LAYER_LABELS.uBody }
                ),
            },
            {
                layerKey: 'tail',
                visible: true,
                ...placementFromJoint(
                    layerDef('tail'),
                    layers.tail,
                    'body_attach',
                    tailX,
                    tailY,
                    { layerKey: 'tail', label: LAYER_LABELS.tail }
                ),
            },
        ];

        if (showRider) {
            const [riderX, riderY] = jointWorldPosition(
                layerDef('uBody'),
                'rider_attach',
                'lower_attach',
                upperX,
                upperY
            );
            placements.push({
                layerKey: 'rider',
                visible: true,
                ...placementFromJoint(
                    layerDef('rider'),
                    layers.rider,
                    'mount_attach',
                    riderX,
                    riderY,
                    {
                        layerKey: 'rider',
                        label: LAYER_LABELS.rider,
                        scale: riderScale(),
                    }
                ),
            });
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
        const contentBounds = computePlacementBounds(latestPlacements);

        view.update({
            contentBounds,
            paddingX: 12,
            paddingY: 12,
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

        debugHud.draw(ctx);
    }

    loadImages(layerSources, {
        onError: (key, source) => {
            const path = typeof source === 'string' ? source : source.path;
            console.error(
                `Failed to load taur layer "${key}" (art/dist/${path}). ` +
                `You must run \`${TRIM_ART_COMMAND}\` first to create dist images!`
            );
        },
    }).then((loaded) => {
        layers = loaded;
        drawScene();
    });

    canvas.addEventListener('compositor-redraw', drawScene);

    const showRiderCheckbox = document.getElementById('show_rider');
    if (showRiderCheckbox) {
        showRiderCheckbox.addEventListener('change', drawScene);
    }

    const riderHeightInput = document.getElementById('rider_height');
    if (riderHeightInput) {
        riderHeightInput.addEventListener('input', drawScene);
    }

    for (const colorInputId of ['taur_body_color', 'taur_rider_color']) {
        const colorInput = document.getElementById(colorInputId);
        if (colorInput) {
            colorInput.addEventListener('input', drawScene);
        }
    }

    window.addEventListener('resize', drawScene);
}

if (window.taurCanvasConfig) {
    initTaurCanvas(window.taurCanvasConfig);
}
