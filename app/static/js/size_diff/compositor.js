/**
 * Vixi's NEW size diff compositor!
 *
 * Attach to window.SizeDiffCompositor
 */
const SizeDiffCompositor = (() => {
    function jointLocalPosition(layerDef, jointName) {
        const [jx, jy] = layerDef.joints[jointName];
        const trim = layerDef.trim;
        return [jx - trim.x, jy - trim.y];
    }

    function jointWorldPosition(layerDef, jointName, placedAtJoint, worldX, worldY) {
        const joints = layerDef.joints;
        const [jx, jy] = joints[jointName];
        const [px, py] = joints[placedAtJoint];
        return [worldX + (jx - px), worldY + (jy - py)];
    }

    function placementFromJoint(layerDef, image, jointName, targetX, targetY, meta = {}) {
        const [localX, localY] = jointLocalPosition(layerDef, jointName);
        return {
            ...meta,
            drawX: targetX - localX,
            drawY: targetY - localY,
            width: image ? image.width : 0,
            height: image ? image.height : 0,
            scale: meta.scale ?? 1,
            scaleCenter: layerDef.scale_center ?? null,
        };
    }

    function layerLocalCoords(worldX, worldY, placement) {
        return {
            x: Math.round(worldX - placement.drawX),
            y: Math.round(worldY - placement.drawY),
        };
    }

    function placementLocalToWorld(placement, localX, localY) {
        const scale = placement.scale ?? 1;
        const center = placement.scaleCenter;

        if (scale === 1 || !center) {
            return [placement.drawX + localX, placement.drawY + localY];
        }

        const [cx, cy] = center;
        return [
            placement.drawX + cx + (localX - cx) * scale,
            placement.drawY + cy + (localY - cy) * scale,
        ];
    }

    function applyPlacementTransform(ctx, placement, draw) {
        const scale = placement.scale ?? 1;
        const center = placement.scaleCenter;

        ctx.save();
        if (scale === 1 || !center) {
            ctx.translate(placement.drawX, placement.drawY);
            draw(ctx, 0, 0);
        } else {
            const [cx, cy] = center;
            ctx.translate(placement.drawX + cx, placement.drawY + cy);
            ctx.scale(scale, scale);
            draw(ctx, -cx, -cy);
        }
        ctx.restore();
    }

    let colorScratch = null;

    function getColorScratch(width, height) {
        if (!colorScratch) {
            colorScratch = document.createElement('canvas');
        }
        if (colorScratch.width < width) {
            colorScratch.width = width;
        }
        if (colorScratch.height < height) {
            colorScratch.height = height;
        }
        return colorScratch;
    }

    function drawLayer(ctx, image, placement, { color = '#000000', mask = null } = {}) {
        if (!image) {
            return;
        }

        if (mask) {
            applyPlacementTransform(ctx, placement, (layerCtx, x, y) => {
                layerCtx.drawImage(mask, x, y);
            });
        }

        const width = image.width;
        const height = image.height;

        applyPlacementTransform(ctx, placement, (layerCtx, x, y) => {
            const scratch = getColorScratch(width, height);
            const scratchCtx = scratch.getContext('2d');
            scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
            scratchCtx.clearRect(0, 0, width, height);
            scratchCtx.globalCompositeOperation = 'source-over';
            scratchCtx.drawImage(image, 0, 0);
            scratchCtx.globalCompositeOperation = 'source-in';
            scratchCtx.fillStyle = color;
            scratchCtx.fillRect(0, 0, width, height);
            layerCtx.drawImage(scratch, 0, 0, width, height, x, y, width, height);
        });
    }

    function computePlacementBounds(placements) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const placement of placements) {
            if (placement.visible === false) {
                continue;
            }

            const scale = placement.scale ?? 1;
            let left = placement.drawX;
            let top = placement.drawY;
            let right = placement.drawX + placement.width;
            let bottom = placement.drawY + placement.height;

            if (scale !== 1 && placement.scaleCenter) {
                const [cx, cy] = placement.scaleCenter;
                left = placement.drawX + cx * (1 - scale);
                top = placement.drawY + cy * (1 - scale);
                right = left + placement.width * scale;
                bottom = top + placement.height * scale;
            }

            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
        }

        if (!Number.isFinite(minX)) {
            return null;
        }

        return { minX, minY, maxX, maxY };
    }

    function maskPathFor(artPath) {
        const dot = artPath.lastIndexOf('.');
        if (dot === -1) {
            return `${artPath}_Mask`;
        }
        return `${artPath.slice(0, dot)}_Mask${artPath.slice(dot)}`;
    }

    function createCanvasView(canvas, logicalWidth, logicalHeight) {
        let viewState = null;

        function update(fitOptions = null) {
            const displayW = canvas.clientWidth;
            const displayH = canvas.clientHeight;
            let scale;
            let offsetX;
            let offsetY;

            if (fitOptions?.contentBounds) {
                const { minX, minY, maxX, maxY } = fitOptions.contentBounds;
                const contentW = maxX - minX;
                const contentH = maxY - minY;
                const padX = fitOptions.paddingX ?? 16;
                const padY = fitOptions.paddingY ?? 16;

                scale = Math.min(
                    (displayW - padX * 2) / contentW,
                    (displayH - padY * 2) / contentH
                );

                offsetX = (displayW - contentW * scale) / 2 - minX * scale;
                if (fitOptions.alignY === 'bottom') {
                    offsetY = displayH - padY - maxY * scale;
                } else {
                    offsetY = (displayH - contentH * scale) / 2 - minY * scale;
                }
            } else {
                scale = Math.min(displayW / logicalWidth, displayH / logicalHeight);
                offsetX = (displayW - logicalWidth * scale) / 2;
                offsetY = (displayH - logicalHeight * scale) / 2;
            }

            canvas.width = displayW;
            canvas.height = displayH;
            viewState = {
                scale,
                offsetX,
                offsetY,
                logicalWidth,
                logicalHeight,
                displayW,
                displayH,
            };
            return viewState;
        }

        function getViewState() {
            return viewState ?? update();
        }

        function applyWorldTransform(ctx) {
            const vs = getViewState();
            ctx.setTransform(vs.scale, 0, 0, vs.scale, vs.offsetX, vs.offsetY);
        }

        function clear(ctx, fillStyle = '#fff') {
            const vs = getViewState();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = fillStyle;
            ctx.fillRect(0, 0, vs.displayW, vs.displayH);
            applyWorldTransform(ctx);
            ctx.fillStyle = fillStyle;
            ctx.fillRect(0, 0, vs.logicalWidth, vs.logicalHeight);
        }

        function displayToWorld(displayX, displayY) {
            const vs = viewState;
            if (!vs) {
                return null;
            }
            return {
                x: (displayX - vs.offsetX) / vs.scale,
                y: (displayY - vs.offsetY) / vs.scale,
            };
        }

        function worldToDisplay(worldX, worldY) {
            const vs = viewState;
            if (!vs) {
                return null;
            }
            return {
                x: worldX * vs.scale + vs.offsetX,
                y: worldY * vs.scale + vs.offsetY,
            };
        }

        return {
            update,
            getViewState,
            applyWorldTransform,
            clear,
            displayToWorld,
            worldToDisplay,
        };
    }

    /**
     * Scene scale: world pixels per real-world inch.
     *
     * Viewport `view.scale` is screen pixels per world pixel
     * `pixelsPerInch` is world pixels per inch (figure calibration).
     * Display inches per screen pixel: 1 / (pixelsPerInch * view.scale).
     */
    function createSceneScale(pixelsPerInch) {
        const ppi = typeof pixelsPerInch === 'object'
            ? pixelsPerInch.pixelsPerInch
            : pixelsPerInch;

        return {
            pixelsPerInch: ppi,
            inchesToWorld(inches) {
                return SizeDiffUnits.inchesToWorld(inches, ppi);
            },
            worldToInches(distance) {
                return SizeDiffUnits.worldToInches(distance, ppi);
            },
        };
    }

    createSceneScale.fromReference = (inches, worldDistance) => createSceneScale(
        SizeDiffUnits.pixelsPerInchFromReference(inches, worldDistance)
    );

    /**
     * Draw a dimension line between world-space start/end.
     * Label shows code + formatted length (from pixel distance / pixelsPerInch).
     */
    function drawMeasurement(ctx, view, {
        label,
        start,
        end,
        pixelsPerInch,
        color = '#444',
        capLength = 8,
        showValue = true,
    }) {
        if (!pixelsPerInch) {
            return;
        }

        const vs = view.getViewState();
        const [x0, y0] = start;
        const [x1, y1] = end;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const length = Math.hypot(dx, dy);
        if (length < 1) {
            return;
        }

        const inches = SizeDiffUnits.worldToInches(length, pixelsPerInch);
        const valueText = SizeDiffUnits.formatInches(inches);
        const text = label
            ? (showValue ? `${label}: ${valueText}` : label)
            : valueText;

        const cap = capLength / vs.scale;
        const nx = (-dy / length) * cap;
        const ny = (dx / length) * cap;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / vs.scale;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x0 - nx, y0 - ny);
        ctx.lineTo(x0 + nx, y0 + ny);
        ctx.moveTo(x1 - nx, y1 - ny);
        ctx.lineTo(x1 + nx, y1 + ny);
        ctx.stroke();

        const midDisplay = view.worldToDisplay((x0 + x1) / 2, (y0 + y1) / 2);
        if (!midDisplay) {
            return;
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const padding = 4;
        const metrics = ctx.measureText(text);
        const boxW = metrics.width + padding * 2;
        const boxH = 16;
        const boxX = midDisplay.x - boxW / 2;
        const boxY = midDisplay.y - boxH - 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.fillStyle = color;
        ctx.fillText(text, midDisplay.x, midDisplay.y - 4);
        ctx.restore();
    }

    /** Text annotation at a world-space point (for ratios, notes, etc.). */
    function drawAnnotation(ctx, view, { label, x, y, color = '#444' }) {
        const display = view.worldToDisplay(x, y);
        if (!display) {
            return;
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const padding = 4;
        const metrics = ctx.measureText(label);
        const boxW = metrics.width + padding * 2;
        const boxH = 16;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(display.x, display.y, boxW, boxH);
        ctx.fillStyle = color;
        ctx.fillText(label, display.x + padding, display.y + 2);
        ctx.restore();
    }

    function drawLayerDebugHud(ctx, view, mouseDisplay, placements) {
        if (!mouseDisplay) {
            return;
        }

        const world = view.displayToWorld(mouseDisplay.x, mouseDisplay.y);
        if (!world) {
            return;
        }

        const lines = placements
            .filter((placement) => placement.visible !== false)
            .map((placement) => {
                const local = layerLocalCoords(world.x, world.y, placement);
                const label = placement.label ?? placement.layerKey ?? 'Layer';
                return `${label}: x=${local.x} y=${local.y}`;
            });

        const padding = 10;
        const lineHeight = 18;
        const boxWidth = 260;
        const boxHeight = padding * 2 + lines.length * lineHeight;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(8, 8, boxWidth, boxHeight);
        ctx.fillStyle = '#8f8';
        ctx.font = '14px monospace';
        ctx.textBaseline = 'top';
        lines.forEach((line, index) => {
            ctx.fillText(line, 16, 12 + index * lineHeight);
        });
    }

    function attachLayerDebugHud(canvas, { view, getPlacements, enabled }) {
        let mouseDisplay = null;

        function redraw() {
            if (typeof enabled === 'function' ? !enabled() : !enabled) {
                return;
            }
            mouseDisplay = null;
        }

        canvas.addEventListener('mousemove', (event) => {
            if (typeof enabled === 'function' ? !enabled() : !enabled) {
                return;
            }
            const rect = canvas.getBoundingClientRect();
            mouseDisplay = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            };
            canvas.dispatchEvent(new CustomEvent('compositor-redraw'));
        });

        canvas.addEventListener('mouseleave', () => {
            mouseDisplay = null;
            canvas.dispatchEvent(new CustomEvent('compositor-redraw'));
        });

        return {
            draw(ctx) {
                if (typeof enabled === 'function' ? !enabled() : !enabled) {
                    return;
                }
                drawLayerDebugHud(ctx, view, mouseDisplay, getPlacements());
            },
            clear: redraw,
        };
    }

    function loadImages(sources, { onError, onProgress } = {}) {
        const jobs = [];
        for (const [key, source] of Object.entries(sources)) {
            jobs.push({ key, source, url: typeof source === 'string' ? source : source.url });
            if (source.mask?.url) {
                jobs.push({
                    key: `${key}_mask`,
                    source: source.mask,
                    url: source.mask.url,
                });
            }
        }

        const images = {};
        let loaded = 0;

        return new Promise((resolve) => {
            if (jobs.length === 0) {
                resolve(images);
                return;
            }

            for (const job of jobs) {
                const img = new Image();

                img.onload = () => {
                    images[job.key] = img;
                    loaded++;
                    onProgress?.(loaded, jobs.length);
                    if (loaded === jobs.length) {
                        resolve(images);
                    }
                };

                img.onerror = () => {
                    onError?.(job.key, job.source);
                    loaded++;
                    onProgress?.(loaded, jobs.length);
                    if (loaded === jobs.length) {
                        resolve(images);
                    }
                };

                img.src = job.url;
            }
        });
    }

    return {
        jointLocalPosition,
        jointWorldPosition,
        placementFromJoint,
        layerLocalCoords,
        placementLocalToWorld,
        computePlacementBounds,
        drawLayer,
        drawMeasurement,
        drawAnnotation,
        createSceneScale,
        maskPathFor,
        createCanvasView,
        attachLayerDebugHud,
        loadImages,
    };
})();

if (typeof window !== 'undefined') {
    window.SizeDiffCompositor = SizeDiffCompositor;
}
