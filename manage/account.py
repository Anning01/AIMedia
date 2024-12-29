#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/10/20 12:03
# @file:account.py
from manage.common import BaseRequest


def get_account_list(params=None):
    base_request = BaseRequest()
    return base_request.get("user/account/", params=params)


def create_account(data):
    base_request = BaseRequest()
    return base_request.post("user/account/", json=data)


def delete_account(account_id):
    base_request = BaseRequest()
    return base_request.delete(f"user/account/{account_id}/")


def use_activation_code(code):
    base_request = BaseRequest()
    return base_request.post(f"user/use_code/", json={"code": code})
