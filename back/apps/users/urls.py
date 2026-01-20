from django.urls import path

from apps.users import views

urlpatterns = [
    path("dashboard/", views.dashboard, name="dashboard"),
    path("package/", views.package, name="package"),
    path("pay/", views.pay, name="pay"),
    path("wechat/login/", views.wechat_login, name="wechat_login"),
    path("wechat/callback/", views.wechat_callback, name="wechat_callback"),
    path("wx_notify/", views.wx_notify, name="wx_notify"),
    path("ai_article/", views.AiArticleView.as_view(), name="ai_article"),
]
