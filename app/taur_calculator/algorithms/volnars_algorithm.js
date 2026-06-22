/**
 * Volnar's algorithm!! Implemented in JS
 */
const VolnarsAlgorithm = (() => {
    const REQUIRED_FIELDS = [
        'anthro_height',
        'species_height',
        'species_length',
        'species_tail_length',
        'taur_full_height',
        'species_weight',
    ];

    const PARSED_KEYS = [
        'anthroHeight', 'speciesHeight', 'speciesLength',
        'speciesTailLength', 'taurFullHeight', 'speciesWeight',
    ];

    function calculate({
        anthroHeight,
        speciesHeight,
        speciesLength,
        speciesTailLength,
        taurFullHeight,
        speciesWeight,
        taurLength = null,
        measurementType = 'vitruvian',
        customBodyParts = null,
    }) {
        const anthroLegs = anthroHeight * 4 / 8;
        const anthroTorso = anthroHeight * 3 / 8;
        const anthroHead = anthroHeight * 1 / 8;

        let taurHeight;
        let taurLengthCalc;

        if (measurementType === 'limb') {
            taurHeight = anthroLegs;
            taurLengthCalc = taurLength ?? speciesLength;
        } else {
            taurLengthCalc = (2 * anthroTorso) - anthroHead;
            taurHeight = anthroHeight > 0
                ? speciesHeight * (taurFullHeight / anthroHeight)
                : 0;
        }

        const taurRatio = speciesHeight > 0 ? taurHeight / speciesHeight : 0;
        const anthroRatio = anthroHeight > 0 ? taurFullHeight / anthroHeight : 0;

        const cbpResult = {};
        if (customBodyParts) {
            for (const [part, value] of Object.entries(customBodyParts)) {
                cbpResult[part] = value * anthroRatio;
            }
        }

        const taurTorso = anthroTorso * anthroRatio;
        const taurHead = anthroHead * anthroRatio;
        const taurTail = speciesTailLength != null ? speciesTailLength * taurRatio : 0;
        const taurWeight = speciesWeight * (anthroRatio ** 3);

        return {
            TH: taurHeight,
            TFH: taurFullHeight,
            TL: taurLengthCalc,
            TT: taurTail,
            TTo: taurTorso,
            THe: taurHead,
            TW: taurWeight,
            'TW-': taurWeight * 0.9,
            'TW+': taurWeight * 1.1,
            CBP: cbpResult,
            AR: anthroRatio,
            TR: taurRatio,
        };
    }

    function parseFormInputs(form) {
        const formData = new FormData(form);
        const length = (name) => SizeDiffUnits.parseFormLengthInput(form, name);
        const taurLengthRaw = formData.get('taur_length');
        return {
            measurementType: formData.get('measurement_type') || 'vitruvian',
            anthroHeight: length('anthro_height'),
            speciesHeight: length('species_height'),
            speciesLength: length('species_length'),
            speciesTailLength: length('species_tail_length'),
            taurFullHeight: length('taur_full_height'),
            speciesWeight: parseFloat(formData.get('species_weight')),
            taurLength: taurLengthRaw ? length('taur_length') : null,
        };
    }

    return TaurAlgorithmForm.createFormAlgorithm({
        requiredFieldNames: REQUIRED_FIELDS,
        parseFormInputs,
        calculate,
        parsedKeys: PARSED_KEYS,
    });
})();

if (typeof window !== 'undefined') {
    window.VolnarsAlgorithm = VolnarsAlgorithm;
}
