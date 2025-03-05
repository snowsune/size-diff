import os
from django.shortcuts import render
from django.views import View


class AboutView(View):
    def get(self, request):
        yaml_file_path = os.path.join("size_calculator/species_data", "red_fox.yaml")
        try:
            with open(yaml_file_path, "r") as yaml_file:
                yaml_content = yaml_file.read()
        except FileNotFoundError:
            yaml_content = "Error: YAML file not found."

        return render(request, "about.html", {"yaml_content": yaml_content})
