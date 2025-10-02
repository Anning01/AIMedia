import base64
import json
from datetime import datetime, timedelta

import requests
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db.models import Sum
from django.http import JsonResponse
from django.shortcuts import render
from rest_framework.permissions import IsAuthenticated
import markdown
import os

from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

from ArticleManagePlus.settings import main_url
from apps.crawlers.get_article import GetArticle
from apps.crawlers.models import ClientVersionManager
from apps.users.models import AiArticle, Level
from utils import mixins, viewsets
from utils.response import success_response


# Create your views here.


class PlatformViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [
        IsAuthenticated,
    ]


class NewsCategoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [
        IsAuthenticated,
    ]


class PlatformCategoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    filterset_fields = ("platform__name",)
    permission_classes = [
        IsAuthenticated,
    ]


class ClientVersionManagerViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):

    def get_queryset(self):
        queryset = super().get_queryset()
        if queryset.exists():
            return queryset[:1]
        return queryset


class IndexView(APIView):

    def get(self, request):
        token = request.COOKIES.get('access_token')
        client = ClientVersionManager.objects.first()
        context = {}
        if client:
            context['download_link'] = client.download_link
        if token:
            jwt_auth = JWTAuthentication()
            try:
                validated_token = jwt_auth.get_validated_token(token)
                user = jwt_auth.get_user(validated_token)
            except:
                user = None
            context['user'] = user
        return render(request, "index.html", context)


class DocsView(APIView):

    def get(self, request):
        token = request.COOKIES.get('access_token')
        context = {}
        if token:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            context['user'] = user

        # 获取静态文件中的用户文档路径
        docs_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static', 'docs',
                                 'usedoc.md')

        try:
            with open(docs_path, 'r', encoding='utf-8') as f:
                markdown_content = f.read()
                # 转换 Markdown 为 HTML
                html_content = markdown.markdown(
                    markdown_content,
                    extensions=[
                        'markdown.extensions.extra',
                        'markdown.extensions.codehilite',
                        'markdown.extensions.toc',
                        'markdown.extensions.tables'
                    ]
                )
        except FileNotFoundError:
            html_content = '<h1>文档不存在</h1>'

        context['markdown_content'] = html_content
        return render(request, "docs.html", context)


class AboutView(APIView):

    def get(self, request):
        token = request.COOKIES.get('access_token')
        context = {}
        if token:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            context['user'] = user
        return render(request, 'about.html', context)


class OnlineAPIView(APIView):

    def get(self, request):
        token = request.COOKIES.get('access_token')
        context = {}
        if token:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            if user:
                # 查找创建日期为当天的
                date = datetime.now()
                # 查找AiArticle创建日期为当天的use_token相加总和
                total_tokens = AiArticle.objects.filter(user=user, enable=True, created_at__date=date.today()).aggregate(
                    total_tokens=Sum('use_token')
                )['total_tokens'] or 0
                context['create'] = True
                if total_tokens >= user.level.allow_token:
                    context['create'] = False
                context['user'] = user
        return render(request, 'online.html', context)

    def post(self, request):
        token = request.COOKIES.get('access_token')
        data = json.loads(request.body)
        # 获取url字段
        url = data.get('url')
        if token and url:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            if user:
                result = GetArticle(url).dispatch()
                if result:
                    return JsonResponse({'status': 'success', 'message': '文章获取成功', "result": result})
        return JsonResponse({'status': 'error', 'message': '链接提取错误'})


class QrCodeAPIView(APIView):
    def get(self, request):
        url = f"{main_url}api/users/wechat/login/"
        response = requests.get(url)
        data = response.json()
        return JsonResponse(data)


class CheckinView(APIView):

    def get(self, request):
        state = request.GET.get("state")
        url = f"{main_url}api/users/wechat/check/?state={state}"
        response = requests.get(url)
        data = response.json()
        if data['result']["status"] == "success":
            access = data["result"]["data"]["access"]
            # data = self.decode_jwt_without_secret(access)

            user = sync_user_data(access)
            # 手动颁发
            refresh = RefreshToken.for_user(user)
            data = {
                "result": {
                    "status": "success",
                    "data": {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh)
                    }
                },
                "code": 0,
                "message": ""
            }
            response = JsonResponse(data)
            response.set_cookie('access_token', str(refresh.access_token))
            return response
        else:
            return JsonResponse(data)

    def decode_jwt_without_secret(self, token):
        # 分割 token 成三部分 (header, payload, signature)
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid JWT token format")

        # 解码 payload
        payload = parts[1]
        padded_payload = payload + '=' * (-len(payload) % 4)  # 添加必要的填充字符
        decoded_payload = base64.urlsafe_b64decode(padded_payload)
        return json.loads(decoded_payload)


def sync_user_data(token):
    headers = {
        'Authorization': f'Bearer {token}',
    }
    response = requests.get(f"{main_url}api/users/user_info/", headers=headers)
    result = response.json()["result"]

    open_id = result.get("open_id")
    Users = get_user_model()
    user = Users.objects.filter(open_id=open_id).first()
    if user:
        user.username = result.get("username")
        user.nickname = result.get("nickname")
        user.avatar = result.get("avatar")
        user.phone = result.get("phone")
        user.save()
    else:
        now = datetime.now()
        level = Level.objects.filter(level=0).first()
        user = Users.objects.create(
            open_id=result.get("open_id"),
            nickname=result.get("nickname", ""),
            avatar=result.get("avatar", ""),
            phone=result.get("phone", ""),
            expiry_time=now + timedelta(days=3650),
            password=make_password('123456'),
            level=level,
        )
    return user
