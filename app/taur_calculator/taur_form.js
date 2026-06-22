function initTaurForm(config = {}) {
    const form = document.getElementById('taur-form');
    const algorithmSelect = document.getElementById('algorithm');
    const algorithmPanels = form.querySelectorAll('[data-algorithm-panel]');
    const shareEl = document.getElementById('taur-share');
    const shareUrlInput = document.getElementById('taur-share-url');
    const shareBtn = document.getElementById('taur-share-btn');
    const shareCopyBtn = document.getElementById('taur-share-copy');
    const speciesData = config.speciesData ?? {};

    let debounceTimer = null;

    function redrawCanvas() {
        document.getElementById('taur-canvas')?.dispatchEvent(
            new CustomEvent('compositor-redraw')
        );
    }

    function updateResultsOverlay(formatted) {
        const name = document.getElementById('name')?.value?.trim() || '';
        window.taurResultsOverlay = {
            name,
            rows: Object.entries(formatted),
        };
    }

    function clearResultsOverlay() {
        window.taurResultsOverlay = {
            name: document.getElementById('name')?.value?.trim() || '',
            rows: [],
        };
    }

    function buildShareUrl() {
        const params = new URLSearchParams();
        const allowed = new Set(TaurAlgorithms.shareFieldNames(TaurAlgorithms.currentId(form)));
        const formData = new FormData(form);

        for (const [key, value] of formData.entries()) {
            if (allowed.has(key) && value) {
                params.append(key, value);
            }
        }

        const query = params.toString();
        return query
            ? `${window.location.origin}/taur?${query}`
            : `${window.location.origin}/taur`;
    }

    async function uploadSharePreview(queryString) {
        // For uploading share previews!
        if (!window.taurLastResult || !window.taurExportSharePng || !queryString) {
            return false;
        }

        const blob = await window.taurExportSharePng();
        const body = new FormData();
        body.append('query', queryString);
        body.append('image', blob, 'preview.png');

        const response = await fetch('/api/shares/taur', {
            method: 'POST',
            body,
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Preview upload failed');
        }

        return true;
    }

    async function shareLink() {
        const url = buildShareUrl();
        const queryString = new URL(url).search.slice(1);

        shareBtn.disabled = true;
        const previousLabel = shareBtn.textContent;
        shareBtn.textContent = 'Sharing…';

        try {
            if (queryString) {
                await uploadSharePreview(queryString);
            }
        } catch (err) {
            console.warn('Share preview upload failed:', err);
        } finally {
            shareBtn.disabled = false;
            shareBtn.textContent = previousLabel;
        }

        window.history.replaceState(null, '', url.replace(window.location.origin, ''));
        shareUrlInput.value = url;
        shareEl.hidden = false;
        shareUrlInput.select();
    }

    function updateRequiredFieldHighlights() {
        const missing = new Set(TaurAlgorithms.missingRequiredFields(form));

        form.querySelectorAll(
            '#calculated-inputs input, #calculated-inputs select, #manual-inputs input, #rider-height-group input'
        ).forEach((input) => {
            input.classList.remove('taur-field-missing');
        });

        for (const name of TaurAlgorithms.requiredFieldNames(form)) {
            const input = document.getElementById(name) || form.querySelector(`[name="${name}"]`);
            if (!input) {
                continue;
            }
            const panel = input.closest('[data-algorithm-panel]');
            if (panel?.classList.contains('taur-panel-hidden')) {
                continue;
            }
            input.classList.toggle('taur-field-missing', missing.has(name));
        }
    }

    function applyFormState() {
        const missing = TaurAlgorithms.validateForm(form);
        if (missing !== null) {
            clearResultsOverlay();
            window.taurLastResult = null;
            updateMeasurementControls();
            updateRequiredFieldHighlights();
            redrawCanvas();
            return;
        }

        try {
            const algorithmId = TaurAlgorithms.currentId(form);
            const { raw } = TaurAlgorithms.calculateFromForm(form);
            window.taurLastResult = raw;
            updateResultsOverlay(TaurAlgorithms.formatResults(raw, algorithmId, form));
            updateMeasurementControls();
            updateRequiredFieldHighlights();
            redrawCanvas();
        } catch {
            clearResultsOverlay();
            window.taurLastResult = null;
            updateMeasurementControls();
            updateRequiredFieldHighlights();
            redrawCanvas();
        }
    }

    function scheduleApply() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFormState, 120);
    }

    function updateAlgorithmControls() {
        const algo = algorithmSelect.value;

        algorithmPanels.forEach((panel) => {
            panel.classList.toggle(
                'taur-panel-hidden',
                !TaurAlgorithms.panelMatchesAlgorithm(panel, algo)
            );
        });

        if (algo === 'manual' && window.taurLastResult) {
            ManualAlgorithm.fillFromResult(window.taurLastResult);
        }

        updateRequiredFieldHighlights();
    }

    function updateMeasurementControls() {
        const checkbox = document.getElementById('show_measurements');
        const label = document.getElementById('show_measurements-label');
        const hasDimensions = window.taurLastResult != null;

        if (!checkbox) {
            return;
        }

        checkbox.disabled = !hasDimensions;
        label?.classList.toggle('taur-toggle-disabled', !hasDimensions);
        label?.setAttribute(
            'title',
            hasDimensions ? '' : 'Fill in dimensions to show measurement lines'
        );

        if (!hasDimensions && checkbox.checked) {
            checkbox.checked = false;
        }
    }

    function updateRiderControls() {
        const showRider = document.getElementById('show_rider')?.checked;
        document.getElementById('rider-height-group').hidden = !showRider;
        document.getElementById('rider-color-group').hidden = !showRider;
        redrawCanvas();
    }

    const SPECIES_LENGTH_FIELDS = [
        ['species_height', 'species_height'],
        ['species_length', 'species_length'],
        ['species_tail_length', 'species_tail_length'],
    ];

    function isGenericSpecies(speciesValue) {
        return !speciesValue || speciesValue === 'generic';
    }

    function setSpeciesFieldLocked(input, locked) {
        if (!input) {
            return;
        }
        input.readOnly = locked;
        input.classList.toggle('taur-field-locked', locked);
    }

    function updateSpeciesControls() {
        const speciesValue = document.getElementById('species')?.value ?? 'generic';
        const weightField = document.getElementById('species_weight');

        if (isGenericSpecies(speciesValue)) {
            for (const [fieldId] of SPECIES_LENGTH_FIELDS) {
                setSpeciesFieldLocked(document.getElementById(fieldId), false);
            }
            setSpeciesFieldLocked(weightField, false);
            return;
        }

        const data = speciesData[speciesValue];
        if (!data) {
            return;
        }

        for (const [fieldId, dataKey] of SPECIES_LENGTH_FIELDS) {
            const input = document.getElementById(fieldId);
            if (!input) {
                continue;
            }
            const inches = data[dataKey];
            input.value = inches ? SizeDiffUnits.formatInches(inches) : '';
            setSpeciesFieldLocked(input, true);
        }

        if (weightField) {
            weightField.value = data.species_weight || '';
            setSpeciesFieldLocked(weightField, Boolean(data.species_weight));
        }
    }

    function populateFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        if ([...urlParams.keys()].length === 0) {
            return false;
        }

        for (const [key, value] of urlParams.entries()) {
            const input = document.getElementById(key) || form.querySelector(`[name="${key}"]`);
            if (!input) {
                continue;
            }
            if (input.type === 'checkbox') {
                input.checked = value === '1' || value === 'on' || value === 'true';
            } else {
                input.value = value;
            }
        }

        shareLink();
        return true;
    }

    form.addEventListener('submit', (event) => event.preventDefault());

    form.addEventListener('input', (event) => {
        if (event.target.name === 'show_measurements') {
            return;
        }
        if (event.target.name === 'taur_body_color') {
            redrawCanvas();
            return;
        }
        if (event.target.name === 'name') {
            clearResultsOverlay();
            if (window.taurLastResult) {
                const algorithmId = TaurAlgorithms.currentId(form);
                updateResultsOverlay(
                    TaurAlgorithms.formatResults(window.taurLastResult, algorithmId, form)
                );
            }
            redrawCanvas();
            return;
        }
        scheduleApply();
    });

    form.addEventListener('change', (event) => {
        const { name } = event.target;
        if (name === 'show_measurements') {
            if (!event.target.disabled) {
                redrawCanvas();
            }
            return;
        }
        if (name === 'show_rider') {
            updateRiderControls();
            scheduleApply();
            return;
        }
        if (name === 'algorithm') {
            updateAlgorithmControls();
            updateRiderControls();
            scheduleApply();
            return;
        }
        scheduleApply();
    });

    document.getElementById('species')?.addEventListener('change', () => {
        updateSpeciesControls();
        scheduleApply();
    });

    shareBtn?.addEventListener('click', () => {
        shareLink().catch((err) => console.warn('Share failed:', err));
    });
    shareCopyBtn?.addEventListener('click', async () => {
        try {
            await shareLink();
            await navigator.clipboard.writeText(shareUrlInput.value);
            shareCopyBtn.textContent = 'Copied!';
            setTimeout(() => { shareCopyBtn.textContent = 'Copy'; }, 1500);
        } catch {
            shareUrlInput.select();
        }
    });

    const fromUrl = populateFromUrl();
    clearResultsOverlay();
    updateAlgorithmControls();
    updateMeasurementControls();
    updateRiderControls();
    updateSpeciesControls();

    applyFormState();
}

if (document.getElementById('taur-form')) {
    initTaurForm(window.taurFormConfig ?? {});
}
