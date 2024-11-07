import numpy as np
import logging

from PIL import Image, ImageDraw, ImageFont
from app.utils.caching import (
    generate_cache_key,
    load_image_from_cache,
    save_image_to_cache,
)
from app.utils.calculate_heights import calculate_height_offset, inches_to_feet_inches

font_path = "app/fonts/OpenSans-Regular.ttf"


def extract_dominant_color(image):
    """Extracts the dominant color of an image by resizing it to 1x1 to get the average color."""
    small_img = image.resize((1, 1))
    return small_img.getpixel((0, 0))


def draw_dotted_line(draw, x_start, x_end, y, color, scale=1024):
    """Draws a dotted line on the ImageDraw canvas."""
    x = x_start

    dash_length = int((40 * scale) / 1024)
    gap = int((20 * scale) / 1024)
    width = int((8 * scale) / 1024)

    while x < x_end:
        draw.line([(x, y), (min(x + dash_length, x_end), y)], fill=color, width=width)
        x += dash_length + gap


def render_image(char_list, size, measure_to_ears: bool = True):
    """
    There are a LOT of steps in the image generation process! And i keep adding more!
    """

    # Limit size between 100 and 2048
    size = max(100, min(size, 2048))

    # Generate a unique cache key for this request
    cache_key = generate_cache_key(char_list, size, measure_to_ears)

    # Try loading from cache
    cached_image = load_image_from_cache(cache_key)
    if cached_image:
        return cached_image

    # Cache miss, so generate the image
    height_adjusted_chars = []

    # Step 1: Adjust each character's height based on the anthro height
    for char in char_list:
        adjusted_char = calculate_height_offset(char)
        height_adjusted_chars.append(adjusted_char)

    # Step 2: Find the tallest character including any ear offsets
    if measure_to_ears:
        tallest_char = max(
            (char.height - char.ears_offset) for char in height_adjusted_chars
        )
    else:
        tallest_char = max(char.height for char in height_adjusted_chars)
    render_height = int(tallest_char * 1.05)  # Add 5% padding

    # Determine if we should draw a line every foot or inch based on the height
    draw_line_at_foot = render_height > 22

    scale_factors = [char.height / render_height for char in height_adjusted_chars]
    # Step 3: Calculate the scale factor for each character, adding ears_offset if applicable
    if measure_to_ears:
        scale_factors = [
            (char.height - char.ears_offset) / render_height
            for char in height_adjusted_chars
        ]
    else:
        scale_factors = [char.height / render_height for char in height_adjusted_chars]

    # Step 4: Set a dynamic font size based on the image size
    font_size = int(size / 20)
    font = ImageFont.truetype(font_path, font_size)

    # Step 5: Set padding between characters
    char_padding = font_size * 6

    # Step 6: Calculate the total width by scaling each character's height and keeping original aspect ratio
    total_width = 0
    character_dimensions = []
    for i, char in enumerate(height_adjusted_chars):
        scale_factor = scale_factors[i]
        char_height = int(size * scale_factor)  # Scale character height
        char_img = Image.open(f"app/species_data/{char.image}")

        # Calculate width based on original aspect ratio
        char_width = int(char_img.width * (char_height / char_img.height))

        # Append the calculated dimensions
        character_dimensions.append((char_width, char_height))

        # Add to total width including padding between characters
        total_width += char_width + char_padding

    # Dont remove the last char padding width (thats where the text goes)
    # total_width -= char_padding

    # Step 7: Create the base image with calculated dimensions
    image = Image.new(
        "RGB", (total_width, size + 100), "white"
    )  # 100px extra space for text
    draw = ImageDraw.Draw(image)

    # Step 8: Draw the guideline lines (1' or 1" based on height)
    if draw_line_at_foot:
        for foot in range(0, int(render_height / 12) + 1):
            y_pos = size - int((foot * 12) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)
    else:
        for inch in range(0, int(render_height) + 1):
            y_pos = size - int((inch) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)

    # Step 9: Draw each character onto the canvas, positioned and scaled properly
    x_offset = 0
    for i, char in enumerate(height_adjusted_chars):
        char_width, char_height = character_dimensions[i]
        char_img = Image.open(f"app/species_data/{char.image}")
        char_img = char_img.resize((char_width, char_height), Image.LANCZOS)
        dominant_color = extract_dominant_color(char_img)

        # If there is an ear offset, draw the dotted line at the correct height
        if char.ears_offset != 0.0 and measure_to_ears:
            # This line is drawn right at the height mark
            y_ears_line = size - int((char.height / render_height) * size)
            draw_dotted_line(
                draw,
                x_offset,
                x_offset + char_width,
                y_ears_line,
                color=dominant_color,
                scale=size,
            )

        # Paste character image
        y_offset = size - char_height
        image.paste(char_img, (x_offset, y_offset), char_img.convert("RGBA").split()[3])

        # Draw text
        text_x = x_offset + int(1.1 * char_width)
        text_y = y_offset + int(0.1 * char_height)
        draw.text((text_x, text_y), char.name, font=font, fill=dominant_color)
        height_ft_in = inches_to_feet_inches(char.height)
        draw.text(
            (text_x, text_y - (font_size + 5)),
            height_ft_in,
            font=font,
            fill=dominant_color,
        )

        x_offset += char_width + char_padding

    # Step 10: Save the generated image to cache
    save_image_to_cache(cache_key, image)

    return image
