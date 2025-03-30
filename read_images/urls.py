from django.urls import path

from . import views

app_name = "read_images"

urlpatterns = [
    path("", views.index, name="index"),
    path("query/", views.query, name="query"),
    path("answer/", views.answer, name="answer"),
]