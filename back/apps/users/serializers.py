from datetime import datetime

from apps.users.models import Accounts, AccountNews, AiArticle, Notice, UserNotice
from utils.serializers import BaseSerializer

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class AccountsSerializer(BaseSerializer):
    expiry_time = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")
    platform_value = serializers.CharField(
        source="get_platform_display", read_only=True
    )

    class Meta:
        model = Accounts
        fields = "__all__"
        read_only_fields = ("user",)
        extra_kwargs = {
            "user": {"required": False},
            "news_category": {"required": False},
        }

    def validate(self, attrs):
        if self.instance is None:
            # 获取当前用户已绑定的账号数量
            user = self.context["request"].user
            account_count = Accounts.objects.filter(user=user).exclude(status=4).count()
            if user.level.level == 0 and account_count >= 5:
                raise serializers.ValidationError("普通用户最多只能绑定5个账号")
        return attrs


class AccountNewsSerializer(BaseSerializer):
    date_str = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")
    account_name = serializers.CharField(source="account.nickname", read_only=True)
    account_uid = serializers.CharField(source="account.uid", read_only=True)
    status_value = serializers.CharField(source="get_status_display", read_only=True)
    account_platform_name = serializers.SerializerMethodField()

    class Meta:
        model = AccountNews
        fields = "__all__"
        extra_kwargs = {
            "account": {"required": False},
        }

    def validate(self, attrs):
        account = attrs.get("account")
        if account:
            if account.user != self.context['request'].user:
                raise serializers.ValidationError("只能创建或者修改自己绑定的账号！")
        return attrs

    def create(self, validated_data):
        account = validated_data.get("account")
        if account:
            today = datetime.now().date()
            existing_news_count = AccountNews.objects.filter(
                account=account, date_str__date=today
            ).count()
            if existing_news_count >= account.daily_publish_count:
                raise serializers.ValidationError("已达到设置每天发布数量上线，请在账户管理设置！")
        return super().create(validated_data)

    def get_account_platform_name(self, obj):
        # 调用模型中的方法或属性
        return obj.account.get_platform_display() if obj.account else None


class UsersSerializer(serializers.ModelSerializer):
    expiry_time = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    level = serializers.CharField(source="level.get_level_display", read_only=True)

    class Meta:
        model = User
        fields = ["id", "nickname", "avatar", "expiry_time", "level", "open_id"]


class AiArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiArticle
        fields = "__all__"
        extra_kwargs = {
            "user": {"required": False},
        }


class NoticeSerializer(BaseSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        fields = ['id', 'title', 'content', 'is_show', 'is_top', 'is_read', 'created_at', 'updated_at']

    def get_is_read(self, obj):
        user = self.context['request'].user
        return UserNotice.objects.filter(user=user, notice=obj, is_read=True).exists()