from django.db import models

from utils.models import BaseModel

# Create your models here.


class Platform(BaseModel):
    name = models.CharField(max_length=255, verbose_name="平台名称")
    code = models.CharField(max_length=255, unique=True, verbose_name="分类代码")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "平台"
        verbose_name_plural = verbose_name


class NewsCategory(BaseModel):
    name = models.CharField(max_length=255, verbose_name="分类名称")
    code = models.CharField(max_length=255, unique=True, verbose_name="分类代码")
    children = models.JSONField(default=list, verbose_name="子分类")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "新闻分类"
        verbose_name_plural = "新闻分类"


class PlatformCategory(BaseModel):
    platform = models.ForeignKey(
        Platform,
        on_delete=models.CASCADE,
        related_name="categories",
        verbose_name="所属平台",
    )
    name = models.CharField(max_length=255, verbose_name="平台分类名称")
    code = models.CharField(max_length=255, unique=True, verbose_name="分类代码")
    news_category = models.ForeignKey(
        NewsCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="platform_categories",
        verbose_name="对应新闻分类",
    )

    def __str__(self):
        return f"{self.platform.name} - {self.name}"

    class Meta:
        verbose_name = "平台分类"
        verbose_name_plural = "平台分类"


class ClientVersionManager(BaseModel):
    version = models.CharField(max_length=255, verbose_name="版本号")
    download_link = models.URLField(verbose_name="下载链接")
    content = models.TextField(verbose_name="更新内容")

    def __str__(self):
        return self.version

    class Meta:
        verbose_name = "客户端版本"
        verbose_name_plural = "客户端版本"
        ordering = ["-created_at"]
