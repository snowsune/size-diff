import numpy as np
from PIL import Image, ImageDraw, ImageFont
from app.utils.caching import (
    generate_cache_key,
    load_image_from_cache,
    save_image_to_cache,
)
from app.utils.calculate_heights import calculate_height_offset, inches_to_feet_inches

font_path = "app/fonts/OpenSans-Regular.ttf"


def extract_dominant_color(image):
    """
    Extracts the dominant color of an image by resizing it to 1x1 to get the average color.
    """
    small_img = image.resize((1, 1))
    return small_img.getpixel((0, 0))


def render_image(char_list, size):
    # Generate a unique cache key for this request
    cache_key = generate_cache_key(char_list, size)

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

    # Step 2: Find the tallest character and set render height with 5% padding
    tallest_char = max(height_adjusted_chars, key=lambda x: x.height).height
    render_height = int(tallest_char * 1.05)

    # Determine if we should draw a line every foot or inch based on the height
    draw_line_at_foot = render_height > 22

    # Step 3: Calculate the scale factor for each character based on the render height
    scale_factors = [char.height / render_height for char in height_adjusted_chars]

    # Step 4: Set a dynamic font size based on the image size
    font_size = int(size / 20)
    font = ImageFont.truetype(font_path, font_size)

    # Step 5: calculate the character padding
    char_padding = font_size * 6

    # Step 4: Calculate total width based on scaled character widths and padding
    total_width = (
        sum(int(size * scale) for scale in scale_factors)
        + (len(char_list) - 1) * char_padding
    )

    # Step 5: Create the base image with calculated dimensions
    image = Image.new("RGB", (total_width, size + 100), "white")  # Extra space for text
    draw = ImageDraw.Draw(image)

    # Step 6: Draw the guideline lines (1' or 1" based on height)
    if draw_line_at_foot:
        for foot in range(0, int(render_height / 12) + 1):
            y_pos = size - int((foot * 12) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)
    else:
        for inch in range(0, int(render_height) + 1):
            y_pos = size - int((inch) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)

    # Step 7: Draw each character onto the canvas, positioned and scaled properly
    x_offset = 0
    for i, char in enumerate(height_adjusted_chars):
        # Load character image
        char_img = Image.open(f"app/species_data/{char.image}")

        # Scale character image based on height
        scale_factor = scale_factors[i]
        char_height = int(size * scale_factor)
        char_width = int(char_img.width * (char_height / char_img.height))
        char_img = char_img.resize((char_width, char_height), Image.LANCZOS)

        # Paste character image onto the canvas, using alpha for transparency
        y_offset = size - char_height
        image.paste(char_img, (x_offset, y_offset), char_img.convert("RGBA").split()[3])

        # Extract the dominant color from the character image to use for text
        dominant_color = extract_dominant_color(char_img)

        # Calculate text positions
        text_x = x_offset + int(1.1 * char_width)  # Position over left shoulder
        text_y = y_offset + int(0.3 * char_height)

        # Draw character's name with dominant color
        draw.text((text_x, text_y), char.name, font=font, fill=dominant_color)

        # Draw height in feet and inches just above name
        height_ft_in = inches_to_feet_inches(char.height)
        draw.text(
            (text_x, text_y - (font_size + 5)),
            height_ft_in,
            font=font,
            fill=dominant_color,
        )

        # Update x_offset for next character, with padding
        x_offset += char_width + char_padding  # Increase padding between characters

    # Step 8: Save the generated image to cache
    save_image_to_cache(cache_key, image)

    return image
