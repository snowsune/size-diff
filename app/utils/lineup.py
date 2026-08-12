"""Build the JSON blob the browser needs to draw a lineup."""

from urllib.parse import urlencode

from flask import url_for

from app.utils.calculate_heights import calculate_height_offset
from app.preview import EXPORT_HEIGHT, EXPORT_WIDTH


def _art_json_url(stem: str) -> str:
    """Species yaml stores art stems without .json; browser loads the sidecar."""
    return url_for("serve_art", rel_path=f"{stem}.json")


def _lineup_composite(recipe: dict | None) -> dict | None:
    """Turn yaml composite recipe into URLs the browser can fetch."""
    if not recipe or not recipe.get("base"):
        return None
    parts = []
    for part in recipe.get("parts") or []:
        art = part.get("art")
        joint = part.get("joint")
        if not art or not joint:
            continue
        parts.append({"joint": joint, "jsonUrl": _art_json_url(art)})
    return {"base": _art_json_url(recipe["base"]), "parts": parts}


def build_lineup(characters, use_species_scaling: bool = False) -> list[dict]:
    """
    Run species height math + art paths for each character.

    This is what gets stuffed into the page for Painter's Canvas.
    """
    lineup = []
    for char in characters:
        adjusted = calculate_height_offset(
            char, use_species_scaling=use_species_scaling
        )
        color = getattr(adjusted, "color", None)
        if color and not str(color).startswith("#"):
            color = f"#{color}"
        anthro = float(adjusted.height)
        feet = int(anthro // 12)
        inches = int(round(anthro % 12))
        if inches == 12:
            feet += 1
            inches = 0
        entry = {
            "name": adjusted.name,
            "species": adjusted.species,
            "gender": adjusted.gender,
            "heightInches": float(adjusted.feral_height),
            "anthroHeightInches": anthro,
            "feet": feet,
            "inches": inches,
            "imageUrl": url_for("serve_art", rel_path=adjusted.image),
            "color": color,
            "earsOffset": float(adjusted.ears_offset or 0),
        }
        composite = _lineup_composite(getattr(adjusted, "composite", None))
        if composite:
            entry["composite"] = composite
        lineup.append(entry)
    return lineup


def build_lineup_payload(
    characters,
    *,
    measure_ears: bool,
    scale_height: bool,
    characters_query: str,
) -> dict:
    """Same JSON the page embeds, plus a path for soft-nav pushState."""
    params = [("characters", characters_query)]
    if not measure_ears:
        params.append(("measure_ears", "false"))
    if scale_height:
        params.append(("scale_height", "true"))
    return {
        "characters": build_lineup(characters, use_species_scaling=scale_height),
        "measureToHead": measure_ears,
        "scaleHeight": scale_height,
        "charactersQuery": characters_query,
        "exportWidth": EXPORT_WIDTH,
        "exportHeight": EXPORT_HEIGHT,
        "pagePath": "/?" + urlencode(params),
        "previewPath": "/preview.png?" + urlencode(params),
    }
