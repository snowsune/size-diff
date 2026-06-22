/**
 * Resolve measurement anchors from taur_data.json onto the canvas.
 */
const TaurMeasurements = (() => {
    const ORDER = ['TFH', 'THe', 'TTo', 'TL', 'TT'];
    const CALIBRATION_ORDER = ['TFH', 'THe'];

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
        const referenceInches = result[refKey];
        if (referenceInches == null) {
            return null;
        }

        const startSpec = def.start;
        const endSpec = def.end;

        let start = resolveEndpoint(startSpec, placements, groundY, null, placementLocalToWorld);
        if (!start) {
            return null;
        }

        let end = resolveEndpoint(endSpec, placements, groundY, start, placementLocalToWorld);
        if (!end) {
            return null;
        }

        if (def.offset) {
            start = [start[0] + def.offset[0], start[1] + def.offset[1]];
            end = [end[0] + def.offset[0], end[1] + def.offset[1]];
        }

        return { key, label: key, start, end, referenceInches };
    }

    function buildScene({
        measurementDefs,
        placements,
        groundY,
        result,
        placementLocalToWorld,
        createSceneScale,
    }) {
        if (!result) {
            return null;
        }

        const enabled = [];
        for (const key of ORDER) {
            const def = measurementDefs[key];
            if (!def) {
                continue;
            }
            const measurement = fromDef(
                key, def, placements, groundY, result, placementLocalToWorld
            );
            if (measurement) {
                enabled.push(measurement);
            }
        }

        if (enabled.length === 0) {
            return null;
        }

        const calibrator = CALIBRATION_ORDER
            .map((key) => enabled.find((m) => m.key === key))
            .find(Boolean) ?? enabled[0];

        const worldDistance = SizeDiffUnits.worldDistance(calibrator.start, calibrator.end);
        const scale = createSceneScale.fromReference(
            calibrator.referenceInches,
            worldDistance
        );

        return {
            scale,
            measurements: enabled.map(({ label, start, end }) => ({ label, start, end })),
        };
    }

    return { buildScene };
})();

if (typeof window !== 'undefined') {
    window.TaurMeasurements = TaurMeasurements;
}
