import re
import numpy as np
import logging

from app.utils.species_lookup import load_species_data
from app.utils.character import Character


def inches_to_feet_inches(inches: int, use_inches: int = 30) -> str:
    """
    Convert inches to a formatted string in feet and inches, or just inches if below use_inches threshold.
    """

    if inches < use_inches:
        return f'{inches}"'

    feet = inches // 12
    remaining_inches = inches % 12

    # Format feet and remaining_inches as integers if they are whole numbers
    feet_str = f"{int(feet)}" if feet == int(feet) else f"{feet}"
    inches_str = (
        f"{int(remaining_inches)}"
        if remaining_inches == int(remaining_inches)
        else f"{remaining_inches:.1f}"
    )

    return f"{feet_str}'{inches_str}\""


def convert_to_inches(_input: str) -> int:
    """
    Function can accept values like 125cm or 4'4" and return an integer number of inches.
    Raises ValueError if input is invalid.
    """

    # Handle input in centimeters (e.g., "125cm")
    cm_match = re.match(r"(\d+)cm", _input)
    if cm_match:
        cm_value = int(cm_match.group(1))
        inches = round(cm_value / 2.54)  # 1 inch = 2.54 cm
        return inches

    # Handle input in feet and inches (e.g., "4'4\"")
    ft_in_match = re.match(r"(\d+)'(\d+)\"", _input)
    if ft_in_match:
        feet = int(ft_in_match.group(1))
        inches = int(ft_in_match.group(2))
        total_inches = (feet * 12) + inches  # 1 foot = 12 inches
        return total_inches

    # If the input doesn't match any expected format, raise a ValueError
    raise ValueError(f"Invalid input format: {_input}")


def calculate_height_offset(
    character: Character, use_species_scaling=False
) -> Character:
    """
    Calculate the real-world height for a given character, based on their anthro height.
    If use_species_scaling is True, the height will be adjusted to the corresponding 'feral' height.
    """

    # Load species data for the given species
    species_data = load_species_data(character.species)

    # Extract gender-specific data and interpolation points
    try:
        gender_data = species_data[character.gender]
    except KeyError:
        # If androgynous or missing, use male as default or handle it
        gender_data = species_data["male"]
    anthro_height = character.height
    height_data = gender_data["data"]

    # Gather height and anthro size data for interpolation
    heights = [point["height"] for point in height_data]
    anthro_sizes = [point["anthro_size"] for point in height_data]

    # Perform linear regression to model the anthro size to feral height relationship
    coef = np.polyfit(anthro_sizes, heights, 1)  # Linear regression coefficients
    feral_height = np.polyval(coef, anthro_height)

    # Decide which height to use based on the use_species_scaling flag
    final_height = max(feral_height, 2) if use_species_scaling else anthro_height

    # Return a new Character object with the adjusted height and original character attributes
    return Character(
        name=character.name,
        species=character.species,
        height=anthro_height,  # Original anthro height
        feral_height=final_height,  # Calculated feral height if scaling applied
        gender=character.gender,
        image=gender_data["image"],
        ears_offset=gender_data["ears_offset"],
    )
