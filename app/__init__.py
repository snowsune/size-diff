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
from app.utils.calculate_heights import (
    calculate_height_offset,
    convert_to_inches,
    inches_to_feet_inches,
)
from app.utils.parse_data import (
    extract_characters,
    filter_valid_characters,
    generate_characters_query_string,
    remove_character_from_query,
    load_preset_characters,
    get_default_characters,
)
from app.utils.stats import StatsManager
from app.utils.generate_image import render_image
from app.utils.character import Character
from app.utils.taur_calculator import calculate_taur

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
    response.headers.set("Cache-Control", "public, max-age=31536000")

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
        characters_list = get_default_characters()

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


@app.route("/taur", methods=["GET", "POST"])
def taur():
    """
    Taur calculator!

    Collaboration with Volnar <3
    """
    # Filter out some ones we dont want to show/dont have data
    filtered_species = [
        s
        for s in species_list
        if s not in ["taur_(generic)", "preset_species", "rexouium"]
    ]

    # Load species data for auto-population
    species_data_map = {}
    for species_name in filtered_species:
        try:
            data = load_species_data(species_name)
            # Extract species_length, species_tail_length, species_weight from male section
            # and get a default species_height from the first data point
            if "male" in data:
                male_data = data["male"]
                species_data_map[species_name] = {
                    "species_length": male_data.get("species_length", 0),
                    "species_tail_length": male_data.get("species_tail_length", 0),
                    "species_weight": male_data.get("species_weight", 0),
                    "species_height": (
                        male_data.get("data", [{}])[0].get("height", 0)
                        if male_data.get("data")
                        else 0
                    ),
                }
        except Exception as e:
            logging.warning(f"Failed to load species data for {species_name}: {e}")
            species_data_map[species_name] = {
                "species_length": 0,
                "species_tail_length": 0,
                "species_weight": 0,
                "species_height": 0,
            }

    if request.method == "POST":
        # POST when handling a form submission - redirect with URL parameters
        params = {}
        for key in [
            "name",
            "measurement_type",
            "anthro_height",
            "species_height",
            "species_length",
            "species_tail_length",
            "taur_full_height",
            "species_weight",
            "taur_length",
        ]:
            value = request.form.get(key, "")
            if value:
                params[key] = value

        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return redirect(f"/taur?{query_string}")

    # Handle GET with calculation parameters
    calculation_result = None
    cleaned_calculation_result = {}
    if request.args.get("anthro_height"):
        try:
            anthro_height = float(request.args.get("anthro_height", 0))
            species_height = float(request.args.get("species_height", 0))
            species_length = float(request.args.get("species_length", 0))
            species_tail_length = float(request.args.get("species_tail_length", 0))
            taur_full_height = float(request.args.get("taur_full_height", 0))
            species_weight = float(request.args.get("species_weight", 0))
            taur_length = request.args.get("taur_length")
            measurement_type = request.args.get("measurement_type", "vitruvian")

            taur_length_float = float(taur_length) if taur_length else None

            calculation_result = calculate_taur(
                anthro_height=anthro_height,
                species_height=species_height,
                species_length=species_length,
                species_tail_length=species_tail_length,
                taur_full_height=taur_full_height,
                species_weight=species_weight,
                taur_length=taur_length_float,
                measurement_type=measurement_type,
            )

            cleaned_calculation_result["AR"] = (
                f"{inches_to_feet_inches(calculation_result['AR'])} (Anthropic Ratio)"
            )
            cleaned_calculation_result["TH"] = (
                f"{inches_to_feet_inches(calculation_result['TH'])} (Taur Height)"
            )
            cleaned_calculation_result["TFH"] = (
                f"{inches_to_feet_inches(calculation_result['TFH'])} (Taur Full Height)"
            )
            cleaned_calculation_result["TL"] = (
                f"{inches_to_feet_inches(calculation_result['TL'])} (Taur Length)"
            )
            cleaned_calculation_result["TT"] = (
                f"{inches_to_feet_inches(calculation_result['TT'])} (Taur Tail Length)"
            )
            cleaned_calculation_result["TTo"] = (
                f"{inches_to_feet_inches(calculation_result['TTo'])} (Taur Torso Length)"
            )
            cleaned_calculation_result["THe"] = (
                f"{inches_to_feet_inches(calculation_result['THe'])} (Taur Head Length)"
            )
            cleaned_calculation_result["TW"] = (
                f"{calculation_result['TW']:.2f} lbs (Taur Weight)"
            )

        except (ValueError, TypeError) as e:
            logging.warning(f"Taur calculation error: {e}")
            calculation_result = None
            cleaned_calculation_result = None

    return render_template(
        "taur.html",
        species=filtered_species,
        species_data=species_data_map,
        calculation_result=cleaned_calculation_result,
        form_data=dict(request.args) if request.args else None,
    )


# For WSGI
def create_app():
    return app
