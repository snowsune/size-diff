# Conceived by Volnar <3
# Implemented by Vixi!

from typing import Dict, Any, Tuple, Optional


def calculate_taur(
    anthro_height: float,
    species_height: float,
    species_length: float,
    species_tail_length: float,
    taur_full_height: float,
    species_weight: float,
    taur_length: Optional[float] = None,
    measurement_type: str = "limb",  # "limb" for mammals, "vitruvian" for reptiles
    custom_body_parts: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Calculate taur body dimensions based on provided inputs
    using Volnar's Taur Calculator formula <3

    Args:
        anthro_height (float): Anthro height before taurification (AH).
        species_height (float): Species height (SH).
        species_length (float): Species length w/o tail (SL).
        species_tail_length (float): Species tail length (ST).
        taur_full_height (float): Taur full height (TFH).
        species_weight (float): Species weight (SW).
        taur_length (float, optional): Taur length w/o tail (TL).
        measurement_type (str, optional): 'limb' (default) or 'vitruvian'.
        custom_body_parts (dict, optional): Additional custom body part measurements (CBP).

    Returns:
        Dict[str, Any]: Calculated taur results including TH, TFH, TL, etc.
    """

    # Splitting Anthro Height into parts
    anthro_legs = anthro_height * 4 / 8
    anthro_torso = anthro_height * 3 / 8
    anthro_head = anthro_height * 1 / 8
    # Here approx: arm_length = anthro_legs

    # TH: Taur Height
    if measurement_type == "limb":
        # Limb Type: TH = AL
        taur_height = anthro_legs
        if taur_length is None:
            taur_length_calc = species_length
        else:
            taur_length_calc = taur_length
    else:
        # Vitruvian Type: TL = (2 * AT) - AHe
        taur_length_calc = (2 * anthro_torso) - anthro_head
        # In this type, TH meaning is not directly defined; fallback to species scaling
        taur_height = species_height * (taur_full_height / anthro_height)

    # Ratios
    # TR: Taur Ratio (size change between SH and TH)
    taur_ratio = taur_height / species_height if species_height > 0 else 0
    # AR: Anthro Ratio (size change between AH and TFH)
    anthro_ratio = taur_full_height / anthro_height if anthro_height > 0 else 0

    # Apply AR to custom body parts
    cbp_result = {}
    if custom_body_parts:
        for part, value in custom_body_parts.items():
            cbp_result[part] = value * anthro_ratio

    # Taur Torso and Head
    taur_torso = anthro_torso * anthro_ratio
    taur_head = anthro_head * anthro_ratio

    # Taur Tail
    taur_tail = (
        species_tail_length * taur_ratio if species_tail_length is not None else 0
    )

    # Taur Weight estimate: cube AR, apply to SW
    taur_weight = species_weight * (anthro_ratio**3)
    taur_weight_minus = taur_weight * 0.9
    taur_weight_plus = taur_weight * 1.1

    # Compose results
    result = {
        "TH": taur_height,
        "TFH": taur_full_height,
        "TL": taur_length_calc,
        "TT": taur_tail,
        "TTo": taur_torso,
        "THe": taur_head,
        "TW": taur_weight,
        "TW-": taur_weight_minus,
        "TW+": taur_weight_plus,
        "CBP": cbp_result,
        "AR": anthro_ratio,
        "TR": taur_ratio,
    }
    return result
