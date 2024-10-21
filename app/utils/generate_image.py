import numpy as np

from PIL import Image, ImageDraw, ImageFont
from app.utils.calculate_heights import calculate_height_offset


def render_image(char_list, size):
    height_adjusted_chars = []

    # Adjust each character's height based on the anthro height
    for char in char_list:
        adjusted_char = calculate_height_offset(char)
        # Adjusted char has form like this [{'estimated_height': np.float64(639.9999999999995), 'image': 'f_fox.png'}]
        height_adjusted_chars.append(adjusted_char)

    # Find the tallest character
    tallest_char = max(height_adjusted_chars, key=lambda x: x["estimated_height"])[
        "estimated_height"
    ]

    # Add 5% padding to the height
    render_height = int(tallest_char * 1.05)

    # Determine if we should draw a line every 1' or every 1" based on the height
    draw_line_at_foot = (
        render_height > 48
    )  # If height is greater than 4 feet, use foot marks

    # Calculate the scale factor for each character based on the final render height
    scale_factors = [
        char["estimated_height"] / render_height for char in height_adjusted_chars
    ]

    # Create an image with the desired width and height
    # Width is dynamically calculated based on the number of characters and padding
    total_width = (
        sum(int(size * scale) for scale in scale_factors) + (len(char_list) - 1) * 10
    )
    image = Image.new("RGB", (total_width, size), "white")
    draw = ImageDraw.Draw(image)

    # Draw 1' or 1" lines
    if draw_line_at_foot:
        # Draw lines every 1 foot
        for foot in range(1, int(render_height / 12) + 1):
            y_pos = size - int((foot * 12) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)
    else:
        # Draw lines every 1 inch
        for inch in range(1, int(render_height) + 1):
            y_pos = size - int((inch) / render_height * size)
            draw.line([(0, y_pos), (total_width, y_pos)], fill="grey", width=1)

    # Draw each character scaled for the image
    x_offset = 0
    for i, char in enumerate(height_adjusted_chars):
        # Load the character image
        char_img = Image.open(f"app/species_data/{char['image']}")

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
        image.paste(char_img, (x_offset, y_offset))

        # Update the x_offset for the next character
        x_offset += char_width + 10  # Add 10 pixels of padding between characters

    return image
