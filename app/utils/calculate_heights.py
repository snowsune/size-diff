import re
import numpy as np

from app.utils.species_lookup import load_species_data
from app.utils.character import Character


def convert_to_inches(_input: str) -> int:
    """
    Accept values like 125cm or 4'4" and return inches.
    Raises ValueError if input is invalid.
    """

    cm_match = re.match(r"(\d+)cm", _input)
    if cm_match:
        cm_value = int(cm_match.group(1))
        return round(cm_value / 2.54)

    ft_in_match = re.match(r"(\d+)'(\d+)\"", _input)
    if ft_in_match:
        feet = int(ft_in_match.group(1))
        inches = int(ft_in_match.group(2))
        return (feet * 12) + inches

    raise ValueError(f"Invalid input format: {_input}")


def calculate_height_offset(
    character: Character, use_species_scaling=False
) -> Character:
    """
    Calculate display height from anthro height + species data.
    If use_species_scaling is True, use the interpolated 'feral' height.
    """

    species_data = load_species_data(character.species)

    try:
        gender_data = species_data[character.gender]
    except KeyError:
        gender_data = species_data["male"]
    anthro_height = character.height
    height_data = gender_data["data"]

    heights = [point["height"] for point in height_data]
    anthro_sizes = [point["anthro_size"] for point in height_data]

    coef = np.polyfit(anthro_sizes, heights, 1)
    feral_height = np.polyval(coef, anthro_height)

    final_height = max(feral_height, 2) if use_species_scaling else anthro_height

    _char = Character(
        name=character.name,
        species=character.species,
        height=anthro_height,
        feral_height=final_height,
        gender=character.gender,
        image=gender_data["image"],
        ears_offset=gender_data["ears_offset"],
        color=getattr(character, "color", None),
        composite=gender_data.get("composite"),
    )

    if not _char.color:
        try:
            _char.color = gender_data["color"]
        except Exception:
            pass

    return _char
