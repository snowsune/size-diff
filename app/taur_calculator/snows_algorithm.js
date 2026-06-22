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

    const PARSED_KEYS = [
        'anthroHeight', 'speciesHeight', 'speciesLength', 'speciesTailLength',
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

        const TH = speciesAvgSize; // Snows "average size"
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

    return TaurAlgorithmForm.createFormAlgorithm({
        requiredFieldNames: REQUIRED_FIELDS,
        parseFormInputs,
        calculate,
        parsedKeys: PARSED_KEYS,
    });
})();

if (typeof window !== 'undefined') {
    window.SnowsAlgorithm = SnowsAlgorithm;
}
