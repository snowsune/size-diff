import os
import time
import logging
from typing import List, Optional
from PIL import Image
from app.utils.character import Character

# Cache settings
CACHE_EXPIRATION_TIME = 1800  # 30 minutes in seconds
CACHE_DIR = "app/cache"
cache_index = {}
cache_hits = 0
cache_misses = 0

# Ensure the cache directory exists
os.makedirs(CACHE_DIR, exist_ok=True)


def generate_cache_key(char_list: List[Character], size: int, ears: str) -> str:
    """
    Generate a unique cache key based on a list of Character instances and image size.
    """
    # Create a key string using each Character's attributes and the requested size
    char_data = "-".join(
        [
            f"{char.species}_{char.gender}_{char.height}_{char.name}"
            for char in char_list
        ]
    )

    return f"{char_data}-{size}-{ears}"


def get_cache_performance() -> str:
    """
    Calculate and return cache performance as a percentage.
    """
    total_requests = cache_hits + cache_misses
    if total_requests == 0:
        return "0%"
    return f"{int((cache_hits / total_requests) * 100)}%"


def load_image_from_cache(cache_key: str) -> Optional[Image.Image]:
    """
    Load an image from cache if it exists and is not expired.
    """
    global cache_hits, cache_misses

    # Check if the image is in the cache and hasn't expired
    if cache_key in cache_index:
        file_path, timestamp = cache_index[cache_key]
        if time.time() - timestamp < CACHE_EXPIRATION_TIME:
            cache_hits += 1
            return Image.open(file_path)  # Load the image from file path
        else:
            # Expire the cache entry if it's too old
            logging.info(f"Expiring cache entry {cache_key}")
            os.remove(file_path)  # Remove the expired image file
            del cache_index[cache_key]
    else:
        logging.debug(f"Cache miss on {cache_key}")

    # Increment cache miss if not found or expired
    cache_misses += 1
    return None


def save_image_to_cache(cache_key: str, image: Image.Image):
    """
    Save an image to the cache and store its file path.
    """
    file_path = os.path.join(CACHE_DIR, f"{cache_key}.png")
    image.save(file_path, format="PNG")  # Save the image as a PNG file

    # Update the cache index with the file path and current timestamp
    cache_index[cache_key] = (file_path, time.time())
