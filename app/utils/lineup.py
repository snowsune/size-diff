"""Build the JSON blob the browser needs to draw a lineup."""

from flask import url_for

from app.utils.calculate_heights import calculate_height_offset


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
        lineup.append(
            {
                "name": adjusted.name,
                "species": adjusted.species,
                "heightInches": float(adjusted.feral_height),
                "anthroHeightInches": float(adjusted.height),
                "imageUrl": url_for("serve_art", rel_path=adjusted.image),
                "color": color,
                "earsOffset": float(adjusted.ears_offset or 0),
            }
        )
    return lineup
