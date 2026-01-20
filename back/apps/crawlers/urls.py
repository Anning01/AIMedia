from django.urls import path

from apps.crawlers import views

urlpatterns = [
    path("index/", views.IndexView.as_view(), name="index"),
    path("docs/", views.DocsView.as_view(), name="docs"),
    path("about/", views.AboutView.as_view(), name="about"),
    path("online/", views.OnlineAPIView.as_view(), name="online"),
]
