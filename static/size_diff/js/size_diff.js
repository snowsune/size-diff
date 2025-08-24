// Size Difference Calculator JavaScript

document.addEventListener('DOMContentLoaded', function () {
    const calculateBtn = document.getElementById('calculate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultsContainer = document.getElementById('results');

    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculateSizeDifference);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetCalculator);
    }

    function calculateSizeDifference() {
        const char1Species = document.getElementById('char1-species').value;
        const char1Height = parseFloat(document.getElementById('char1-height').value);
        const char2Species = document.getElementById('char2-species').value;
        const char2Height = parseFloat(document.getElementById('char2-height').value);

        // Basic validation
        if (!char1Species || !char1Height || !char2Species || !char2Height) {
            alert('Please fill in all fields with valid values.');
            return;
        }

        if (char1Height <= 0 || char2Height <= 0) {
            alert('Height values must be positive numbers.');
            return;
        }

        // Calculate size difference (basic calculation for now)
        const heightDiff = Math.abs(char1Height - char2Height);
        const heightDiffPercent = ((heightDiff / Math.max(char1Height, char2Height)) * 100).toFixed(1);

        // Display results
        displayResults(char1Species, char1Height, char2Species, char2Height, heightDiff, heightDiffPercent);
    }

    function displayResults(species1, height1, species2, height2, diff, diffPercent) {
        const resultsContent = document.querySelector('.results-content');

        resultsContent.innerHTML = `
            <div class="result-summary">
                <h4>Size Comparison Results</h4>
                <div class="character-comparison">
                    <div class="char-result">
                        <strong>${species1.charAt(0).toUpperCase() + species1.slice(1)}:</strong> ${height1} cm
                    </div>
                    <div class="char-result">
                        <strong>${species2.charAt(0).toUpperCase() + species2.slice(1)}:</strong> ${height2} cm
                    </div>
                </div>
                <div class="difference-result">
                    <strong>Height Difference:</strong> ${diff} cm (${diffPercent}%)
                </div>
                <div class="size-relationship">
                    <strong>Size Relationship:</strong> 
                    ${height1 > height2 ?
                `The ${species1} is ${diff} cm taller than the ${species2}` :
                `The ${species2} is ${diff} cm taller than the ${species1}`
            }
                </div>
            </div>
        `;

        resultsContainer.style.display = 'block';
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    function resetCalculator() {
        // Reset form fields
        document.getElementById('char1-species').value = '';
        document.getElementById('char1-height').value = '';
        document.getElementById('char2-species').value = '';
        document.getElementById('char2-height').value = '';

        // Hide results
        resultsContainer.style.display = 'none';

        // Reset focus to first field
        document.getElementById('char1-species').focus();
    }
}); 