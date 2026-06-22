/**
 * Manual dimension entry (just for vixi testing mostly)
 */
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

    return {
        calculate,
        calculateFromForm,
        validateForm,
        fillFromResult,
        requiredFieldNames: () => DIMENSION_FIELDS.map(([field]) => field),
    };
})();

if (typeof window !== 'undefined') {
    window.ManualAlgorithm = ManualAlgorithm;
}
