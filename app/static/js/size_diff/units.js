/**
 * Length parsing and formatting for Size Diff (based on my python app/utils/calculate_heights.py).
 */
const SizeDiffUnits = (() => {
    function gcd(a, b) {
        let x = Math.abs(a);
        let y = Math.abs(b);
        while (y) {
            [x, y] = [y, x % y];
        }
        return x;
    }

    function roundToFraction(value, denominator) {
        const numerator = Math.round(value * denominator);
        if (numerator === 0) {
            return '';
        }
        const divisor = gcd(numerator, denominator);
        const simplifiedNumerator = numerator / divisor;
        const simplifiedDenominator = denominator / divisor;
        if (simplifiedDenominator === 1) {
            return `${simplifiedNumerator}`;
        }
        return `${simplifiedNumerator}/${simplifiedDenominator}`;
    }

    /** Format a length in inches for display (e.g. 76 -> 6'4"). */
    function formatInches(inches, { useInches = 30, useFractions = true } = {}) {
        if (!Number.isFinite(inches)) {
            return '';
        }

        if (inches < useInches) {
            if (useFractions) {
                let wholeInches = Math.floor(inches);
                let fractionalPart = inches - wholeInches;
                let roundedFraction = roundToFraction(fractionalPart, 8);
                if (roundedFraction === '1') {
                    roundedFraction = '';
                    wholeInches += 1;
                }
                if (roundedFraction) {
                    return wholeInches
                        ? `${wholeInches} ${roundedFraction}"`
                        : `${roundedFraction}"`;
                }
                return `${wholeInches}"`;
            }
            return `${inches.toFixed(1)}"`;
        }

        const feet = Math.floor(inches / 12);
        const remainingInches = Math.round(inches % 12);
        return `${feet}'${remainingInches}"`;
    }

    /** Format a unitless ratio (e.g. anthropic ratio). */
    function formatRatio(ratio, digits = 2) {
        return `${ratio.toFixed(digits)}×`;
    }

    /**
     * Parse multi-unit length input into inches.
     * Accepts plain numbers, 6'4", 180cm, 1.5m.
     */
    function parseLengthInput(input) {
        const raw = String(input).trim();
        if (!raw) {
            return NaN;
        }

        const cmMatch = raw.match(/^(\d+(?:\.\d+)?)\s*cm$/i);
        if (cmMatch) {
            return parseFloat(cmMatch[1]) / 2.54;
        }

        const mMatch = raw.match(/^(\d+(?:\.\d+)?)\s*m$/i);
        if (mMatch) {
            return (parseFloat(mMatch[1]) * 100) / 2.54;
        }

        const ftInMatch = raw.match(/^(\d+)'\s*(\d+(?:\.\d+)?)"?$/);
        if (ftInMatch) {
            return parseInt(ftInMatch[1], 10) * 12 + parseFloat(ftInMatch[2]);
        }

        const feetOnlyMatch = raw.match(/^(\d+(?:\.\d+)?)'$/);
        if (feetOnlyMatch) {
            return parseFloat(feetOnlyMatch[1]) * 12;
        }

        const inchesOnlyMatch = raw.match(/^(\d+(?:\.\d+)?)"$/);
        if (inchesOnlyMatch) {
            return parseFloat(inchesOnlyMatch[1]);
        }

        const numeric = parseFloat(raw);
        return Number.isNaN(numeric) ? NaN : numeric;
    }

    /** Read a named form field and parse it as a length in inches. */
    function parseFormLengthInput(form, fieldName) {
        const el = form?.elements?.[fieldName] ?? form?.querySelector(`[name="${fieldName}"]`);
        const raw = el?.value;
        if (raw == null || !String(raw).trim()) {
            return null;
        }
        const inches = parseLengthInput(raw);
        return Number.isNaN(inches) ? null : inches;
    }

    /** Format a form length field for display; returns empty string when unset. */
    function formatFormLengthInput(form, fieldName, options) {
        const inches = parseFormLengthInput(form, fieldName);
        return inches == null ? '' : formatInches(inches, options);
    }

    /** World-pixel distance for a real-world inch count. */
    function inchesToWorld(inches, pixelsPerInch) {
        return inches * pixelsPerInch;
    }

    /** Real-world inches for a world-pixel distance. */
    function worldToInches(worldDistance, pixelsPerInch) {
        return worldDistance / pixelsPerInch;
    }

    /**
     * Derive scale from a known measurement.
     * Example: TFH spans 900 world px and is 108" -> pixelsPerInch ≈ 8.33
     */
    function pixelsPerInchFromReference(inches, worldDistance) {
        if (!inches || !worldDistance) {
            return null;
        }
        return worldDistance / inches;
    }

    function worldDistance(start, end) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        return Math.hypot(dx, dy);
    }

    return {
        formatInches,
        formatRatio,
        parseLengthInput,
        parseFormLengthInput,
        formatFormLengthInput,
        inchesToWorld,
        worldToInches,
        pixelsPerInchFromReference,
        worldDistance,
    };
})();

if (typeof window !== 'undefined') {
    window.SizeDiffUnits = SizeDiffUnits;
}
