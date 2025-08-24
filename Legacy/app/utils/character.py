from typing import Optional


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
    ):
        self.name = name
        self.species = species
        self.height = height
        self.gender = gender
        self.feral_height = feral_height

        # Image generation atributes
        self.image = image
        self.ears_offset = ears_offset
        self.color = None
        self.visual_height = visual_height

    def get_species_name(self) -> str:
        return self.species.replace("_", " ").title()

    def __repr__(self) -> str:
        return f"Character(name={self.name}, species={self.species}, gender={self.gender}, height={self.height}, image={self.image})"

    def to_query_string(self) -> str:
        """Converts the character attributes into a query string format."""
        return f"{self.species},{self.gender},{self.height},{self.name}"
