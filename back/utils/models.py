from django.db import models


# 创建一个带有创建时间和更新时间的父基类
class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    objects: models.Manager

    class Meta:
        abstract = True
