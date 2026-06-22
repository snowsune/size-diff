/**
 * Shared taur algorithm bits
 */
const TaurAlgorithmForm = (() => {
    function createFormAlgorithm({
        requiredFieldNames,
        parseFormInputs,
        calculate,
        parsedKeys = null,
        missingMessage = 'Please fill in all required fields.',
    }) {
        function fieldNames(form) {
            return typeof requiredFieldNames === 'function'
                ? requiredFieldNames(form)
                : requiredFieldNames;
        }

        function validateForm(form) {
            const formData = new FormData(form);
            for (const field of fieldNames(form)) {
                if (!formData.get(field)) {
                    return field;
                }
            }
            return null;
        }

        function calculateFromForm(form) {
            const missing = validateForm(form);
            if (missing) {
                throw new Error(`${missingMessage} Missing: ${missing}`);
            }

            const inputs = parseFormInputs(form);
            const keys = parsedKeys ?? Object.keys(inputs);
            for (const key of keys) {
                if (inputs[key] == null || Number.isNaN(inputs[key])) {
                    throw new Error(`Invalid number for ${key}`);
                }
            }

            return { raw: calculate(inputs, form) };
        }

        return {
            calculate,
            calculateFromForm,
            validateForm,
            requiredFieldNames: fieldNames,
        };
    }

    return { createFormAlgorithm };
})();

if (typeof window !== 'undefined') {
    window.TaurAlgorithmForm = TaurAlgorithmForm;
}
