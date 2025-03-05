function toggleSetting(setting) {
    let params = new URLSearchParams(window.location.search);

    // Toggle the setting
    if (params.get(setting) === "true") {
        params.set(setting, "false");
    } else {
        params.set(setting, "true");
    }

    // Redirect with updated query parameters
    window.location.href = "?" + params.toString();
}

document.getElementById('measure_ears').addEventListener('change', function () {
    let nameField = document.querySelector('input[name="name"]').value.trim();
    if (nameField.length > 0) {
        this.form.submit(); // Wait for form submission
    } else {
        toggleSetting('measure_ears'); // Apply change immediately
    }
});

document.getElementById('scale_height').addEventListener('change', function () {
    let nameField = document.querySelector('input[name="name"]').value.trim();
    if (nameField.length > 0) {
        this.form.submit(); // Wait for form submission
    } else {
        toggleSetting('scale_height'); // Apply change immediately
    }
});