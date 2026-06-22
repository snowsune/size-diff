"""
Taur params validator
TODO: This might not be needed?
"""

import re

TAUR_ALGORITHMS = frozenset({"volnar", "snow", "manual"})
TAUR_MEASUREMENT_TYPES = frozenset({"vitruvian", "limb"})

SHARED_FIELDS = frozenset({
    "name",
    "algorithm",
    "taur_body_color",
    "show_measurements",
    "show_rider",
    "rider_height",
    "taur_rider_color",
    "show_standing",
    "standing_height",
    "taur_standing_color",
})

ALGORITHM_FIELDS = {
    "volnar": frozenset({
        "measurement_type",
        "species",
        "anthro_height",
        "species_height",
        "species_length",
        "species_tail_length",
        "taur_full_height",
        "species_weight",
        "taur_length",
    }),
    "snow": frozenset({
        "species",
        "anthro_height",
        "species_height",
        "species_length",
        "species_tail_length",
    }),
    "manual": frozenset({
        "manual_lower_body_height",
        "manual_taur_full_height",
        "manual_tail_length",
    }),
}

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
CHECKBOX_RE = re.compile(r"^(1|on|true)$", re.I)
MAX_FIELD_LEN = 64
MAX_NAME_LEN = 40


def allowed_fields_for_algorithm(algorithm: str) -> frozenset[str]:
    if algorithm not in TAUR_ALGORITHMS:
        return frozenset()
    return SHARED_FIELDS | ALGORITHM_FIELDS[algorithm]


def iter_allowed_taur_params(args):
    """Yield (key, value) pairs that are allowed for the request's algorithm."""
    algorithm = (args.get("algorithm") or "volnar").strip()
    if algorithm not in TAUR_ALGORITHMS:
        return

    allowed = allowed_fields_for_algorithm(algorithm)
    for key in args.keys():
        if key not in allowed:
            continue
        value = args.get(key, "").strip()
        if not value:
            continue
        if len(value) > MAX_FIELD_LEN:
            continue
        yield key, value


def validate_taur_params(args, species_names: set[str]) -> tuple[list[tuple[str, str]], str | None]:
    algorithm = (args.get("algorithm") or "volnar").strip()
    if algorithm not in TAUR_ALGORITHMS:
        return [], "unknown algorithm"

    allowed = allowed_fields_for_algorithm(algorithm)
    pairs: list[tuple[str, str]] = []

    for key in args.keys():
        if key not in allowed:
            return [], f"unknown field: {key}"

        value = args.get(key, "").strip()
        if not value:
            continue
        if len(value) > MAX_FIELD_LEN:
            return [], f"field too long: {key}"

        err = _validate_field(key, value, species_names)
        if err:
            return [], err

        pairs.append((key, value))

    if algorithm != "manual" and not any(k == "anthro_height" for k, _ in pairs):
        return [], "missing anthro_height"

    return pairs, None


def _validate_field(key: str, value: str, species_names: set[str]) -> str | None:
    if key == "name":
        if len(value) > MAX_NAME_LEN:
            return "name too long"
        return None

    if key in {"show_measurements", "show_rider", "show_standing"}:
        if not CHECKBOX_RE.match(value):
            return f"invalid {key}"
        return None

    if key in {"taur_body_color", "taur_rider_color", "taur_standing_color"}:
        if not COLOR_RE.match(value):
            return f"invalid {key}"
        return None

    if key == "species":
        if value != "generic" and value not in species_names:
            return "unknown species"
        return None

    if key == "measurement_type":
        if value not in TAUR_MEASUREMENT_TYPES:
            return "invalid measurement_type"
        return None

    if key == "species_weight":
        try:
            weight = float(value)
        except ValueError:
            return "invalid species_weight"
        if weight <= 0 or weight > 100_000:
            return "species_weight out of range"
        return None

    if key.endswith("_height") or key.endswith("_length") or key == "taur_full_height":
        if len(value) > 24:
            return f"invalid {key}"
        return None

    return None
