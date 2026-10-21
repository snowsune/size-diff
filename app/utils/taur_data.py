import json
import os

_TAUR_DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "taur_calculator", "taur_data.json"
)


def load_taur_data():
    with open(_TAUR_DATA_PATH, encoding="utf-8") as f:
        return json.load(f)
