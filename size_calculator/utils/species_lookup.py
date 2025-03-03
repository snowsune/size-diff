import yaml

# Default ambiguous species data
DEFAULT_DATA = {
    "male": {
        "image": "missing.png",
        "ears_offset": 0.0,
        "data": [
            {"anthro_size": 5.5, "height": 155},
            {"anthro_size": 6.0, "height": 170},
        ],
    },
    "female": {
        "image": "missing.png",
        "ears_offset": 0.0,
        "data": [
            {"anthro_size": 5.5, "height": 145},
            {"anthro_size": 6.0, "height": 160},
        ],
    },
}


def load_species_data(species_name):
    try:
        file_path = f"size_calculator/species_data/{species_name}.yaml"
        with open(file_path, "r") as file:
            data = yaml.safe_load(file)
        return data
    except FileNotFoundError:
        # Return default ambiguous data if species file is not found
        return DEFAULT_DATA
