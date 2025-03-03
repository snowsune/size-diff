from django.urls import path
from .views import IndexView, GenerateImageView, RemoveCharacterView, AboutView

urlpatterns = [
    path("", IndexView.as_view(), name="index"),
    path("generate-image/", GenerateImageView.as_view(), name="generate_image"),
    path("remove/<int:index>/", RemoveCharacterView.as_view(), name="remove_character"),
    path("about/", AboutView.as_view(), name="about"),
]
