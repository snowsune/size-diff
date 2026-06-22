function initTaurForm(config = {}) {
    const form = document.getElementById('taur-form');
    const resultsEl = document.getElementById('taur-results');
    const resultsBody = document.getElementById('taur-results-body');
    const algorithmSelect = document.getElementById('algorithm');
    const volnarPanel = document.getElementById('volnar-inputs');
    const manualPanel = document.getElementById('manual-inputs');
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

    function renderResults(formatted) {
        resultsBody.innerHTML = '';
        for (const [key, value] of Object.entries(formatted)) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${key}</td><td>${value}</td>`;
            resultsBody.appendChild(row);
        }
        resultsEl.hidden = false;
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

    function shareLink() {
        const url = buildShareUrl();
        window.history.replaceState(null, '', url.replace(window.location.origin, ''));
        shareUrlInput.value = url;
        shareEl.hidden = false;
        shareUrlInput.select();
    }

    function applyFormState() {
        const missing = TaurAlgorithms.validateForm(form);
        if (missing !== null) {
            resultsEl.hidden = true;
            window.taurLastResult = null;
            redrawCanvas();
            return;
        }

        try {
            const algorithmId = TaurAlgorithms.currentId(form);
            const { raw } = TaurAlgorithms.calculateFromForm(form);
            window.taurLastResult = raw;
            renderResults(TaurAlgorithms.formatResults(raw, algorithmId, form));
            redrawCanvas();
        } catch {
            resultsEl.hidden = true;
            window.taurLastResult = null;
            redrawCanvas();
        }
    }

    function scheduleApply() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFormState, 120);
    }

    function updateAlgorithmControls() {
        const isManual = algorithmSelect.value === 'manual';
        volnarPanel.hidden = isManual;
        manualPanel.hidden = !isManual;

        if (isManual && window.taurLastResult) {
            ManualAlgorithm.fillFromResult(window.taurLastResult);
        }
    }

    function updateRiderControls() {
        const showRider = document.getElementById('show_rider')?.checked;
        document.getElementById('rider-height-group').hidden = !showRider;
        document.getElementById('rider-color-group').hidden = !showRider;
        redrawCanvas();
    }

    function applySpeciesDefaults() {
        const data = speciesData[document.getElementById('species')?.value];
        if (!data) {
            return;
        }
        document.getElementById('species_height').value = data.species_height || '';
        document.getElementById('species_length').value = data.species_length || '';
        document.getElementById('species_tail_length').value = data.species_tail_length || '';
        document.getElementById('species_weight').value = data.species_weight || '';
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
        scheduleApply();
    });

    form.addEventListener('change', (event) => {
        const { name } = event.target;
        if (name === 'show_measurements') {
            redrawCanvas();
            return;
        }
        if (name === 'show_rider') {
            scheduleApply();
            return;
        }
        scheduleApply();
    });

    algorithmSelect.addEventListener('change', () => {
        updateAlgorithmControls();
        scheduleApply();
    });

    document.getElementById('species')?.addEventListener('change', () => {
        applySpeciesDefaults();
        scheduleApply();
    });

    document.getElementById('show_rider')?.addEventListener('change', updateRiderControls);

    shareBtn?.addEventListener('click', shareLink);
    shareCopyBtn?.addEventListener('click', async () => {
        shareLink();
        try {
            await navigator.clipboard.writeText(shareUrlInput.value);
            shareCopyBtn.textContent = 'Copied!';
            setTimeout(() => { shareCopyBtn.textContent = 'Copy'; }, 1500);
        } catch {
            shareUrlInput.select();
        }
    });

    const fromUrl = populateFromUrl();
    updateAlgorithmControls();
    updateRiderControls();

    if (!fromUrl) {
        applySpeciesDefaults();
    }

    applyFormState();
}

if (document.getElementById('taur-form')) {
    initTaurForm(window.taurFormConfig ?? {});
}
