from django.db import models

# Create your models here.


class Meta:
    # アプリケーションへのアクセス権限を定義
    permissions = [
        ("view_app", "Can view subtitle application"),
    ]
