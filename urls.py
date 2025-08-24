from django.urls import path
from . import views

app_name = "size_diff"

urlpatterns = [
    path("", views.SizeDiffView.as_view(), name="index"),
    path("calculator/", views.size_diff_calculator, name="calculator"),
]
