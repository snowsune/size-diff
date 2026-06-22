/**
 * Measurement anchors and scaled layer placement.
 */
const TaurMeasurements = (() => {
    const ORDER = ['TFH', 'THe', 'TTo', 'TL', 'TT'];

    function scaleValue(layerDef, result) {
        return result?.[layerDef.scale_from];
    }

    /**
     * Layer scale from a single scene-wide ruler (world pixels per inch).
     * Layers with span_pixels use: inches * ppi / span_pixels.
     * Layers with only reference_inches use: inches / reference_inches (bootstrap).
     */
    function scaleForLayer(layerDef, result, pixelsPerInch = null) {
        if (!layerDef?.scale_from) {
            return 1;
        }

        const value = scaleValue(layerDef, result);
        if (value == null || Number.isNaN(value)) {
            return 1;
        }

        if (pixelsPerInch != null && layerDef.span_pixels) {
            return (value * pixelsPerInch) / layerDef.span_pixels;
        }

        if (layerDef.reference_inches) {
            return value / layerDef.reference_inches;
        }

        return 1;
    }

    function resolveEndpoint(spec, placements, groundY, startPoint, placementLocalToWorld) {
        if (spec.floor) {
            const x = spec.alignX === 'start' ? startPoint[0] : spec.x;
            return [x, groundY];
        }

        const [layerKey, localX, localY] = spec;
        const placement = placements.find((p) => p.layerKey === layerKey);
        if (!placement) {
            return null;
        }
        return placementLocalToWorld(placement, localX, localY);
    }

    function measureDefinitionWorldDistance(def, placements, groundY, placementLocalToWorld) {
        if (!def) {
            return null;
        }

        let start = resolveEndpoint(def.start, placements, groundY, null, placementLocalToWorld);
        if (!start) {
            return null;
        }

        let end = resolveEndpoint(def.end, placements, groundY, start, placementLocalToWorld);
        if (!end) {
            return null;
        }

        if (def.offset) {
            start = [start[0] + def.offset[0], start[1] + def.offset[1]];
            end = [end[0] + def.offset[0], end[1] + def.offset[1]];
        }

        return SizeDiffUnits.worldDistance(start, end);
    }

    /** Read the live TFH line length and derive world pixels per inch. */
    function deriveScenePixelsPerInch({
        canvasConfig = {},
        measurementDefs = {},
        placements,
        groundY,
        result,
        placementLocalToWorld,
    }) {
        const tfhInches = result?.TFH;
        if (tfhInches) {
            const tfhDistance = measureDefinitionWorldDistance(
                measurementDefs.TFH,
                placements,
                groundY,
                placementLocalToWorld
            );
            if (tfhDistance) {
                return tfhDistance / tfhInches;
            }
        }

        const calibration = canvasConfig.calibration ?? {};
        if (calibration.pixels_per_inch) {
            return calibration.pixels_per_inch;
        }
        if (calibration.TFH?.span_pixels && calibration.TFH?.inches) {
            return calibration.TFH.span_pixels / calibration.TFH.inches;
        }

        return null;
    }

    /**
     * Scale around scale_center (or scale_pivot), then pin anchorJoint to world coords.
     */
    function placeScaledLayer({
        layerKey,
        layerDef,
        image,
        anchorJoint,
        worldX,
        worldY,
        result,
        pixelsPerInch = null,
        placementFromJoint,
        anchorJointOnPlacement,
        jointLocalPosition,
    }) {
        const anchorLocal = jointLocalPosition(layerDef, anchorJoint);
        const scaleCenter = layerDef.scale_center ?? layerDef.scale_pivot ?? anchorLocal;

        return anchorJointOnPlacement(
            {
                layerKey,
                visible: true,
                ...placementFromJoint(
                    layerDef,
                    image,
                    anchorJoint,
                    worldX,
                    worldY,
                    {
                        layerKey,
                        scale: scaleForLayer(layerDef, result, pixelsPerInch),
                        scaleCenter,
                    }
                ),
            },
            layerDef,
            anchorJoint,
            worldX,
            worldY
        );
    }

    function fromDef(key, def, placements, groundY, result, placementLocalToWorld) {
        const refKey = def.reference ?? key;
        const inches = result[refKey];
        if (inches == null) {
            return null;
        }

        let start = resolveEndpoint(def.start, placements, groundY, null, placementLocalToWorld);
        if (!start) {
            return null;
        }

        let end = resolveEndpoint(def.end, placements, groundY, start, placementLocalToWorld);
        if (!end) {
            return null;
        }

        if (def.offset) {
            start = [start[0] + def.offset[0], start[1] + def.offset[1]];
            end = [end[0] + def.offset[0], end[1] + def.offset[1]];
        }

        return { label: key, start, end, inches };
    }

    function buildScene({ measurementDefs, placements, groundY, result, placementLocalToWorld }) {
        if (!result) {
            return null;
        }

        const measurements = [];
        for (const key of ORDER) {
            const def = measurementDefs[key];
            if (!def) {
                continue;
            }
            const line = fromDef(key, def, placements, groundY, result, placementLocalToWorld);
            if (line) {
                measurements.push(line);
            }
        }

        return measurements.length ? { measurements } : null;
    }

    return {
        buildScene,
        scaleForLayer,
        placeScaledLayer,
        deriveScenePixelsPerInch,
        measureDefinitionWorldDistance,
    };
})();

if (typeof window !== 'undefined') {
    window.TaurMeasurements = TaurMeasurements;
}
