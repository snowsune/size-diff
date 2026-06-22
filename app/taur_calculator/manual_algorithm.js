/**
 * For manual dimension entry
 */
const ManualAlgorithm = (() => {
    const DIMENSION_FIELDS = [
        ['manual_upper_body_height', 'TFH'],
        ['manual_lower_body_height', 'TH'],
        ['manual_tail_length', 'TT'],
    ];

    const RIDER_FIELD = ['rider_height', 'RH'];

    // If show rider is checked, include the rider height field
    function activeFields(form) {
        return form?.elements?.show_rider?.checked
            ? [...DIMENSION_FIELDS, RIDER_FIELD]
            : DIMENSION_FIELDS;
    }

    function calculate(values) {
        const result = {
            TFH: values.TFH,
            TH: values.TH,
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
            if (input && result[key] != null && !Number.isNaN(result[key])) {
                input.value = SizeDiffUnits.formatInches(result[key]);
            }
        }
    }

    return {
        ...core,
        fillFromResult,
    };
})();

if (typeof window !== 'undefined') {
    window.ManualAlgorithm = ManualAlgorithm;
}
