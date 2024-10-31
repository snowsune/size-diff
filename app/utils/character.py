class Character:
    """
    A well-defined representation of a character object.
    """

    def __init__(
        self, name: str, species: str, height: float, gender: str, image: str = ""
    ):
        self.name = name
        self.species = species
        self.height = height
        self.gender = gender
        self.image = image

    def __repr__(self) -> str:
        return f"Character(name={self.name}, species={self.species}, gender={self.gender}, height={self.height}, image={self.image})"

    def to_query_string(self) -> str:
        """Converts the character attributes into a query string format."""
        return f"{self.species},{self.gender},{self.height},{self.name}"
