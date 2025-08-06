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

from flask_caching import Cache
from functools import wraps

from app.utils.species_lookup import load_species_data
from app.utils.calculate_heights import calculate_height_offset, convert_to_inches
from app.utils.parse_data import (
    extract_characters,
    filter_valid_characters,
    generate_characters_query_string,
    remove_character_from_query,
    load_preset_characters,
    get_default_characters,
)
from app.utils.stats import StatsManager
from app.utils.generate_image_legacy import render_image
from app.utils.character import Character

app = Flask(__name__)
app.secret_key = os.urandom(24)
stats_manager = StatsManager("/var/size-diff/stats.db")
executor = ThreadPoolExecutor(max_workers=4)

# Cache
cache = Cache(app, config={"CACHE_TYPE": "simple"})
cache_stats = {"hits": 0, "misses": 0}


def cache_with_stats(timeout, query_string=False):
    """Track cache performance while caching responses."""

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            cache_key = f"{request.path}?{request.query_string.decode('utf-8')}"
            cached_response = cache.get(cache_key)
            if cached_response:
                cache_stats["hits"] += 1
                return cached_response
            cache_stats["misses"] += 1
            response = f(*args, **kwargs)
            cache.set(cache_key, response, timeout=timeout)
            return response

        return wrapped

    return decorator


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
@cache_with_stats(timeout=31536000, query_string=True)
def generate_image_legacy():
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
    response.headers.set("Cache-Control", "public, max-age=31536000")

    return response


@app.route("/", methods=["GET", "POST"])
def index():
    species = species_list  # Assuming species_list is defined elsewhere

    # Extract characters from query string
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)

    # Process characters to populate image and ears_offset from species data
    processed_characters = []
    for char in characters_list:
        processed_char = calculate_height_offset(char, use_species_scaling=False)
        processed_characters.append(processed_char)
    characters_list = processed_characters

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
        default_chars = get_default_characters()
        # Process default characters to populate image and ears_offset
        characters_list = []
        for char in default_chars:
            processed_char = calculate_height_offset(char, use_species_scaling=False)
            characters_list.append(processed_char)

    # Load presets for the dropdown
    presets = load_preset_characters()
    preset_map = {
        f"{p['name'].replace('_', ' ').title()} --- {p['species'].replace('_', ' ').title()}, {p['gender']}, {p.get('description', '')}": f"{p['species']},{p['gender']},{p['height']},{p['name']}"
        for p in presets
    }

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
        cache_performance=f"{cache_stats['hits']}/{cache_stats['misses']}",
        species=species_list,
        characters_list=characters_list,
        characters_query=generate_characters_query_string(characters_list),
        settings_query=settings_query,
        measure_ears=measure_ears,
        scale_height=scale_height,
        version=os.getenv("GIT_COMMIT", "ERR_NO_REVISION"),
        server_url=os.getenv("SERVER_URL", "https://nextcloud.kitsunehosting.net/"),
        presets=presets,
        preset_map=preset_map,
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


# Specific for adding a preset
# handles the edge case where we may need to add the default list.
@app.route("/add-preset", methods=["GET"])
def add_preset():
    # Get the preset value from the query string
    preset_val = request.args.get("preset")
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)

    # If the current list is empty, add the defaults
    if not characters_list:
        characters_list = get_default_characters()
    # Add the new preset
    if preset_val:
        # Parse the preset string (species,gender,height,name)
        parts = preset_val.split(",")
        if len(parts) == 4:
            characters_list.append(
                Character(
                    name=parts[3],
                    species=parts[0],
                    height=float(parts[2]),
                    gender=parts[1],
                )
            )
    # Build the new query string
    characters_query = generate_characters_query_string(characters_list)
    # Preserve settings if present
    measure_ears = request.args.get("measure_ears")
    scale_height = request.args.get("scale_height")
    settings_query = ""
    if measure_ears == "false":
        settings_query += "&measure_ears=false"
    if scale_height == "true":
        settings_query += "&scale_height=true"
    return redirect(f"/?characters={characters_query}{settings_query}")


@app.route("/taur")
def taur():
    """
    Base route for volnar's sub-page!
    """

    return render_template("taur.html")


# Interactive demo route
@app.route("/interactive-demo")
def interactive_demo():
    return render_template("interactive_demo.html")


# Serve species data images for the client-side renderer
@app.route("/species_data/<filename>")
def serve_species_image(filename):
    from flask import send_from_directory
    import os

    # Get the absolute path to the species_data directory
    species_data_path = os.path.join(os.path.dirname(__file__), "species_data")
    return send_from_directory(species_data_path, filename)


# New universal renderer endpoint (replaces the old Python renderer)
@app.route("/generate-image-new")
@cache_with_stats(timeout=31536000, query_string=True)
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
            # Use the JavaScript renderer with fallback to Python PIL
            from app.utils.js_renderer import render_with_js_fallback

            # Convert characters to dictionaries for JS renderer
            char_dicts = []
            for char in characters_list:
                char_dict = {
                    "name": char.name,
                    "species": char.species,
                    "height": char.height,
                    "gender": char.gender,
                    "feral_height": char.feral_height,
                    "image": char.image,
                    "ears_offset": char.ears_offset,
                }
                if hasattr(char, "color") and char.color:
                    char_dict["color"] = char.color
                char_dicts.append(char_dict)

            options = {
                "size": size,
                "measureToEars": measure_ears,
                "useSpeciesScaling": scale_height,
            }

            # This will try JS renderer first, fall back to Python PIL automatically
            image = render_with_js_fallback(char_dicts, options)

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
    response.headers.set("Cache-Control", "public, max-age=31536000")

    return response


# For WSGI
def create_app():
    return app
