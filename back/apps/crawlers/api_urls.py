#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/12/06 15:31
# @file:api_urls.py
from django.urls import path
from rest_framework import routers

from apps.crawlers import views

router = routers.DefaultRouter()

router.register("platform", views.PlatformViewSet, basename="platform")
router.register("news_category", views.NewsCategoryViewSet, basename="news_category")
router.register("platform_category", views.PlatformCategoryViewSet, basename="platform_category")
router.register("client_version", views.ClientVersionManagerViewSet, basename="client_version")

urlpatterns = [
    path("qr_code/", views.QrCodeAPIView.as_view(), name="qr_code"),
    path("checkin/", views.CheckinView.as_view(), name="checkin"),
]

urlpatterns += router.urls
