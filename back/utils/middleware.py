from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth.models import AnonymousUser
from urllib.parse import parse_qs
from rest_framework.exceptions import AuthenticationFailed


class JWTAuthMiddleware(BaseMiddleware):
    @database_sync_to_async
    def authenticate_user(self, token):
        jwt_auth = JWTAuthentication()
        try:
            # 验证 token，并返回用户和 token 数据
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            return user
        except AuthenticationFailed:
            return AnonymousUser()

    async def __call__(self, scope, receive, send):
        # 从 URL 查询参数中获取 token
        query_string = parse_qs(scope["query_string"].decode())
        token = query_string.get("token", [None])[0]

        if token:
            # 验证用户身份
            scope["user"] = await self.authenticate_user(token)
        else:
            # 未提供 token，设置为匿名用户
            scope["user"] = AnonymousUser()

        # 如果用户未认证，拒绝连接
        if scope["user"].is_anonymous:
            await send({"type": "websocket.close", "code": 4001})  # 自定义关闭代码
            return

        # 继续调用下一个中间件或处理程序
        return await super().__call__(scope, receive, send)
