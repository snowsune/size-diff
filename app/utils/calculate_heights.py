import re
import numpy as np
import logging

from app.utils.species_lookup import load_species_data
from app.utils.character import Character


def inches_to_feet_inches(inches: int) -> str:
    """
    Convert inches to a formatted string in feet and inches.
    """

    feet = inches // 12
    remaining_inches = inches % 12
    return f"{feet}'{remaining_inches}\""


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


def calculate_height_offset(character: Character) -> Character:
    """
    Calculate the corresponding real-world height for a given character.
    Character is a dictionary with 'species', 'gender', and 'anthro_height'.

    It should return Character object (python)
    """

    # Load species data for the given species
    species_data = load_species_data(character.species)

    # Extract gender-specific data and interpolation points
    gender_data = species_data[character.gender]
    anthro_height = character.height
    height_data = gender_data["data"]

    # Gather height and anthro size data for interpolation
    heights = [point["height"] for point in height_data]
    anthro_sizes = [point["anthro_size"] for point in height_data]

    # Perform linear regression (use a 1st-degree polynomial for interpolation)
    coef = np.polyfit(anthro_sizes, heights, 1)  # Linear regression
    estimated_height = np.polyval(coef, anthro_height)

    # Return the estimated height along with the corresponding image
    return Character(
        character.name,
        character.species,
        anthro_height,  # Changeme later!
        character.gender,
        gender_data["image"],
        gender_data["ears_offset"],
    )
