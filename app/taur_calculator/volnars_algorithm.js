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

    function validateForm(form) {
        const formData = new FormData(form);
        for (const field of REQUIRED_FIELDS) {
            if (!formData.get(field)) {
                return field;
            }
        }
        return null;
    }

    function calculateFromForm(form) {
        const missing = validateForm(form);
        if (missing) {
            throw new Error(`Please fill in all required fields. Missing: ${missing}`);
        }

        const inputs = parseFormInputs(form);
        for (const key of ['anthroHeight', 'speciesHeight', 'speciesLength', 'speciesTailLength', 'taurFullHeight', 'speciesWeight']) {
            if (inputs[key] == null || Number.isNaN(inputs[key])) {
                throw new Error(`Invalid number for ${key}`);
            }
        }

        return { raw: calculate(inputs) };
    }

    return { calculate, calculateFromForm, validateForm, requiredFieldNames: () => [...REQUIRED_FIELDS] };
})();

if (typeof window !== 'undefined') {
    window.VolnarsAlgorithm = VolnarsAlgorithm;
}
