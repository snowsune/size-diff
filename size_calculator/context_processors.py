import os


def formatted_species_list(request):
    species_data_folder = "size_calculator/species_data"
    species_list = [
        f.replace(".yaml", "").replace("_", " ").title()
        for f in os.listdir(species_data_folder)
        if f.endswith(".yaml")
    ]
    return {"species_list": species_list}
