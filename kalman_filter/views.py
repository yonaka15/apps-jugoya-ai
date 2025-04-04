from django.shortcuts import render


def index(request):
    """カルマンフィルタの説明とデモのメインページ"""
    return render(request, "kalman_filter/index.html")
