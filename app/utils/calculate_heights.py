import re

from app.utils.species_lookup import load_species_data
from app.utils.character import Character


def convert_to_inches(_input: str) -> float:
    """
    Accept values like 125cm, 4'11", 5", or 10" and return inches.
    Raises ValueError if input is invalid.
    """
    raw = str(_input).strip()
    raw = (
        raw.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2033", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u2032", "'")
    )
    if not raw:
        raise ValueError("Height is empty")

    cm_match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*cm", raw, re.IGNORECASE)
    if cm_match:
        return float(cm_match.group(1)) / 2.54

    m_match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*m", raw, re.IGNORECASE)
    if m_match:
        return (float(m_match.group(1)) * 100) / 2.54

    ft_in_match = re.fullmatch(r"(\d+)'\s*(\d+(?:\.\d+)?)\"?", raw)
    if ft_in_match:
        return int(ft_in_match.group(1), 10) * 12 + float(ft_in_match.group(2))

    feet_only_match = re.fullmatch(r"(\d+(?:\.\d+)?)'", raw)
    if feet_only_match:
        return float(feet_only_match.group(1)) * 12

    inches_only_match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*\"", raw)
    if inches_only_match:
        return float(inches_only_match.group(1))

    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"Invalid input format: {_input}") from exc


def _scaled_height(anthro_sizes, heights, anthro_height: float) -> float:
    """Degree-1 least squares fit (what numpy.polyfit used to do)."""
    n = len(anthro_sizes)
    if n == 0:
        return anthro_height
    if n == 1:
        return float(heights[0])
    mean_x = sum(anthro_sizes) / n
    mean_y = sum(heights) / n
    var = sum((x - mean_x) ** 2 for x in anthro_sizes)
    if var == 0:
        return mean_y
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(anthro_sizes, heights))
    return mean_y + (cov / var) * (anthro_height - mean_x)


def calculate_height_offset(
    character: Character, use_species_scaling=False
) -> Character:
    """
    Calculate display height from anthro height + species data.
    If use_species_scaling is True, use the interpolated 'feral' height.
    """

    species_data = load_species_data(character.species)

    try:
        gender_data = species_data[character.gender]
    except KeyError:
        gender_data = species_data["male"]
    anthro_height = character.height
    height_data = gender_data["data"]

    heights = [point["height"] for point in height_data]
    anthro_sizes = [point["anthro_size"] for point in height_data]

    feral_height = _scaled_height(anthro_sizes, heights, anthro_height)
    final_height = max(feral_height, 2) if use_species_scaling else anthro_height

    _char = Character(
        name=character.name,
        species=character.species,
        height=anthro_height,
        feral_height=final_height,
        gender=character.gender,
        image=gender_data["image"],
        color=getattr(character, "color", None),
        composite=gender_data.get("composite"),
    )

    if not _char.color:
        try:
            _char.color = gender_data["color"]
        except Exception:
            pass

    return _char
