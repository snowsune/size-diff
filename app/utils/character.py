class Character:
    """
    Well defined storage of a character object
    """

    def __init__(self, _name: str, _species: str, _height: int, _image: str):
        self.name = _name
        self.species = _species
        self.height = _height
        self.image = _image

    def __repr__(self) -> str:
        return f"Character {self.species} with height {self.height}, name {self.name}"
