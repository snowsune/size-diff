/**
 * For manual dimension entry
 */
const ManualAlgorithm = (() => {
    const DIMENSION_FIELDS = [
        ['manual_lower_body_height', 'TH'],
        ['manual_taur_full_height', 'TFH'],
        ['manual_tail_length', 'TT'],
    ];

    const RIDER_FIELD = ['rider_height', 'RH'];

    /** Default inches when entering manual mode for the first time. */
    const DEFAULT_FIELD_INCHES = {
        manual_lower_body_height: 54,
        manual_taur_full_height: 128,
        manual_tail_length: 84,
        rider_height: 72,
    };

    function activeFields(form) {
        return form?.elements?.show_rider?.checked
            ? [...DIMENSION_FIELDS, RIDER_FIELD]
            : DIMENSION_FIELDS;
    }

    function calculate(values) {
        const TFH = values.TFH;
        const TH = values.TH;
        if (TFH < TH) {
            throw new Error('Taur full height must be at least the lower body height.');
        }

        const result = {
            TFH,
            TH,
            UBH: TFH - TH,
            TT: values.TT,
        };
        if (values.RH != null) {
            result.RH = values.RH;
        }
        return result;
    }

    function parseFormInputs(form) {
        const values = {};
        for (const [field, key] of activeFields(form)) {
            values[key] = SizeDiffUnits.parseFormLengthInput(form, field);
        }
        return values;
    }

    const core = TaurAlgorithmForm.createFormAlgorithm({
        requiredFieldNames: (form) => activeFields(form).map(([field]) => field),
        parseFormInputs,
        calculate,
        missingMessage: 'Please fill in all manual dimensions.',
    });

    function fillFromResult(result) {
        const mapping = Object.fromEntries([...DIMENSION_FIELDS, RIDER_FIELD]);
        for (const [fieldId, key] of Object.entries(mapping)) {
            const input = document.getElementById(fieldId);
            if (!input) {
                continue;
            }

            const value = result[key];
            if (value != null && !Number.isNaN(value)) {
                input.value = SizeDiffUnits.formatInches(value);
            }
        }
    }

    function applyDefaults() {
        for (const [fieldId, inches] of Object.entries(DEFAULT_FIELD_INCHES)) {
            const input = document.getElementById(fieldId);
            if (input) {
                input.value = SizeDiffUnits.formatInches(inches);
            }
        }
    }

    function dimensionFieldsEmpty() {
        return DIMENSION_FIELDS.every(([fieldId]) => {
            const input = document.getElementById(fieldId);
            return !String(input?.value ?? '').trim();
        });
    }

    return {
        ...core,
        fillFromResult,
        applyDefaults,
        dimensionFieldsEmpty,
    };
})();

if (typeof window !== 'undefined') {
    window.ManualAlgorithm = ManualAlgorithm;
}
