from flask import Flask, render_template, request
import os
import yaml
import numpy as np

from app.utils.species_lookup import load_species_data

app = Flask(__name__)

# Load species list on startup
species_data_folder = "app/species_data"
species_list = [
    f.replace(".yaml", "")
    for f in os.listdir(species_data_folder)
    if f.endswith(".yaml")
]


@app.route("/", methods=["GET", "POST"])
def index():
    species = species_list
    selected_species = None
    anthro_height = None
    calculated_heights = {}

    if request.method == "POST":
        selected_species = request.form["species"]
        anthro_height = float(request.form["anthro_height"])

        # Load species data from YAML and calculate
        species_data = load_species_data(selected_species)
        calculated_heights = calculate_height_offsets(species_data, anthro_height)

    return render_template(
        "index.html",
        species=species,
        selected_species=selected_species,
        anthro_height=anthro_height,
        calculated_heights=calculated_heights,
    )


def calculate_height_offsets(species_data, anthro_height):
    # Example logic: Linear interpolation between points
    calculated_heights = {}
    for gender, points in species_data.items():
        heights = [p["height"] for p in points]
        anthro_sizes = [p["anthro_size"] for p in points]

        # Use regression (linear for now) to estimate height for given anthro height
        coef = np.polyfit(anthro_sizes, heights, 1)  # linear regression
        estimated_height = np.polyval(coef, anthro_height)
        calculated_heights[gender] = estimated_height

    return calculated_heights


# For WSGI
def create_app():
    return app


if __name__ == "__main__":
    app.run(debug=True)
