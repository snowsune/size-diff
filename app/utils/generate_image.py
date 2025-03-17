import os
import logging
import numpy as np


from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageOps

from app.utils.calculate_heights import calculate_height_offset, inches_to_feet_inches

font_path = "app/fonts/OpenSans-Regular.ttf"


def apply_color_shift(image, color):
    """Applies a color tint using the alpha channel as a mask."""
    if not color:
        return image  # No change if no color is provided

    # Convert hex color to RGB
    r, g, b = tuple(int(color[i : i + 2], 16) for i in (0, 2, 4))

    # Convert image to RGBA if it's not already
    image = image.convert("RGBA")

    # Extract alpha channel as a mask
    alpha = image.getchannel("A")

    # Create a solid color image
    color_overlay = Image.new("RGBA", image.size, (r, g, b, 255))

    # Apply the alpha mask so only visible areas are colored
    tinted_image = Image.composite(color_overlay, image, alpha)

    print("--------> Tinted image!")
    return tinted_image


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


def render_image(
    char_list,
    size,
    measure_to_ears: bool = True,
    use_species_scaling: bool = False,
):
    """
    Generates an image comparing character heights, with options to measure to the top of the ears.
    """

    # Limit size between 100 and 2048
    size = max(100, min(size, 2048))

    # Cache miss, so generate the image
    height_adjusted_chars = []

    # Step 1: Calculate scaled heights, adjusting for ears offset if applicable
    for char in char_list:
        adjusted_char = calculate_height_offset(
            char, use_species_scaling=use_species_scaling
        )

        # Calculate visual height by adding ears_offset percentage if applicable
        if measure_to_ears and adjusted_char.ears_offset != 0.0:
            # Increase height by a percentage factor so the top of the character appears taller
            adjusted_char.visual_height = adjusted_char.feral_height * (
                1 + adjusted_char.ears_offset / 100.0
            )
        else:
            # Default to actual character height if not measuring to ears
            adjusted_char.visual_height = adjusted_char.feral_height

        height_adjusted_chars.append(adjusted_char)

    # Step 2: Determine the render height based on the tallest character's visual height
    tallest_char_visual_height = max(
        char.visual_height for char in height_adjusted_chars
    )
    render_height = int(tallest_char_visual_height * 1.05)  # Add 5% padding

    # Decide line granularity based on height
    draw_line_at_foot = render_height > 22

    # Step 3: Calculate scale factors based on render height
    scale_factors = [
        char.visual_height / render_height for char in height_adjusted_chars
    ]

    # Step 4: Set dynamic font size based on image size
    font_size = int(size / 20)
    font = ImageFont.truetype(font_path, font_size)

    # Step 5: Padding between characters
    char_padding = font_size * 6

    # Step 6: Calculate total width and character dimensions, using visual height to determine image scaling
    total_width = 0
    character_dimensions = []
    for i, char in enumerate(height_adjusted_chars):
        scale_factor = scale_factors[i]

        # Scale character image height based on visual height, including ears offset
        char_img_height = int(size * scale_factor)
        char_img = Image.open(f"app/species_data/{char.image}")

        # Calculate width based on original aspect ratio
        char_img_width = int(char_img.width * (char_img_height / char_img.height))

        # Append the calculated dimensions
        character_dimensions.append((char_img_width, char_img_height))
        total_width += char_img_width + char_padding

    # Step 7: Create the base image with extra space for bottom padding
    bottom_padding = int(size / 10)
    image = Image.new("RGB", (total_width, size + bottom_padding), "white")
    draw = ImageDraw.Draw(image)

    # Step 8: Draw guideline lines at actual height
    if draw_line_at_foot:
        for foot in range(0, int(render_height / 12) + 1):
            y_pos = size - int((foot * 12) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)
    else:
        for inch in range(0, int(render_height) + 1):
            y_pos = size - int((inch) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)

    # Step 9: Place each character onto the canvas, scaled by visual height
    x_offset = 0
    for i, char in enumerate(height_adjusted_chars):
        char_img_width, char_img_height = character_dimensions[i]
        char_img = Image.open(f"app/species_data/{char.image}")

        # Apply color shift if `char.color` is set
        print(f"--------> COLOR WAS {char.color}")
        if char.color:
            char_img = apply_color_shift(char_img, char.color)

        # Resize the character image based on calculated dimensions
        char_img = char_img.resize((char_img_width, char_img_height), Image.LANCZOS)
        dominant_color = extract_dominant_color(char_img)

        if measure_to_ears and char.ears_offset != 0.0:
            # Draw the height line at the actual height (excluding ears offset)
            y_height_line = size - int((char.feral_height / render_height) * size)
            draw_dotted_line(
                draw,
                x_offset,
                x_offset + char_img_width,
                y_height_line,
                color=dominant_color,
                scale=size,
            )

        # Paste character image slightly above the height line to account for ears offset
        y_offset = size - char_img_height
        image.paste(char_img, (x_offset, y_offset), char_img.convert("RGBA").split()[3])

        # Draw character's name and height
        text_x = x_offset + int(1.1 * char_img_width)
        text_y = y_offset + int(0.1 * char_img_height)
        draw.text(
            (text_x, text_y - (font_size + 5)),
            char.name,
            font=font,
            fill=dominant_color,
        )
        height_ft_in = (
            f"{inches_to_feet_inches(char.feral_height)}\n{char.get_species_name()}"
            + (
                f"\n({inches_to_feet_inches(char.height)})"
                if char.height != char.feral_height
                else ""
            )
        )
        draw.text(
            (text_x, text_y),
            height_ft_in,
            font=font,
            fill=dominant_color,
        )

        x_offset += char_img_width + char_padding

    # This is ONLY to denote the development image
    if os.getenv("DEBUG", False):
        draw.text(
            (0, size),
            f"DEVELOPMENT VERSION {os.getenv('GIT_COMMIT', '')}  " * 20,
            font=font,
            fill=(128, 0, 30),
        )

    return image
