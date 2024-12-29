#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/10/19 16:58
# @file:common.py
import requests

import streamlit as st


class BaseRequest:
    def __init__(self):
        """
        初始化BaseRequest类
        """
        self.base_url = "http://127.0.0.1:8000"
        self.headers = {"Content-Type": "application/json"}
        if "token" in st.session_state:
            token = st.session_state.token
            self.headers["Authorization"] = f"Bearer {token}"

    def get(self, endpoint, params=None):
        """
        发送GET请求
        :param endpoint: API接口的具体路径
        :param params: GET请求的查询参数
        :return: 返回请求的响应
        """
        url = f"{self.base_url}/{endpoint}"  # 确保URL拼接正确
        response = requests.get(url, headers=self.headers, params=params)
        return self._handle_response(response)

    def post(self, endpoint, data=None, json=None):
        """
        发送POST请求
        :param endpoint: API接口的具体路径
        :param data: POST请求的表单数据
        :param json: POST请求的JSON数据
        :return: 返回请求的响应
        """
        url = f"{self.base_url}/{endpoint}"
        response = requests.post(url, headers=self.headers, data=data, json=json)
        return self._handle_response(response)

    def put(self, endpoint, data=None, json=None):
        """
        发送PUT请求
        :param endpoint: API接口的具体路径
        :param data: PUT请求的表单数据
        :param json: PUT请求的JSON数据
        :return: 返回请求的响应
        """
        url = f"{self.base_url}/{endpoint}"
        response = requests.put(url, headers=self.headers, data=data, json=json)
        return self._handle_response(response)

    def patch(self, endpoint, data=None, json=None):
        """
        发送PATCH请求
        :param endpoint: API接口的具体路径
        :param data: PATCH请求的表单数据
        :param json: PATCH请求的JSON数据
        :return: 返回请求的响应
        """
        url = f"{self.base_url}/{endpoint}"
        response = requests.patch(url, headers=self.headers, data=data, json=json)
        return self._handle_response(response)

    def delete(self, endpoint, params=None):
        """
        发送DELETE请求
        :param endpoint: API接口的具体路径
        :param params: DELETE请求的查询参数
        :return: 返回请求的响应
        """
        url = f"{self.base_url}/{endpoint}"
        response = requests.delete(url, headers=self.headers, params=params)
        return self._handle_response(response)

    def _handle_response(self, response):
        """
        处理响应数据，判断是否请求成功
        :param response: requests库返回的响应对象
        :return: 返回解析后的JSON数据或响应状态
        """
        if response.status_code == 500:
            raise Exception("服务器内部错误")
        else:
            try:
                return response.json()
            except ValueError:
                return response.text


# 检查会员是否过期
def check_member():
    req = BaseRequest()
    response = req.get("user/check_member/")
    return response["result"], response["message"]
