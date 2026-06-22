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

    return { calculate, calculateFromForm, validateForm };
})();

const ManualAlgorithm = (() => {
    const DIMENSION_FIELDS = [
        ['manual_tfh', 'TFH'],
        ['manual_th', 'TH'],
        ['manual_the', 'THe'],
        ['manual_tto', 'TTo'],
        ['manual_tl', 'TL'],
        ['manual_tt', 'TT'],
    ];

    function calculate(values) {
        return { ...values };
    }

    function parseFormInputs(form) {
        const values = {};
        for (const [field, key] of DIMENSION_FIELDS) {
            values[key] = SizeDiffUnits.parseFormLengthInput(form, field);
        }
        return values;
    }

    function validateForm(form) {
        const formData = new FormData(form);
        for (const [field] of DIMENSION_FIELDS) {
            if (!formData.get(field)) {
                return field;
            }
        }
        return null;
    }

    function calculateFromForm(form) {
        const missing = validateForm(form);
        if (missing) {
            throw new Error(`Please fill in all manual dimensions. Missing: ${missing}`);
        }

        const values = parseFormInputs(form);
        for (const [, key] of DIMENSION_FIELDS) {
            if (values[key] == null || Number.isNaN(values[key])) {
                throw new Error(`Invalid number for ${key}`);
            }
        }

        return { raw: calculate(values) };
    }

    function fillFromResult(result) {
        const mapping = {
            manual_tfh: result.TFH,
            manual_th: result.TH,
            manual_the: result.THe,
            manual_tto: result.TTo,
            manual_tl: result.TL,
            manual_tt: result.TT,
        };
        for (const [fieldId, value] of Object.entries(mapping)) {
            const input = document.getElementById(fieldId);
            if (input && value != null && !Number.isNaN(value)) {
                input.value = SizeDiffUnits.formatInches(value);
            }
        }
    }

    return { calculate, calculateFromForm, validateForm, fillFromResult };
})();

const TaurAlgorithms = (() => {
    const IMPLEMENTATIONS = { volnar: VolnarsAlgorithm, manual: ManualAlgorithm };

    const FORM_FIELDS = {
        shared: [
            'name', 'algorithm', 'taur_body_color', 'show_measurements',
            'show_rider', 'rider_height', 'taur_rider_color',
        ],
        volnar: [
            'measurement_type', 'species', 'anthro_height', 'species_height',
            'species_length', 'species_tail_length', 'taur_full_height',
            'species_weight', 'taur_length',
        ],
        manual: [
            'manual_tfh', 'manual_th', 'manual_the', 'manual_tto', 'manual_tl', 'manual_tt',
        ],
    };

    function fieldValue(form, name) {
        const el = form.elements?.[name] ?? form.querySelector(`[name="${name}"]`);
        return el?.value;
    }

    function currentId(form) {
        return fieldValue(form, 'algorithm') || 'volnar';
    }

    function get(id) {
        return IMPLEMENTATIONS[id] ?? null;
    }

    function shareFieldNames(algorithmId) {
        const mode = algorithmId === 'manual' ? 'manual' : 'volnar';
        return [...FORM_FIELDS.shared, ...FORM_FIELDS[mode]];
    }

    function calculateFromForm(form) {
        const impl = get(currentId(form));
        if (!impl) {
            throw new Error(`Unknown algorithm: ${currentId(form)}`);
        }
        return impl.calculateFromForm(form);
    }

    function validateForm(form) {
        const impl = get(currentId(form));
        if (!impl) {
            return 'algorithm';
        }
        return impl.validateForm(form);
    }

    function formatResults(result, algorithmId = 'volnar', form = null) {
        const fmt = SizeDiffUnits.formatInches;
        const ratio = SizeDiffUnits.formatRatio;

        const formatted = {
            TFH: `${fmt(result.TFH)} (Taur Full Height)`,
            THe: `${fmt(result.THe)} (Taur Head Length)`,
            TTo: `${fmt(result.TTo)} (Taur Torso Length)`,
            TL: `${fmt(result.TL)} (Taur Length)`,
            TT: `${fmt(result.TT)} (Taur Tail Length)`,
            TH: `${fmt(result.TH)} (Taur Height)`,
        };

        if (form?.elements?.show_rider?.checked) {
            const riderHeight = SizeDiffUnits.parseFormLengthInput(form, 'rider_height');
            if (riderHeight != null) {
                formatted.RH = `${fmt(riderHeight)} (Rider Height)`;
            }
        }

        if (algorithmId === 'volnar') {
            formatted.AR = `${ratio(result.AR)} (Anthropic Ratio)`;
            formatted.TW = `${result.TW.toFixed(2)} lbs (Taur Weight)`;
        }

        return formatted;
    }

    return {
        calculateFromForm,
        validateForm,
        formatResults,
        currentId,
        get,
        shareFieldNames,
        FORM_FIELDS,
    };
})();

if (typeof window !== 'undefined') {
    window.VolnarsAlgorithm = VolnarsAlgorithm;
    window.ManualAlgorithm = ManualAlgorithm;
    window.TaurAlgorithms = TaurAlgorithms;
}
