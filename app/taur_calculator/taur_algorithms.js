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
            'manual_lower_body_height', 'manual_taur_full_height',
            'manual_tail_length',
        ],
    };

    /** Dimensions shown in manual-mode overlay; canvas uses TFH, TH, UBH, TT, RH. */
    const DISPLAY_KEYS = ['UBH', 'TFH', 'TH', 'TT', 'RH'];

    const DISPLAY_LABELS = {
        UBH: 'Upper Body Height',
        TFH: 'Taur Full Height',
        TH: 'Lower Body Height',
        TT: 'Tail Length',
        RH: 'Rider Height',
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

    function showRider(form) {
        return Boolean(form?.elements?.show_rider?.checked);
    }

    function upperBodyHeight(result) {
        if (result?.UBH != null) {
            return result.UBH;
        }
        if (result?.TFH != null && result?.TH != null) {
            return result.TFH - result.TH;
        }
        return null;
    }

    /** Attach derived dimensions used by the canvas and results overlay. */
    function finalizeResult(result, form) {
        let next = { ...result };

        if (next.TFH != null && next.TH != null) {
            next.UBH = next.UBH ?? upperBodyHeight(next);
        }

        if (!showRider(form)) {
            return next;
        }

        const riderHeight = next.RH ?? SizeDiffUnits.parseFormLengthInput(form, 'rider_height');
        if (riderHeight == null || Number.isNaN(riderHeight)) {
            return next;
        }

        return { ...next, RH: riderHeight };
    }

    function calculateFromForm(form) {
        const impl = get(currentId(form));
        if (!impl) {
            throw new Error(`Unknown algorithm: ${currentId(form)}`);
        }
        const { raw } = impl.calculateFromForm(form);
        return { raw: finalizeResult(raw, form) };
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
        return impl?.requiredFieldNames?.(form) ?? [];
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

    function formatDisplayDimensions(result) {
        const fmt = SizeDiffUnits.formatInches;
        const formatted = {};
        for (const key of DISPLAY_KEYS) {
            if (result[key] == null) {
                continue;
            }
            formatted[key] = `${fmt(result[key])} (${DISPLAY_LABELS[key]})`;
        }
        return formatted;
    }

    function formatResults(result, algorithmId = 'volnar', form = null) {
        const fmt = SizeDiffUnits.formatInches;
        const ratio = SizeDiffUnits.formatRatio;

        if (algorithmId === 'manual') {
            return formatDisplayDimensions(result);
        }

        const formatted = {
            TFH: `${fmt(result.TFH)} (Taur Full Height)`,
            THe: `${fmt(result.THe)} (Taur Head Length)`,
            TTo: `${fmt(result.TTo)} (Taur Torso Length)`,
            TL: `${fmt(result.TL)} (Taur Length)`,
            TT: `${fmt(result.TT)} (Taur Tail Length)`,
            TH: `${fmt(result.TH)} (Lower Body Height)`,
        };

        const ubh = upperBodyHeight(result);
        if (ubh != null) {
            formatted.UBH = `${fmt(ubh)} (Upper Body Height)`;
        }

        if (result.RH != null) {
            formatted.RH = `${fmt(result.RH)} (Rider Height)`;
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
        finalizeResult,
        currentId,
        get,
        shareFieldNames,
        requiredFieldNames,
        missingRequiredFields,
        panelMatchesAlgorithm,
        upperBodyHeight,
        DISPLAY_KEYS,
        DISPLAY_LABELS,
        FORM_FIELDS,
    };
})();

if (typeof window !== 'undefined') {
    window.TaurAlgorithms = TaurAlgorithms;
}
