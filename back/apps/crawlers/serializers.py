from rest_framework import serializers

from apps.crawlers.models import ClientVersionManager, Platform, NewsCategory, PlatformCategory
from utils.serializers import BaseSerializer


class PlatformSerializer(BaseSerializer):
    class Meta:
        model = Platform
        fields = "__all__"


class NewsCategorySerializer(BaseSerializer):
    class Meta:
        model = NewsCategory
        fields = "__all__"


class PlatformCategorySerializer(BaseSerializer):
    class Meta:
        model = PlatformCategory
        fields = "__all__"


class ClientVersionManagerSerializer(BaseSerializer):

    class Meta:
        model = ClientVersionManager
        fields = "__all__"

