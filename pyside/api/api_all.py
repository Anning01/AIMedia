#!/usr/bin/env python
# @Time    : 2024/12/9 14:08
# @Author  : DNQTeach
# @File    : api_all.py
from api.request_handler import ApiRequest


# 获取用户信息
def get_user():
    base_request = ApiRequest()
    response = base_request.get("user/users/")
    return response[0]


# 检查是会员否过期
def check_vip():
    base_request = ApiRequest()
    response = base_request.get("user/check_member/")
    return response


# 获取是否可以发
def token_not_full():
    base_request = ApiRequest()
    response = base_request.get("user/ai_article/")
    return response


# token上报
def token_report(data=None):
    """
    data = json.dumps(
    original_title,new_title,original_content,image_list,new_content,use_token
    )
    """
    base_request = ApiRequest()
    response = base_request.post("user/ai_article/", json=data)
    return response


# 创建新闻
def create_news(data=None):
    base_request = ApiRequest()
    return base_request.post("user/news/", json=data)


def get_news_list(params=None):
    base_request = ApiRequest()
    return base_request.get("user/news/", params=params)


def get_news_one(_id):
    base_request = ApiRequest()
    return base_request.get(f"user/news/{_id}")


# def create_news(data=None):
#     base_request = ApiRequest()
#     return base_request.post("user/news/", json=data)


def update_news(news_id, data):
    base_request = ApiRequest()
    return base_request.put(f"user/news/{news_id}/", json=data)


def partial_update_news(news_id, data):
    base_request = ApiRequest()
    return base_request.patch(f"user/news/{news_id}/", json=data)


def delete_news(task_id):
    base_request = ApiRequest()
    return base_request.delete(f"user/news/{task_id}/")


# 自媒体账号录入，查询
def create_account(data):
    base_request = ApiRequest()
    return base_request.post("user/accounts/", json=data)


def delete_account(account_id):
    base_request = ApiRequest()
    return base_request.delete(f"user/accounts/{account_id}/")


def get_account_list(params=None):
    base_request = ApiRequest()
    return base_request.get("user/accounts/", params=params)


def get_account_info(id):
    base_request = ApiRequest()
    return base_request.get(f"user/accounts/{id}/")


# 发布数量
def update_account(id, data):
    base_request = ApiRequest()
    return base_request.patch(f"user/accounts/{id}/", json=data)


# 获取通知
def get_notice():
    base_request = ApiRequest()
    return base_request.get("user/notice/")


# 获取通知
def get_gml_key():
    base_request = ApiRequest()
    return base_request.get("user/gml_key/")


def mark_as_read_notice(id):
    base_request = ApiRequest()
    return base_request.post(f"user/notice/{id}/mark_as_read/")
