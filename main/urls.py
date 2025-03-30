from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("read_images/", include("read_images.urls")),
    path("admin/", admin.site.urls),
]
