import numpy as np

from PIL import Image, ImageDraw, ImageFont
from app.utils.caching import (
    generate_cache_key,
    load_image_from_cache,
    save_image_to_cache,
)
from app.utils.calculate_heights import calculate_height_offset, inches_to_feet_inches


def render_image(char_list, size):
    # Generate a unique cache key for this request
    cache_key = generate_cache_key(char_list, size)

    # Try loading from cache
    cached_image = load_image_from_cache(cache_key)
    if cached_image:
        return cached_image

    # Cache miss, so generate the image...
    height_adjusted_chars = []

    # Adjust each character's height based on the anthro height
    for char in char_list:
        adjusted_char = calculate_height_offset(char)
        # Adjusted char now returns Character objects
        height_adjusted_chars.append(adjusted_char)

    # Find the tallest character
    tallest_char = max(height_adjusted_chars, key=lambda x: x.height).height

    # Add 5% padding to the height
    render_height = int(tallest_char * 1.05)

    print(f"Render height is {render_height}, tallest char is {tallest_char}")

    # Determine if we should draw a line every 1' or every 1" based on the height
    draw_line_at_foot = (
        render_height > 22
    )  # If height is greater than this, use foot marks

    # Calculate the scale factor for each character based on the final render height
    scale_factors = [char.height / render_height for char in height_adjusted_chars]

    # Create an image with the desired width and height
    # Width is dynamically calculated based on the number of characters and padding
    total_width = (
        sum(int(size * scale) for scale in scale_factors) + (len(char_list) - 1) * 10
    )
    image = Image.new(
        "RGB", (total_width, size + 100), "white"
    )  # Added extra space for the names and heights
    draw = ImageDraw.Draw(image)

    # Font for text
    font = ImageFont.load_default()

    # Draw 1' or 1" lines
    if draw_line_at_foot:
        # Draw lines every 1 foot
        for foot in range(0, int(render_height / 12) + 1):
            y_pos = size - int((foot * 12) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)
    else:
        # Draw lines every 1 inch
        for inch in range(0, int(render_height) + 1):
            y_pos = size - int((inch) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)

    # Draw each character scaled for the image
    x_offset = 0
    for i, char in enumerate(height_adjusted_chars):
        # Load the character image
        char_img = Image.open(f"app/species_data/{char.image}")

        # Scale the image based on the calculated height
        scale_factor = scale_factors[i]
        char_height = int(size * scale_factor)
        char_width = int(char_img.width * (char_height / char_img.height))

        # Resize the character image
        char_img = char_img.resize((char_width, char_height), Image.LANCZOS)

        # Paste the character image onto the canvas
        y_offset = (
            size - char_height
        )  # Align character's bottom with the bottom of the image

        # Paste the character image onto the canvas, using the alpha channel as a mask
        image.paste(char_img, (x_offset, y_offset), char_img.convert("RGBA").split()[3])

        # Draw the character name above the image
        draw.text((x_offset, y_offset - 20), char.name, font=font, fill="black")

        # Draw the character height in feet and inches above the image
        height_ft_in = inches_to_feet_inches(char.height)
        draw.text((x_offset, y_offset - 40), height_ft_in, font=font, fill="black")

        # Update the x_offset for the next character
        x_offset += char_width + 10  # Add 10 pixels of padding between characters

    # Save the generated image to cache
    save_image_to_cache(cache_key, image)

    return image
