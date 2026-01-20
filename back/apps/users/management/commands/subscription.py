#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/11/13 22:30
# @file:crawler.py
from django.core.management import BaseCommand
from django.db import transaction

from apps.users.models import Subscription, SubscriptionContent


class Command(BaseCommand):
    help = "初始化会员订阅服务"

    def handle(self, *args, **options):
        # 检查是否已存在订阅数据
        if Subscription.objects.exists():
            self.stdout.write(self.style.SUCCESS("会员订阅服务已存在,无需初始化"))
            return

        with transaction.atomic():
            # 创建季度会员
            quarter_subscription = Subscription.objects.create(
                name="季度会员", original_price=717, price=237, duration=90
            )

            # 创建月度会员
            month_subscription = Subscription.objects.create(
                name="月度会员", original_price=299, price=99, duration=30
            )

            # 会员内容列表
            subscription_contents = [
                "90天无限使用",
                "17个新闻分类全覆盖",
                "200+优质新闻源",
                "5分钟内实时新闻监控",
                "支持头条号自动发布",
                "支持公众号自动发布",
                "支持百家号自动发布",
                "多种AI改写功能",
                "本地AI改写支持",
            ]

            # 批量创建季度会员内容
            quarter_content_objects = [
                SubscriptionContent(subscription=quarter_subscription, content=content)
                for content in subscription_contents
            ]
            SubscriptionContent.objects.bulk_create(quarter_content_objects)

            # 批量创建月度会员内容
            month_content_objects = [
                SubscriptionContent(subscription=month_subscription, content=content)
                for content in subscription_contents
            ]
            SubscriptionContent.objects.bulk_create(month_content_objects)

        self.stdout.write(self.style.SUCCESS("会员订阅服务初始化成功"))
