import re
import numpy as np

from app.utils.species_lookup import load_species_data


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


def calculate_height_offset(character):
    """
    Calculate the corresponding real-world height for a given character.
    Character is a dictionary with 'species', 'gender', and 'anthro_height'.
    """

    species = character["species"]
    gender = character["gender"]
    anthro_height = character["height"]

    # Load species data from YAML file
    species_data = load_species_data(species)

    # Extract the gender-specific data
    gender_data = species_data[gender]
    height_data = gender_data["data"]

    # Extract heights and anthro sizes for linear interpolation
    heights = [point["height"] for point in height_data]
    anthro_sizes = [point["anthro_size"] for point in height_data]

    # Perform linear regression (use a 1st-degree polynomial for interpolation)
    coef = np.polyfit(anthro_sizes, heights, 1)  # Linear regression
    estimated_height = np.polyval(coef, anthro_height)

    # Return the estimated height along with the corresponding image
    return {
        "estimated_height": estimated_height,
        "image": gender_data["image"],  # Get the image file path for the gender
    }
