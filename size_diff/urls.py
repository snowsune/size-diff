from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("size_calculator.urls")),  # Include your app's URLs
]
