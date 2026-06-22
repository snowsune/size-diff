/**
 * Snow's algorithm <3
 */
const SnowsAlgorithm = (() => {
    const REQUIRED_FIELDS = [
        'anthro_height',
        'species_height',
        'species_length',
        'species_tail_length',
    ];

    /**
     * Species avg size (hind legs): SL*0.9 + SH
     * TFH (2-thirds rule): AH*0.27*2 + AH*0.53
     * Human torso on animal body: AH*0.53 + SH
     */
    function calculate({
        anthroHeight,
        speciesHeight,
        speciesLength,
        speciesTailLength,
    }) {
        const AH = anthroHeight;
        const SH = speciesHeight;

        const speciesAvgSize = speciesLength * 0.9 + SH;
        const TFH = AH * 0.27 * 2 + AH * 0.53;
        const humanTorsoOnAnimal = AH * 0.53 + SH;

        const TH = speciesAvgSize;
        const THe = AH / 8;
        const TTo = AH * 0.53 - THe;

        const anthroRatio = AH > 0 ? TFH / AH : 0;
        const taurRatio = SH > 0 ? TH / SH : 0;

        const TL = speciesLength * anthroRatio;
        const TT = speciesTailLength * taurRatio;

        return {
            TH,
            TFH,
            TL,
            TT,
            TTo,
            THe,
            AR: anthroRatio,
            TR: taurRatio,
            SAS: speciesAvgSize,
            HTA: humanTorsoOnAnimal,
        };
    }

    function parseFormInputs(form) {
        const length = (name) => SizeDiffUnits.parseFormLengthInput(form, name);
        return {
            anthroHeight: length('anthro_height'),
            speciesHeight: length('species_height'),
            speciesLength: length('species_length'),
            speciesTailLength: length('species_tail_length'),
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
        for (const key of ['anthroHeight', 'speciesHeight', 'speciesLength', 'speciesTailLength']) {
            if (inputs[key] == null || Number.isNaN(inputs[key])) {
                throw new Error(`Invalid number for ${key}`);
            }
        }

        return { raw: calculate(inputs) };
    }

    return { calculate, calculateFromForm, validateForm, requiredFieldNames: () => [...REQUIRED_FIELDS] };
})();

if (typeof window !== 'undefined') {
    window.SnowsAlgorithm = SnowsAlgorithm;
}
