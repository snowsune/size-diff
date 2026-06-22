/**
 * Measurement anchors and scaled layer placement.
 */
const TaurMeasurements = (() => {
    const ORDER = ['TFH', 'THe', 'TTo', 'TL', 'TT'];

    function scaleValue(layerDef, result) {
        return result?.[layerDef.scale_from];
    }

    function scaleForLayer(layerDef, result) {
        if (!layerDef?.scale_from || !layerDef.reference_inches) {
            return 1;
        }
        const value = scaleValue(layerDef, result);
        if (value == null || Number.isNaN(value)) {
            return 1;
        }
        return value / layerDef.reference_inches;
    }

    /**
     * Scale around scale_center (or scale_pivot), then pin anchorJoint to world coords.
     * Falls back to the anchor joint when no explicit pivot is defined.
     */
    function placeScaledLayer({
        layerKey,
        layerDef,
        image,
        anchorJoint,
        worldX,
        worldY,
        result,
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
                        scale: scaleForLayer(layerDef, result),
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

    function resolveLayerPoint(placements, layerKey, localX, localY, placementLocalToWorld) {
        const placement = placements.find((p) => p.layerKey === layerKey);
        if (!placement) {
            return null;
        }
        return placementLocalToWorld(placement, localX, localY);
    }

    function resolveEndpoint(spec, placements, groundY, startPoint, placementLocalToWorld) {
        if (spec.floor) {
            const x = spec.alignX === 'start' ? startPoint[0] : spec.x;
            return [x, groundY];
        }

        const [layerKey, localX, localY] = spec;
        return resolveLayerPoint(placements, layerKey, localX, localY, placementLocalToWorld);
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

    return { buildScene, scaleForLayer, placeScaledLayer };
})();

if (typeof window !== 'undefined') {
    window.TaurMeasurements = TaurMeasurements;
}
