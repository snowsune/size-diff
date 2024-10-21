from flask import Flask, render_template, request, send_file, jsonify
import os
import io
import yaml
import random
import logging

import numpy as np

from PIL import Image

from app.utils.species_lookup import load_species_data

app = Flask(__name__)

# Sets up logging
logging.basicConfig(level=logging.INFO)

# Load species list on startup
species_data_folder = "app/species_data"
species_list = [
    f.replace(".yaml", "")
    for f in os.listdir(species_data_folder)
    if f.endswith(".yaml")
]


# Route to generate a dynamic image based on species, height, and gender
# At some point, this will be moved to its own much more complex and thorough function
@app.route("/generate-image")
def generate_image():
    species = request.args.get("species", "default_species")
    height = request.args.get("height", "default_height")
    gender = request.args.get("gender", "default_gender")

    # Create a random noise image for now
    image = Image.new("RGB", (800, 400))  # Example size: 800x400
    pixels = image.load()

    for i in range(image.size[0]):
        for j in range(image.size[1]):
            pixels[i, j] = (
                random.randint(0, 255),
                random.randint(0, 255),
                random.randint(0, 255),
            )

    # Save image to a BytesIO object
    img_io = io.BytesIO()
    image.save(img_io, "PNG")
    img_io.seek(0)

    return send_file(img_io, mimetype="image/png")


# Super cool! Generate previews when linked in discord or insta or, wherever
@app.route("/preview")
def preview():
    species = request.args.get("species", "default_species")
    height = request.args.get("height", "default_height")
    gender = request.args.get("gender", "default_gender")

    # Do some cool logging
    referer = request.headers.get("Referer", "unknown platform")
    logging.info(f"Generated a preview for {species} on platform {referer}!")

    # Render a preview page with Open Graph tags
    image_url = f"/generate-image?species={species}&height={height}&gender={gender}"
    return render_template(
        "preview.html",
        species=species,
        height=height,
        gender=gender,
        image_url=image_url,
    )


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
        version=os.getenv("GIT_COMMIT", "ERR_NO_REVISION"),
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
