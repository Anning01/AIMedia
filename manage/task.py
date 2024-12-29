#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/10/20 12:54
# @file:task.py
from manage.common import BaseRequest


def get_task_list(params=None):
    base_request = BaseRequest()
    return base_request.get("task/tasks/", params=params)


def create_task_(data):
    base_request = BaseRequest()
    return base_request.post("task/tasks/", json=data)


def update_task(task_id, data):
    base_request = BaseRequest()
    return base_request.put(f"task/tasks/{task_id}/", json=data)


def partial_update_task(task_id, data):
    base_request = BaseRequest()
    return base_request.patch(f"task/tasks/{task_id}/", json=data)


def delete_task(task_id):
    base_request = BaseRequest()
    return base_request.delete(f"task/tasks/{task_id}/")


def get_task_info_list(params=None):
    base_request = BaseRequest()
    return base_request.get("task/task_info/", params=params)


def create_task_info_(data):
    base_request = BaseRequest()
    return base_request.post("task/task_info/", json=data)


def check_pub_time(uid):
    base_request = BaseRequest()
    return base_request.post(f"task/tasks/check_pub_time/", json={"uid": uid})
