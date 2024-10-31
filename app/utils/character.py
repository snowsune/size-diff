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
        image: str = "",
        ears_offset: float = 0.0,
    ):
        self.name = name
        self.species = species
        self.height = height
        self.gender = gender

        # Image generation atributes
        self.image = image
        self.ears_offset = ears_offset

    def __repr__(self) -> str:
        return f"Character(name={self.name}, species={self.species}, gender={self.gender}, height={self.height}, image={self.image})"

    def to_query_string(self) -> str:
        """Converts the character attributes into a query string format."""
        return f"{self.species},{self.gender},{self.height},{self.name}"
