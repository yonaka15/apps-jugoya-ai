from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("read_images/", include("read_images.urls")),
    path("emoji_finder/", include("emoji_finder.urls")),
    path("accounts/", include("django.contrib.auth.urls")),
    path("qiita/", include("qiita.urls")),
    path("admin/", admin.site.urls),
]
