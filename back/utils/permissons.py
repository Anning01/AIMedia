from django.utils import timezone
from rest_framework import permissions


class IsNotExpiredUser(permissions.BasePermission):
    """
    自定义权限类，用于检查用户是否过期
    """

    message = "您的账户已过期，请续费后继续使用"

    def has_permission(self, request, view):
        # 确保用户已登录
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        # 检查用户是否有过期时间字段
        if not hasattr(request.user, "expiry_time"):
            return True  # 如果用户没有过期时间字段，默认允许访问

        # 检查用户是否过期
        if request.user.expiry_time and request.user.expiry_time < timezone.now():
            return False

        return True
