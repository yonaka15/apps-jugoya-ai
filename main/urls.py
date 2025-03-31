from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("read_images/", include("read_images.urls")),
    path("accounts/", include("django.contrib.auth.urls")),
    path("admin/", admin.site.urls),
]
