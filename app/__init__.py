from flask import Flask, render_template, request, send_file, jsonify, redirect
import os
import io
import yaml
import random
import logging

from PIL import Image

from app.utils.species_lookup import load_species_data
from app.utils.calculate_heights import calculate_height_offsets
from app.utils.parse_data import (
    extract_characters,
    filter_valid_characters,
    generate_characters_query_string,
    remove_character_from_query,
)

app = Flask(__name__)

# Sets up logging
logging.basicConfig(level=logging.DEBUG)

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


@app.route("/", methods=["GET", "POST"])
def index():
    species = species_list  # Assuming species_list is defined elsewhere

    # Extract characters from query string
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)

    # Insert the default values here!
    if len(characters_list) == 0:
        characters_list = [
            {"species": "arctic_fox", "gender": "female", "height": 22},
            {"species": "red_wolf", "gender": "male", "height": 68},
        ]

    logging.debug(characters_list)

    if request.method == "POST":
        # Get form data
        selected_species = request.form["species"]
        anthro_height = float(request.form["anthro_height"])
        gender = request.form["gender"]

        # Add the new character to the list
        characters_list.append(
            {"species": selected_species, "gender": gender, "height": anthro_height}
        )

        # Redirect with updated query string
        characters_query = generate_characters_query_string(characters_list)
        return redirect(f"/?characters={characters_query}")

    # Filter and validate characters, recalculating heights
    # valid_characters = filter_valid_characters(characters_list)

    # Render the page
    return render_template(
        "index.html",
        species=species,
        characters_list=characters_list,
        version=os.getenv("GIT_COMMIT", "ERR_NO_REVISION"),
    )


@app.route("/remove/<int:index>", methods=["GET"])
def remove_character(index):
    # Extract characters from query string
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)

    # Remove the character at the specified index
    updated_query = remove_character_from_query(characters_list, index)

    # Redirect to the updated URL with the character removed
    return redirect(f"/?characters={updated_query}")


# For WSGI
def create_app():
    return app


if __name__ == "__main__":
    app.run(debug=True)
