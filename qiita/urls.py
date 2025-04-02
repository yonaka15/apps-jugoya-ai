from django.urls import path

from . import views

app_name = "qiita"

urlpatterns = [
    path("", views.index, name="index"),
    path("query/", views.query, name="query"),
]
