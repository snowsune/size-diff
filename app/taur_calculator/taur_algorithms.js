/**
 * Taur calculator algorithm registry and shared form helpers.
 */
const TaurAlgorithms = (() => {
    const IMPLEMENTATIONS = { volnar: VolnarsAlgorithm, snow: SnowsAlgorithm, manual: ManualAlgorithm };

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
        snow: [
            'species', 'anthro_height', 'species_height',
            'species_length', 'species_tail_length',
        ],
        manual: [
            'manual_tfh', 'manual_th', 'manual_the', 'manual_tto', 'manual_tl', 'manual_tt',
        ],
    };

    function algorithmMode(algorithmId) {
        if (algorithmId === 'manual') {
            return 'manual';
        }
        if (algorithmId === 'snow') {
            return 'snow';
        }
        return 'volnar';
    }

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
        const mode = algorithmMode(algorithmId);
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

    function requiredFieldNames(form) {
        const impl = get(currentId(form));
        return impl?.requiredFieldNames?.() ?? [];
    }

    function panelMatchesAlgorithm(panel, algorithmId) {
        return panel.dataset.algorithmPanel.split(/\s+/).includes(algorithmId);
    }

    function missingRequiredFields(form) {
        const algorithmId = currentId(form);
        return requiredFieldNames(form).filter((name) => {
            const el = form.elements?.[name] ?? form.querySelector(`[name="${name}"]`);
            if (!el) {
                return false;
            }
            const panel = el.closest('[data-algorithm-panel]');
            if (panel && !panelMatchesAlgorithm(panel, algorithmId)) {
                return false;
            }
            if (panel?.classList.contains('taur-panel-hidden')) {
                return false;
            }
            return !String(el.value ?? '').trim();
        });
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

        if (algorithmId === 'snow') {
            formatted.SAS = `${fmt(result.SAS)} (Species Avg Size)`;
            formatted.HTA = `${fmt(result.HTA)} (Human Torso on Animal)`;
            formatted.AR = `${ratio(result.AR)} (Anthropic Ratio)`;
            formatted.TR = `${ratio(result.TR)} (Taur Ratio)`;
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
        requiredFieldNames,
        missingRequiredFields,
        FORM_FIELDS,
    };
})();

if (typeof window !== 'undefined') {
    window.TaurAlgorithms = TaurAlgorithms;
}
