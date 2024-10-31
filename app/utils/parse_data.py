import logging
from app.utils.character import Character
from app.utils.species_lookup import load_species_data
from app.utils.calculate_heights import calculate_height_offset


def extract_characters(query_string: str) -> list:
    """
    Extracts species, gender, height, and name from the query string.
    Returns a list of Character instances with defaults for missing values.
    """

    characters_list = []

    # Ensure the delimiter is a space, in case '+' is unreliable
    query_string = query_string.replace("+", " ")

    if query_string:
        for char_data in query_string.split(" "):
            try:
                # Unpack with default values for any missing fields
                species, gender, height, name = (
                    char_data.split(",") + ["unknown", "unknown", "60", "unknown"]
                )[:4]

                # Ensure height is a float, with a default if missing or invalid
                height = float(height) if height.replace(".", "", 1).isdigit() else 0.0

                characters_list.append(
                    Character(name=name, species=species, height=height, gender=gender)
                )

            except ValueError as e:
                logging.warning(f"Error parsing character data '{char_data}': {e}")
                continue  # Gracefully skip incorrect formats

    return characters_list


def remove_character_from_query(characters_list: list, index_to_remove: int) -> str:
    """
    Remove the character at the given index from the characters list and regenerate the query string.
    """
    if 0 <= index_to_remove < len(characters_list):
        # Remove the character at the specified index
        del characters_list[index_to_remove]

    # Generate and return the new query string
    return generate_characters_query_string(characters_list)


def filter_valid_characters(characters_list: list) -> list:
    """
    Validates characters by calculating their display heights from species data.
    Returns a list of Character instances with updated height and image.
    """
    valid_characters = []

    for char in characters_list:
        species_data = load_species_data(char.species)
        calculated_height_data = calculate_height_offset(
            {"species": char.species, "gender": char.gender, "height": char.height}
        )

        # Update character attributes based on calculated data
        char.height = calculated_height_data[char.gender]["estimated_height"]
        char.image = calculated_height_data[char.gender]["image"]

        valid_characters.append(char)

    return valid_characters


def generate_characters_query_string(characters_list: list) -> str:
    """
    Generates a query string from the list of Character instances.
    """
    return "+".join(char.to_query_string() for char in characters_list)
