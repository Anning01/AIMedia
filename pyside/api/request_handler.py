#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/11/02 18:17
# @file:request_handler.py
import requests
from PySide6.QtCore import QSettings
from requests.exceptions import Timeout

BASE_URL = "http://127.0.0.1:8001/api"  # 后台base API


class ApiRequest:
    def __init__(self, timeout=30):
        self.base_url = BASE_URL
        self.timeout = timeout

    def _build_headers(self):
        """构建请求头"""
        headers = {
            "Content-Type": "application/json",
        }
        settings = QSettings("AiMedia", "ai-media")
        token = settings.value("token", None)
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _handle_response(self, response):
        """统一处理响应"""
        print(f"3. 原始响应内容：{response.text}")  # 打印原始字符串（关键！看具体返回了什么）

        data = response.json()
        if data["code"] == 2000:
            return data["code"]
        if data["code"] == 0:
            return data.get("result")
        else:
            raise Exception(data["message"])

    def get(self, endpoint, params=None):
        """GET 请求"""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.get(
                url, headers=self._build_headers(), params=params, timeout=self.timeout
            )
            return self._handle_response(response)
        except Timeout:
            print("请求超时")
            return None

    def post(self, endpoint, data=None, json=None):
        """POST 请求"""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.post(
                url,
                headers=self._build_headers(),
                data=data,
                json=json,
                timeout=self.timeout,
            )
            return self._handle_response(response)
        except Timeout:
            print("请求超时")
            return None

    def put(self, endpoint, data=None, json=None):
        """PUT 请求"""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.put(
                url,
                headers=self._build_headers(),
                data=data,
                json=json,
                timeout=self.timeout,
            )
            return self._handle_response(response)
        except Timeout:
            print("请求超时")
            return None

    def patch(self, endpoint, data=None, json=None):
        """
        发送PATCH请求
        :param endpoint: API接口的具体路径
        :param data: PATCH请求的表单数据
        :param json: PATCH请求的JSON数据
        :return: 返回请求的响应
        """
        url = f"{self.base_url}/{endpoint}"

        try:
            response = requests.patch(
                url,
                headers=self._build_headers(),
                data=data,
                json=json,
                timeout=self.timeout,
            )
            return self._handle_response(response)
        except Timeout:
            print("请求超时")
            return None

    def delete(self, endpoint):
        """DELETE 请求"""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.delete(url, headers=self._build_headers(), timeout=self.timeout)
            return self._handle_response(response)
        except Timeout:
            print("请求超时")
            return None
