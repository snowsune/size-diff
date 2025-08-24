import yaml

# Default ambiguous species data
DEFAULT_DATA = {
    "male": {
        "image": "missing.png",
        "ears_offset": 0.0,
        "data": [
            {"anthro_size": 60, "height": 60},
            {"anthro_size": 1, "height": 1},
        ],
    },
    "female": {
        "image": "missing.png",
        "ears_offset": 0.0,
        "data": [
            {"anthro_size": 60, "height": 60},
            {"anthro_size": 1, "height": 1},
        ],
    },
}


def load_species_data(species_name):
    try:
        file_path = f"app/species_data/{species_name}.yaml"
        with open(file_path, "r") as file:
            data = yaml.safe_load(file)
        return data
    except FileNotFoundError:
        # Return default ambiguous data if species file is not found
        return DEFAULT_DATA
