from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.fields.reverse_related import ManyToOneRel

User = get_user_model()


class SmartModelAdmin(admin.ModelAdmin):
    list_per_page = 30  # 设置每页显示30条数据

    excluded_in_list_fields = (
        models.JSONField,
        models.TextField,
        models.BinaryField,
    )

    def filter_list_display(self, field):
        return (not isinstance(field, ManyToOneRel)) and (
            not isinstance(field, self.excluded_in_list_fields)
        )

    def get_list_display(self, request):
        fields = self.model._meta.get_fields()
        list_display = [field.name for field in fields if self.filter_list_display(field)]
        return list_display

    def get_list_filter(self, request):
        fields = self.model._meta.get_fields()
        list_filter = [
            field.name
            for field in fields
            if isinstance(field, models.BooleanField)
            or (hasattr(field, "choices") and field.choices)
        ]
        return list_filter

    def get_search_fields(self, request):
        fields = self.model._meta.get_fields()
        search_fields = [
            f"{field.name}__nickname"
            for field in fields
            if isinstance(field, models.ForeignKey) and field.related_model == User
        ]
        return search_fields
