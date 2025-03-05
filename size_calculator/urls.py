from django.urls import path
from .views.index import IndexView
from .views.character import RemoveCharacterView
from .views.image import GenerateImageView
from .views.about import AboutView

urlpatterns = [
    path("", IndexView.as_view(), name="index"),
    path("remove/<int:index>/", RemoveCharacterView.as_view(), name="remove_character"),
    path("generate-image/", GenerateImageView.as_view(), name="generate_image"),
    path("about/", AboutView.as_view(), name="about"),
]
