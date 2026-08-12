from flask import (
    Flask,
    render_template,
    request,
    send_file,
    send_from_directory,
    redirect,
    url_for,
    flash,
    jsonify,
)
import os
import logging

from werkzeug.middleware.proxy_fix import ProxyFix

from app.utils.calculate_heights import convert_to_inches
from app.utils.parse_data import (
    extract_characters,
    generate_characters_query_string,
    load_preset_characters,
    get_default_characters,
)
from app.utils.stats import StatsManager
from app.utils.art_paths import get_art_image_path
from app.utils.character import Character, normalize_hex_color
from app.utils.lineup import build_lineup_payload
from app.utils.species_lookup import list_species_names
from app.utils.paths import SPECIES_DATA_DIR

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
stats_manager = StatsManager("/var/size-diff/stats.db")

def _truthy_arg(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _settings_query(measure_ears: bool, scale_height: bool) -> str:
    settings_query = ""
    if not measure_ears:
        settings_query += "&measure_ears=false"
    if scale_height:
        settings_query += "&scale_height=true"
    return settings_query

# Painter's Canvas lives in node_modules (npm install from github)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAINTERS_CANVAS_ROOT = os.path.join(
    _PROJECT_ROOT, "node_modules", "painters-canvas"
)


# Sets up logging
if os.getenv("GIT_COMMIT", None) == None:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

# Load species list on startup
species_list = list_species_names()


def _as_https(url: str) -> str:
    if url.startswith("http://"):
        return "https://" + url[len("http://") :]
    return url


def _wants_json() -> bool:
    """Soft-nav requests use ?format=json (header is a backup)."""
    return (
        request.args.get("format") == "json"
        or request.headers.get("X-Size-Diff-Soft") == "1"
    )


def _lineup_state(characters_list, measure_ears: bool, scale_height: bool) -> dict:
    if not characters_list:
        characters_list = get_default_characters()
    characters_query = generate_characters_query_string(characters_list)
    return build_lineup_payload(
        characters_list,
        measure_ears=measure_ears,
        scale_height=scale_height,
        characters_query=characters_query,
    )


def _finish_lineup(characters_list, measure_ears: bool, scale_height: bool):
    """Redirect for normal browsers; JSON for soft-nav fetches."""
    payload = _lineup_state(characters_list, measure_ears, scale_height)
    if _wants_json():
        return jsonify(payload)
    return redirect(payload["pagePath"])


@app.route("/lib/painters-canvas/<path:filename>")
def painters_canvas_asset(filename):
    """Serve Painter's Canvas ESM from node_modules. Thats it. No vendor copy."""
    return send_from_directory(PAINTERS_CANVAS_ROOT, filename)


@app.route("/art/<path:rel_path>")
def serve_art(rel_path):
    """Serve art from art/."""
    file_path = get_art_image_path(rel_path)
    art_root = os.path.abspath("art")
    resolved = os.path.abspath(file_path)
    if not resolved.startswith(art_root + os.sep):
        return "Not found", 404
    if not os.path.isfile(resolved):
        return "Not found", 404
    return send_file(resolved, max_age=31536000)


@app.route("/api/lineup")
def api_lineup():
    """Lineup JSON for soft-nav redraws (same blob the page embeds)."""
    characters = request.args.get("characters", "")
    characters_list = extract_characters(characters)
    measure_ears = _truthy_arg(request.args.get("measure_ears"), default=True)
    scale_height = _truthy_arg(request.args.get("scale_height"), default=False)
    return jsonify(_lineup_state(characters_list, measure_ears, scale_height))


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
    preset_map = {}
    for p in presets:
        label = (
            f"{p['name'].replace('_', ' ').title()} --- "
            f"{p['species'].replace('_', ' ').title()}, {p['gender']}, "
            f"{p.get('description', '')}"
        )
        query = f"{p['species']},{p['gender']},{p['height']},{p['name']}"
        color = normalize_hex_color(p.get("color"))
        if color:
            query = f"{query},{color}"
        preset_map[label] = query

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
                if _wants_json():
                    return jsonify({"error": str(e)}), 400
                flash(str(e), "error")
                return redirect(url_for("index"))

            # Create a new Character instance and add to list
            new_character = Character(
                name=name, species=selected_species, height=anthro_height, gender=gender
            )
            characters_list.append(new_character)

        # Redirect with updated query string
        return _finish_lineup(characters_list, measure_ears, scale_height)

    # Could prolly move this somewhere else?
    settings_query = _settings_query(measure_ears, scale_height)

    payload = _lineup_state(characters_list, measure_ears, scale_height)
    lineup = payload["characters"]
    characters_query = payload["charactersQuery"]

    return render_template(
        "index.html",
        stats=stats,
        species=species_list,
        characters_list=characters_list,
        characters_query=characters_query,
        settings_query=settings_query,
        measure_ears=measure_ears,
        scale_height=scale_height,
        lineup=lineup,
        page_url=_as_https(request.url),
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
    updated_list = list(characters_list)
    if 0 <= index < len(updated_list):
        del updated_list[index]

    measure_ears = _truthy_arg(request.args.get("measure_ears"), default=True)
    scale_height = _truthy_arg(request.args.get("scale_height"), default=False)
    return _finish_lineup(updated_list, measure_ears, scale_height)


@app.route("/update/<int:index>", methods=["GET", "POST"])
def update_character(index):
    """Tweak one character's anthro height and/or color, keep the rest of the lineup."""
    characters = request.args.get("characters") or request.form.get("characters") or ""
    characters_list = extract_characters(characters)

    if not (0 <= index < len(characters_list)):
        if _wants_json():
            return jsonify({"error": "Could not find that character to update."}), 404
        flash("Could not find that character to update.", "error")
        return redirect(url_for("index"))

    src = request.form if request.method == "POST" else request.args

    feet_raw = src.get("feet")
    inches_raw = src.get("inches")
    if feet_raw is not None or inches_raw is not None:
        try:
            feet = float(feet_raw or 0)
            inches = float(inches_raw or 0)
            characters_list[index].height = max(1.0, feet * 12.0 + inches)
        except ValueError:
            if _wants_json():
                return jsonify({"error": "Height needs to be numbers (feet + inches)."}), 400
            flash("Height needs to be numbers (feet + inches).", "error")
            return redirect(request.referrer or url_for("index"))

    if "color" in src:
        characters_list[index].color = normalize_hex_color(src.get("color"))

    measure_ears = _truthy_arg(
        src.get("measure_ears", request.args.get("measure_ears")),
        default=True,
    )
    scale_height = _truthy_arg(
        src.get("scale_height", request.args.get("scale_height")),
        default=False,
    )
    return _finish_lineup(characters_list, measure_ears, scale_height)


# The about page
@app.route("/about")
def about():
    # Load a YAML file to display on the page
    yaml_file_path = SPECIES_DATA_DIR / "red_fox.yaml"
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
        # species,gender,height,name[,color]
        parts = preset_val.split(",")
        if len(parts) >= 4:
            characters_list.append(
                Character(
                    name=parts[3],
                    species=parts[0],
                    height=float(parts[2]),
                    gender=parts[1],
                    color=parts[4] if len(parts) >= 5 else None,
                )
            )
    measure_ears = _truthy_arg(request.args.get("measure_ears"), default=True)
    scale_height = _truthy_arg(request.args.get("scale_height"), default=False)
    return _finish_lineup(characters_list, measure_ears, scale_height)


# For WSGI
def create_app():
    return app
