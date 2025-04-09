from django.urls import path
from . import views

app_name = "translator"

urlpatterns = [
    path("", views.index, name="index"),
    path("api/session/", views.session, name="session"),
]

