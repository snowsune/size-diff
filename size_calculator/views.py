import io
import os
import random
import logging

from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse
from django.views import View
from django.contrib import messages

from concurrent.futures import ThreadPoolExecutor

from .utils.species_lookup import load_species_data
from .utils.parse_data import (
    extract_characters,
    generate_characters_query_string,
    remove_character_from_query,
)
from .utils.character import Character
from .utils.generate_image import render_image
from .utils.calculate_heights import convert_to_inches


executor = ThreadPoolExecutor(max_workers=4)


class IndexView(View):
    def get(self, request):
        species_list = os.listdir("size_calculator/species_data")
        species_list = [
            f.replace(".yaml", "") for f in species_list if f.endswith(".yaml")
        ]

        characters = request.GET.get("characters", "")
        characters_list = extract_characters(characters)

        measure_ears = request.GET.get("measure_ears", "true") == "true"
        scale_height = request.GET.get("scale_height", "false") == "true"

        visitor_ip = request.META.get("HTTP_X_REAL_IP", request.META.get("REMOTE_ADDR"))

        if len(characters_list) == 0:
            characters_list = [
                Character(
                    name="Vixi", species="arctic_fox", height=62, gender="female"
                ),
                Character(name="Randal", species="red_fox", height=66, gender="male"),
                Character(name="Ky-Li", species="wolf", height=88, gender="female"),
            ]

        settings_query = f"&measure_ears=false" if not measure_ears else ""
        settings_query += f"&scale_height=true" if scale_height else ""

        # Pre-formatting
        species_list = [
            (specie, specie.replace("_", " ").title()) for specie in species_list
        ]

        return render(
            request,
            "index.html",
            {
                "stats": {},  # TODO: Stats!
                "species": species_list,
                "characters_list": characters_list,
                "characters_query": generate_characters_query_string(characters_list),
                "settings_query": settings_query,
                "measure_ears": measure_ears,
                "scale_height": scale_height,
                "version": os.getenv("GIT_COMMIT", "ERR_NO_REVISION"),
                "server_url": os.getenv(
                    "SERVER_URL", "https://nextcloud.kitsunehosting.net/"
                ),
            },
        )

    def post(self, request):
        selected_species = request.POST.get("species").replace(" ", "_")
        name = request.POST.get("name", "").replace(" ", "_")[:10]
        gender = request.POST.get("gender")
        height = request.POST.get("anthro_height")

        measure_ears = "measure_ears" in request.POST
        scale_height = "scale_height" in request.POST

        characters = request.GET.get("characters", "")
        characters_list = extract_characters(characters)

        if len(name) == 0 and len(height) == 0:
            return redirect("index")

        try:
            anthro_height = convert_to_inches(height)
        except Exception as e:
            messages.error(request, str(e))
            if os.getenv("DEBUG", False):
                raise e
            return redirect("index")

        new_character = Character(
            name=name, species=selected_species, height=anthro_height, gender=gender
        )
        characters_list.append(new_character)

        characters_query = generate_characters_query_string(characters_list)

        settings_query = f"&measure_ears=false" if not measure_ears else ""
        settings_query += f"&scale_height=true" if scale_height else ""

        return redirect(f"/?characters={characters_query}{settings_query}")


class RemoveCharacterView(View):
    def get(self, request, index):
        # Extract characters from query string
        characters = request.GET.get("characters", "")
        characters_list = extract_characters(characters)

        # Remove the character at the specified index
        updated_query = remove_character_from_query(characters_list, index)

        # Redirect to the updated URL with the character removed
        return redirect(f"/?characters={updated_query}")


class GenerateImageView(View):
    def get(self, request):
        characters = request.GET.get("characters", "")
        characters_list = extract_characters(characters)

        measure_ears = request.GET.get("measure_ears", "true") == "true"
        scale_height = request.GET.get("scale_height", "true") == "true"
        size = int(request.GET.get("size", "400"))

        def generate_and_save():
            if len(characters_list) == 0:
                logging.warning("Asked to generate an empty image!")

                # Generate an empty image
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
            img_io = future.result(timeout=30)  # Wait up to 30 seconds
        except TimeoutError:
            return HttpResponse("Image generation timed out", status=504)

        response = HttpResponse(img_io.read(), content_type="image/png")
        response["Content-Disposition"] = "inline; filename=preview.png"
        response["Cache-Control"] = "public, max-age=31536000"

        return response


class AboutView(View):
    def get(self, request):
        # Load a YAML file to display on the page
        yaml_file_path = os.path.join("size_calculator/species_data", "red_fox.yaml")
        try:
            with open(yaml_file_path, "r") as yaml_file:
                yaml_content = yaml_file.read()
        except FileNotFoundError:
            yaml_content = "Error: YAML file not found."

        return render(request, "about.html", {"yaml_content": yaml_content})
