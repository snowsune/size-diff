import numpy as np


def calculate_height_offsets(species_data, anthro_height):
    calculated_heights = {}

    # Iterate over each gender (male, female, etc.)
    for gender, data in species_data.items():
        height_data = data["data"]  # Extract the height data array

        heights = [point["height"] for point in height_data]
        anthro_sizes = [point["anthro_size"] for point in height_data]

        # Use regression (linear) to estimate the height for the given anthro size
        coef = np.polyfit(anthro_sizes, heights, 1)  # Linear regression
        estimated_height = np.polyval(coef, anthro_height)

        # Store the estimated height along with the image path
        calculated_heights[gender] = {
            "estimated_height": estimated_height,
            "image": data["image"],  # Get the image file path
        }

    return calculated_heights
