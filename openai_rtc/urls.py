from django.urls import path
from . import views

app_name = "openai_rtc"

urlpatterns = [
    path("", views.index, name="index"),
    path("api/session/", views.session, name="session"),
]
