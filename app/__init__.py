from flask import (
    Flask,
    render_template,
    request,
    send_file,
    jsonify,
    redirect,
    url_for,
    flash,
    make_response,
)
import os
import io
import random
import logging

from PIL import Image

from app.utils.species_lookup import load_species_data
from app.utils.calculate_heights import calculate_height_offset, convert_to_inches
from app.utils.parse_data import (
    extract_characters,
    filter_valid_characters,
    generate_characters_query_string,
    remove_character_from_query,
)
from app.utils.caching import get_cache_performance
from app.utils.stats import StatsManager
from app.utils.generate_image import render_image
from app.utils.character import Character

app = Flask(__name__)
app.secret_key = os.urandom(24)
stats_manager = StatsManager("/var/size-diff/stats.json")

# Sets up logging
if os.getenv("GIT_COMMIT", None) == None:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

# Load species list on startup
species_data_folder = "app/species_data"
species_list = [
    f.replace(".yaml", "")
    for f in os.listdir(species_data_folder)
    if f.endswith(".yaml")
]


@app.route("/generate-image")
def generate_image():
    # Get characters
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)

    # Get height
    size = int(request.args.get("size", "400"))

    # Record we've generated a new image!
    stats_manager.increment_images_generated()

    if len(characters_list) == 0:
        logging.warn("Asked to generate an empty image!")

        # Generate an empty image
        image = Image.new("RGB", (int(size * 1.4), size))
        pixels = image.load()

        for i in range(image.size[0]):
            for j in range(image.size[1]):
                pixels[i, j] = (
                    random.randint(0, 255),
                    random.randint(0, 255),
                    random.randint(0, 255),
                )
    else:
        image = render_image(characters_list, size)

    # Save image to a BytesIO object
    img_io = io.BytesIO()
    image.save(img_io, "PNG")
    img_io.seek(0)

    # Create a response with the image and set Content-Type to image/png
    response = make_response(img_io.read())
    response.headers.set("Content-Type", "image/png")
    response.headers.set("Content-Disposition", "inline", filename="preview.png")

    return response


@app.route("/", methods=["GET", "POST"])
def index():
    species = species_list  # Assuming species_list is defined elsewhere

    # Extract characters from query string
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)

    # Record visitor IP in stats
    visitor_ip = request.remote_addr
    stats_manager.register_visitor(visitor_ip)

    # Retrieve the current stats
    stats = stats_manager.get_stats()

    # Insert default character values if none exist
    if len(characters_list) == 0:
        characters_list = [
            Character(name="Vixi", species="arctic_fox", height=60, gender="female"),
            Character(name="Randal", species="red_fox", height=66, gender="male"),
            Character(name="Tibran", species="wolf", height=102, gender="male"),
        ]

    if request.method == "POST":
        # Get species, name, and gender from form data
        selected_species = request.form["species"]
        name = request.form["name"].replace(" ", "_")[:10]
        gender = request.form["gender"]

        # Calculate the height from anthro height input
        try:
            anthro_height = convert_to_inches(request.form["anthro_height"])
        except Exception as e:
            # Flash onscreen if error
            flash(str(e), "error")
            return redirect(url_for("index"))

        # Create a new Character instance and add to list
        new_character = Character(
            name=name, species=selected_species, height=anthro_height, gender=gender
        )
        characters_list.append(new_character)

        # Redirect with updated query string
        characters_query = generate_characters_query_string(characters_list)
        return redirect(f"/?characters={characters_query}")

    # Format characters_list into the query string format for the image backend
    query_image_format = generate_characters_query_string(characters_list)

    # Render the page
    return render_template(
        "index.html",
        stats=stats,
        cache_performance=get_cache_performance(),
        species=species_list,
        characters_list=characters_list,
        characters_query=query_image_format,
        version=os.getenv("GIT_COMMIT", "ERR_NO_REVISION"),
    )


@app.route("/remove/<int:index>", methods=["GET"])
def remove_character(index):
    # Extract characters from query string
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)

    logging.info(f"Remove path saw {characters} arg")

    # Remove the character at the specified index
    updated_query = remove_character_from_query(characters_list, index)

    # Redirect to the updated URL with the character removed
    return redirect(f"/?characters={updated_query}")


# For WSGI
def create_app():
    return app
