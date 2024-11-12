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

from concurrent.futures import ThreadPoolExecutor

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
stats_manager = StatsManager("/var/size-diff/stats.db")
executor = ThreadPoolExecutor(max_workers=4)

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

    # Get settings
    measure_ears = request.args.get("measure_ears", True) == "True"
    scale_height = request.args.get("scale_height", True) == "True"

    # Get height
    size = int(request.args.get("size", "400"))

    # Record we've generated a new image!
    stats_manager.increment_images_generated()

    def generate_and_save():
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
            image = render_image(
                characters_list,
                size,
                measure_to_ears=measure_ears,
                use_species_scaling=scale_height,
            )

        # Save image to a BytesIO object
        img_io = io.BytesIO()
        image.save(img_io, "PNG")
        img_io.seek(0)
        return img_io

    # Submit the task to the executor
    future = executor.submit(generate_and_save)

    try:
        img_io = future.result(timeout=30)  # Wait for up to 30 seconds
    except TimeoutError:
        return "Image generation timed out", 504

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

    # Extract settings from query string
    measure_ears = request.args.get("measure_ears", "true") == "true"
    scale_height = request.args.get("scale_height", "false") == "true"

    # Record visitor IP in stats
    visitor_ip = request.headers.get("X-Real-IP", request.remote_addr)
    stats_manager.register_visitor(visitor_ip)

    # Retrieve the current stats
    stats = stats_manager.get_stats()

    # Insert default character values if none exist
    if len(characters_list) == 0:
        characters_list = [
            Character(name="Vixi", species="arctic_fox", height=62, gender="female"),
            Character(name="Randal", species="red_fox", height=66, gender="male"),
            Character(name="Ky-Li", species="wolf", height=88, gender="female"),
        ]

    if request.method == "POST":
        # Get species, name, and gender from form data
        selected_species = request.form["species"]
        name = request.form["name"].replace(" ", "_")[:10]
        gender = request.form["gender"]
        height = request.form["anthro_height"]

        # Update settings based on form data
        measure_ears = "measure_ears" in request.form
        scale_height = "scale_height" in request.form

        # Check and see if they actually filled anything out
        if len(name) == 0 and len(height) == 0:
            # They probably just clicked add erronously or changed a **setting** so we'll re-fetch
            # settings and re-draw.
            pass
        else:
            # Looks like they wanted a new character added/changed! So lets do that.
            try:
                anthro_height = convert_to_inches(height)
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

        # Add settings to query string if enabled
        settings_query = f"&measure_ears=false" if not measure_ears else ""
        settings_query += f"&scale_height=true" if scale_height else ""

        return redirect(f"/?characters={characters_query}{settings_query}")

    # Could prolly move this somewhere else?
    settings_query = f"&measure_ears=false" if not measure_ears else ""
    settings_query += f"&scale_height=true" if scale_height else ""

    return render_template(
        "index.html",
        stats=stats,
        cache_performance=get_cache_performance(),
        species=species_list,
        characters_list=characters_list,
        characters_query=generate_characters_query_string(characters_list),
        settings_query=settings_query,
        measure_ears=measure_ears,
        scale_height=scale_height,
        version=os.getenv("GIT_COMMIT", "ERR_NO_REVISION"),
        server_url=os.getenv("SERVER_URL", "https://nextcloud.kitsunehosting.net/"),
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


# The about page
@app.route("/about")
def about():
    # Load a YAML file to display on the page
    yaml_file_path = os.path.join("app/species_data", "red_fox.yaml")
    with open(yaml_file_path, "r") as yaml_file:
        yaml_content = yaml_file.read()

    # Pass the YAML content to the template
    return render_template("about.html", yaml_content=yaml_content)


# For WSGI
def create_app():
    return app
