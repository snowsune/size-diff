from typing import Optional
import re

_HEX_COLOR_RE = re.compile(r"^#?[0-9a-fA-F]{6}$")


def normalize_hex_color(value: Optional[str]) -> Optional[str]:
    """Return RRGGBB (no hash) or None if it doesnt look like a color."""
    if not value:
        return None
    text = str(value).strip()
    if not _HEX_COLOR_RE.match(text):
        return None
    return text.lstrip("#").lower()


class Character:
    """
    A well-defined representation of a character object.
    """

    def __init__(
        self,
        name: str,
        species: str,
        height: float,
        gender: str,
        feral_height: float = 0.0,
        image: str = "",
        ears_offset: float = 0.0,
        color: Optional[str] = None,
        composite: Optional[dict] = None,
    ):
        self.name = name
        self.species = species
        self.height = height
        self.gender = gender
        self.feral_height = feral_height
        self.image = image
        self.ears_offset = ears_offset
        self.color = normalize_hex_color(color)
        self.composite = composite

    def to_query_string(self) -> str:
        """Converts the character attributes into a query string format."""
        height = self.height
        if isinstance(height, float) and height.is_integer():
            height = int(height)
        base = f"{self.species},{self.gender},{height},{self.name}"
        color = normalize_hex_color(self.color)
        if color:
            return f"{base},{color}"
        return base
