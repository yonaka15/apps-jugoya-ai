from django.urls import path
from . import views

app_name = 'kalman_filter'

urlpatterns = [
    path('', views.index, name='index'),
]
