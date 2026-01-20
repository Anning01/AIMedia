# 注册 AccountNews 模型和新的 admin 类
from django.apps import apps
from django.contrib import admin
from django.utils.html import format_html

from apps.users.models import AccountNews, Users
from utils.admin import SmartModelAdmin

# Register your models here.
application = apps.get_app_config(__package__.split(".")[1])

for model in application.get_models():
    if model != AccountNews and model != Users:  # 排除 AccountNews 模型
        modeladmin = type("Model", (SmartModelAdmin,), {})
        admin.site.register(model, modeladmin)


class UsersAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "nickname",
        "avatar_display",
        "phone",
        "open_id",
        "level",
        "expiry_time",
        "user",
    )
    list_filter = ("level",)
    search_fields = ("nickname", "phone", "open_id")
    ordering = ("level", "id")
    readonly_fields = ("open_id",)

    def avatar_display(self, obj):
        if obj.avatar:
            return format_html('<img src="{}" width="100px" />', obj.avatar)
        return ""

    avatar_display.short_description = "头像"


class AccountNewsAdmin(admin.ModelAdmin):
    list_per_page = 30  # 设置每页显示30条数据

    # 添加其他自定义方法和配置
    list_display = (
        "id",
        "cover_url_display",
        "article_url_display",
        "account",
        "title",
        "status",
        "published_at",
        "created_at",
        "updated_at",
    )

    list_filter = (
        "status",
        "pub_date",
        "account",
        "account__user",
    )  # 添加状态、平台和发布日期过滤器

    def cover_url_display(self, obj):
        if obj.cover_url:
            return format_html('<img src="{}" width="100px" />', obj.cover_url)
        return ""

    cover_url_display.short_description = "封面图"

    def article_url_display(self, obj):
        if obj.article_url:
            return format_html(
                '<a href="{}" target="_blank">{}</a>', obj.article_url, obj.article_url
            )
        return ""

    article_url_display.short_description = "文章链接"


admin.site.register(Users, UsersAdmin)
admin.site.register(AccountNews, AccountNewsAdmin)
