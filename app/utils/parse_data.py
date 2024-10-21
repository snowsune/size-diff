import os
import logging

from app.utils.species_lookup import load_species_data
from app.utils.calculate_heights import calculate_height_offsets


def extract_characters(query_string):
    """
    Extracts species, gender, and height from the query string.
    Returns a list of character dictionaries.
    """

    characters_list = []

    if query_string:
        for char in query_string.split(" "):
            try:
                species, gender, height = char.split(",")
                characters_list.append(
                    {"species": species, "gender": gender, "height": float(height)}
                )
            except ValueError as e:
                logging.warn(f"Caught error {e} when parsing.")
                continue  # Gracefully handle incorrect formats
    return characters_list


def filter_valid_characters(characters_list):
    """
    Filters and validates characters, calculating their heights from species data.
    """

    valid_characters = []
    for char in characters_list:
        species_data = load_species_data(char["species"])
        calculated_height = calculate_height_offsets(species_data, char["height"])

        # Append character with valid calculated data
        valid_characters.append(
            {
                "species": char["species"],
                "gender": char["gender"],
                "height": calculated_height[char["gender"]]["estimated_height"],
                "image": calculated_height[char["gender"]]["image"],
            }
        )

    return valid_characters


def generate_characters_query_string(characters_list):
    """
    Generates a query string from the list of characters.
    """
    return "+".join(
        [
            f"{char['species']},{char['gender']},{char['height']}"
            for char in characters_list
        ]
    )
