from flask import (
    Flask,
    render_template,
    request,
    send_file,
    send_from_directory,
    redirect,
    url_for,
    flash,
)
import os
import logging

from flask_caching import Cache
from functools import wraps

from app.utils.calculate_heights import convert_to_inches
from app.utils.parse_data import (
    extract_characters,
    generate_characters_query_string,
    remove_character_from_query,
    load_preset_characters,
    get_default_characters,
)
from app.utils.stats import StatsManager
from app.utils.art_paths import get_art_image_path
from app.utils.character import Character
from app.utils.lineup import build_lineup

app = Flask(__name__)
app.secret_key = os.urandom(24)
stats_manager = StatsManager("/var/size-diff/stats.db")

# Cache
cache = Cache(app, config={"CACHE_TYPE": "simple"})
cache_stats = {"hits": 0, "misses": 0}

# Painter's Canvas lives in node_modules (npm install from github)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAINTERS_CANVAS_ROOT = os.path.join(
    _PROJECT_ROOT, "node_modules", "painters-canvas"
)
OG_PLACEHOLDER = os.path.join(
    os.path.dirname(__file__), "static", "images", "og-placeholder.png"
)


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


@app.route("/lib/painters-canvas/<path:filename>")
def painters_canvas_asset(filename):
    """Serve Painter's Canvas ESM from node_modules. Thats it. No vendor copy."""
    return send_from_directory(PAINTERS_CANVAS_ROOT, filename)


@app.route("/art/<path:rel_path>")
def serve_art(rel_path):
    """Serve trimmed art from art/dist/, fall back to art/."""
    file_path = get_art_image_path(rel_path)
    art_roots = [
        os.path.abspath(os.path.join("art", "dist")),
        os.path.abspath("art"),
    ]

    resolved = os.path.abspath(file_path)
    if not any(resolved.startswith(root + os.sep) for root in art_roots):
        return "Not found", 404
    if not os.path.isfile(resolved):
        return "Not found", 404

    return send_file(resolved, max_age=31536000)


@app.route("/generate-image")
def generate_image():
    """
    Old OG preview URL. No Pillow, no lineup render.
    Just a static placeholder until real share exports exist.
    """
    return send_file(
        OG_PLACEHOLDER,
        mimetype="image/png",
        max_age=31536000,
        download_name="preview.png",
    )


@app.route("/", methods=["GET", "POST"])
def index():
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

    lineup = build_lineup(characters_list, use_species_scaling=scale_height)

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
        lineup=lineup,
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


# For WSGI
def create_app():
    return app
