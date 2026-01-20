#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2023/12/31 23:57
# @file:viewsets.py

from django.apps import apps
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from utils import mixins
from utils.pagination import PageNumberPagination


class ViewSet(viewsets.ViewSet):
    pass


class GenericViewSet(viewsets.GenericViewSet):
    def get_serializer_class(self):
        """
        根据方法找到定义的序列化类

        使用的优先级顺序：
        - 方法上定义的序列化类

            @decoretor_method(serializer_class=xxxx)
            def list(self, request, *args, **kwargs):
                return
        - 类中定义对应的方法序列化类

            list_serializer_class = aaaa
            create_serializer_class = bbbb

        - 全局定义的序列化类
            serializer_class = class_global_serializer_class
        """
        # 索引方法定义的序列化类
        handler = getattr(self, self.action)
        serializer_class = getattr(handler, "serializer_class", None)
        if serializer_class:
            return serializer_class

        # 类中定义的方法序列化类
        serializer_class = getattr(self, f"{self.action}_serializer_class", None)
        if serializer_class:
            return serializer_class
        serializer_name = self.__class__.__name__.replace("ViewSet", "Serializer")
        try:
            module = __import__(f"{self.get_app_label()}.serializers", fromlist=[serializer_name])
            return getattr(module, serializer_name)
        except (ImportError, AttributeError):
            raise ValueError(
                f"Serializer '{serializer_name}' does not exist in your_app_name.serializers."
            )

    def get_app_label(self):
        module_name_list = self.__module__.split(".")
        return f"{module_name_list[0]}.{module_name_list[1]}"

    def get_queryset(self):
        # 动态解析模型名称
        model_name = self.__class__.__name__.replace("ViewSet", "")
        app_label = self.__module__.split(".")[1]
        try:
            model = apps.get_model(app_label, model_name)
            return model.objects.all()
        except LookupError:
            raise ValueError(f"Model '{model_name}' does not exist in app '{app_label}'.")


class ReadOnlyModelViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, GenericViewSet):
    pass


class ModelViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    pass


class UserModelViewSet(ModelViewSet):
    # 拒绝未经身份验证的用户访问
    permission_classes = [
        IsAuthenticated,
    ]
    pagination_class = PageNumberPagination


class ManageModelViewSet(UserModelViewSet):
    # 拒绝未经身份验证的用户访问, 只有在职可以访问
    permission_classes = [
        IsAuthenticated,
        IsAdminUser,
    ]
