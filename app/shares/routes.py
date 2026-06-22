from urllib.parse import parse_qsl

from flask import jsonify, request, send_file
from werkzeug.datastructures import MultiDict

from app.shares.image_checks import validate_taur_png
from app.shares.storage import (
    canonicalize_query,
    check_rate_limit,
    save_taur_preview,
    share_id_for_query,
    taur_png_path,
)
from app.shares.taur_params import validate_taur_params


def register_share_routes(app, *, species_names: list[str] | None = None):
    if "upload_taur_share" in app.view_functions:
        return

    species_set = set(species_names or [])

    @app.route("/api/shares/taur", methods=["POST"])
    def upload_taur_share():
        client_ip = request.headers.get("X-Real-IP", request.remote_addr)
        if not check_rate_limit(client_ip):
            return jsonify({"error": "rate limit exceeded"}), 429

        query_string = (request.form.get("query") or "").strip().lstrip("?")
        if not query_string:
            return jsonify({"error": "missing query"}), 400

        pairs, err = validate_taur_params(
            MultiDict(parse_qsl(query_string)),
            species_set,
        )
        if err:
            return jsonify({"error": err}), 400

        upload = request.files.get("image")
        if upload is None:
            return jsonify({"error": "missing image"}), 400

        png_bytes = upload.read()
        image, err = validate_taur_png(png_bytes)
        if err:
            return jsonify({"error": err}), 400

        canonical = canonicalize_query(pairs)
        share_id = share_id_for_query(canonical)
        save_taur_preview(share_id, png_bytes)

        return jsonify({
            "share_id": share_id,
            "preview_url": f"/shares/taur/{share_id}.png",
            "width": image.size[0],
            "height": image.size[1],
        })

    @app.route("/shares/taur/<share_id>.png", methods=["GET"])
    def serve_taur_share(share_id):
        try:
            path = taur_png_path(share_id)
        except ValueError:
            return "Not found", 404

        if not path.is_file():
            return "Not found", 404

        response = send_file(
            path,
            mimetype="image/png",
            max_age=31536000,
        )
        response.headers["Cache-Control"] = "public, max-age=31536000"
        return response
