#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/12/06 15:31
# @file:api_urls.py
from django.urls import path

from apps.users import views

from rest_framework import routers

router = routers.DefaultRouter()

router.register("accounts", views.AccountsViewSet, basename="accounts")
router.register("users", views.UsersViewSet, basename="users")
router.register("news", views.AccountNewsViewSet, basename="news")
router.register("notice", views.NoticeViewSet, basename="notice")


urlpatterns = [
    path("use_code/", views.ActivationCodeView.as_view(), name="use_code"),
    path("check_member/", views.CheckMember.as_view(), name="check_member"),
    path('ai_article/', views.AiArticleAPIView.as_view(), name='ai_article'),
    path('gml_key/', views.GLMAPIView.as_view(), name='gml_key'),
]


urlpatterns += router.urls
