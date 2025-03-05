import io
import random
import logging
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from django.http import HttpResponse
from django.views import View
from ..utils.parse_data import extract_characters
from ..utils.generate_image import render_image

executor = ThreadPoolExecutor(max_workers=4)


class GenerateImageView(View):
    def get(self, request):
        characters = request.GET.get("characters", "")
        characters_list = extract_characters(characters)

        measure_ears = request.GET.get("measure_ears", "false").lower() == "true"
        scale_height = request.GET.get("scale_height", "false").lower() == "true"

        size = int(request.GET.get("size", "400"))

        def generate_and_save():
            if len(characters_list) == 0:
                logging.warning("Asked to generate an empty image!")

                image = Image.new("RGB", (int(size * 1.4), size))
                pixels = image.load()
                for i in range(image.size[0]):
                    for j in range(image.size[1]):
                        pixels[i, j] = (
                            random.randint(0, 255),
                            random.randint(0, 255),
                            random.randint(0, 255),
                        )
            else:
                image = render_image(
                    characters_list,
                    size,
                    measure_to_ears=measure_ears,
                    use_species_scaling=scale_height,
                )

            img_io = io.BytesIO()
            image.save(img_io, "PNG")
            img_io.seek(0)
            return img_io

        future = executor.submit(generate_and_save)

        try:
            img_io = future.result(timeout=30)
        except TimeoutError:
            return HttpResponse("Image generation timed out", status=504)

        response = HttpResponse(img_io.read(), content_type="image/png")
        response["Content-Disposition"] = "inline; filename=preview.png"
        response["Cache-Control"] = "public, max-age=31536000"

        return response
