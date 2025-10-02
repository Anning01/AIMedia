from django.apps import AppConfig


class CrawlersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.crawlers"
    verbose_name = "爬虫管理"
