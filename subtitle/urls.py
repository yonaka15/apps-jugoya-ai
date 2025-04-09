from django.urls import path

from . import views

app_name = "subtitle"

urlpatterns = [
    path("", views.index, name="index"),
    path("viewer/", views.viewer, name="viewer"),
    path("api/session/", views.session, name="session"),
]
