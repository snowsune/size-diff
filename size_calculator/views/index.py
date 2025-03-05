import os
from django.shortcuts import render, redirect
from django.views import View
from django.contrib import messages
from ..utils.parse_data import extract_characters, generate_characters_query_string
from ..utils.character import Character
from ..utils.calculate_heights import convert_to_inches


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
            return redirect("index")

        new_character = Character(
            name=name, species=selected_species, height=anthro_height, gender=gender
        )
        characters_list.append(new_character)

        characters_query = generate_characters_query_string(characters_list)

        settings_query = f"&measure_ears=false" if not measure_ears else ""
        settings_query += f"&scale_height=true" if scale_height else ""

        return redirect(f"/?characters={characters_query}{settings_query}")
