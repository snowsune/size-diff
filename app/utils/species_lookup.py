import yaml


def load_species_data(species_name):
    file_path = f"app/species_data/{species_name}.yaml"
    with open(file_path, "r") as file:
        data = yaml.safe_load(file)
    return data
