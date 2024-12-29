#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/10/19 16:57
# @file:user.py
from manage.common import BaseRequest
from utils.local_storage import save_data


def register(phone, password, password2):
    if len(phone) != 11:
        return False, "请输入正确手机号码"
    else:
        if password != password2:
            return False, "两次输入的密码不一致"
        else:
            base_request = BaseRequest()
            response = base_request.post(
                "user/register/",
                json={"phone": phone, "password": password, "password2": password2},
            )
            access = response.get("access")
            if access:
                save_data("token", access)
                return True, "注册成功"
            else:
                return False, response


def login(phone, password):
    base_request = BaseRequest()
    response = base_request.post(
        "user/login/", json={"phone": phone, "password": password}
    )
    access = response.get("access")
    if access:
        save_data("token", access)
        return True, "登录成功"
    else:
        return False, response


def get_user():
    base_request = BaseRequest()
    response = base_request.get("user/user/")
    return response[0]


if __name__ == "__main__":
    # reg = register("12345678901", "123456", "123456")
    log = login("12345678901", "123456")
