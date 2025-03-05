from django.shortcuts import redirect
from django.views import View
from ..utils.parse_data import extract_characters, remove_character_from_query


class RemoveCharacterView(View):
    def get(self, request, index):
        characters = request.GET.get("characters", "")
        characters_list = extract_characters(characters)

        updated_query = remove_character_from_query(characters_list, index)

        return redirect(f"/?characters={updated_query}")
