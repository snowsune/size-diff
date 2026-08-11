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
        visual_height: Optional[float] = None,
        color: Optional[str] = None,
        composite: Optional[dict] = None,
    ):
        self.name = name
        self.species = species
        self.height = height
        self.gender = gender
        self.feral_height = feral_height

        # Image generation atributes
        self.image = image
        self.ears_offset = ears_offset
        # Optional override from the share URL; species yaml fills in later if missing
        self.color = normalize_hex_color(color)
        self.visual_height = visual_height
        # Optional Painter's Canvas attachAt recipe from species yaml
        self.composite = composite

    def get_species_name(self) -> str:
        return self.species.replace("_", " ").title()

    def __repr__(self) -> str:
        return f"Character(name={self.name}, species={self.species}, gender={self.gender}, height={self.height}, image={self.image})"

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
