#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/11/13 22:30
# @file:crawler.py
from django.core.management import BaseCommand
from django.db import transaction

from apps.crawlers.models import Platform, NewsCategory, PlatformCategory
from apps.crawlers.crawler_data.classify import data as classify_data
from apps.crawlers.crawler_data.platform import data as platform_data


class Command(BaseCommand):
    help = "增量更新爬虫平台及分类"

    def handle(self, *args, **options):
        with transaction.atomic():
            # 更新分类数据
            self.update_news_categories()

            # 更新平台数据
            self.update_platforms()

            # 更新平台分类数据
            self.update_platform_categories()

        self.stdout.write(self.style.SUCCESS("数据同步完成"))

    def update_news_categories(self):
        """更新新闻分类数据"""
        existing_categories = {
            category.code: category for category in NewsCategory.objects.all()
        }
        new_categories = []
        for category in classify_data:
            if category["code"] in existing_categories:
                # 如果分类已存在，检查是否需要更新
                existing_category = existing_categories[category["code"]]
                if (
                    existing_category.name != category["name"]
                    or existing_category.children != category["children"]
                ):
                    existing_category.name = category["name"]
                    existing_category.children = category["children"]
                    existing_category.save()
            else:
                # 如果分类不存在，添加新的分类
                new_categories.append(
                    NewsCategory(
                        name=category["name"],
                        code=category["code"],
                        children=category["children"],
                    )
                )
        NewsCategory.objects.bulk_create(new_categories)
        self.stdout.write(
            self.style.SUCCESS(
                f"更新分类: {len(new_categories)} 条新增，{len(existing_categories)} 条已存在"
            )
        )

    def update_platforms(self):
        """更新平台数据"""
        existing_platforms = {
            platform.code: platform for platform in Platform.objects.all()
        }
        new_platforms = []
        for platform in platform_data:
            if platform["code"] in existing_platforms:
                # 如果平台已存在，检查是否需要更新
                existing_platform = existing_platforms[platform["code"]]
                if existing_platform.name != platform["name"]:
                    existing_platform.name = platform["name"]
                    existing_platform.save()
            else:
                # 如果平台不存在，添加新的平台
                new_platforms.append(
                    Platform(name=platform["name"], code=platform["code"])
                )
        Platform.objects.bulk_create(new_platforms)
        self.stdout.write(
            self.style.SUCCESS(
                f"更新平台: {len(new_platforms)} 条新增，{len(existing_platforms)} 条已存在"
            )
        )

    def update_platform_categories(self):
        """更新平台分类数据"""
        existing_platform_categories = {
            (pc.platform.code, pc.code): pc
            for pc in PlatformCategory.objects.select_related(
                "platform", "news_category"
            )
        }
        new_platform_categories = []
        for platform in platform_data:
            platform_instance = Platform.objects.get(code=platform["code"])
            if "children" in platform:
                for child in platform["children"]:
                    category_key = (platform["code"], child["code"])
                    if category_key in existing_platform_categories:
                        # 如果平台分类已存在，检查是否需要更新
                        existing_category = existing_platform_categories[category_key]
                        news_category = NewsCategory.objects.get(code=child["classify"])
                        if (
                            existing_category.name != child["name"]
                            or existing_category.news_category != news_category
                        ):
                            existing_category.name = child["name"]
                            existing_category.news_category = news_category
                            existing_category.save()
                    else:
                        # 如果平台分类不存在，添加新的平台分类
                        news_category = NewsCategory.objects.get(code=child["classify"])
                        new_platform_categories.append(
                            PlatformCategory(
                                platform=platform_instance,
                                name=child["name"],
                                code=child["code"],
                                news_category=news_category,
                            )
                        )
        PlatformCategory.objects.bulk_create(new_platform_categories)
        self.stdout.write(
            self.style.SUCCESS(
                f"更新平台分类: {len(new_platform_categories)} 条新增，{len(existing_platform_categories)} 条已存在"
            )
        )
