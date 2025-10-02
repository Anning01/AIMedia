#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/10/26 10:12
# @file:redis.py
import hashlib

import django_redis
from functools import wraps

from utils.response import error_response

rd = django_redis.get_redis_connection("default")


def rate_limit(user_limit=100, ip_limit=200):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(view, request, *args, **kwargs):
            ip = request.META.get("REMOTE_ADDR")
            user = request.user if request.user.is_authenticated else None
            user_id = user.id if user else "anonymous"

            # 生成 Redis 键
            user_ip_key = f"user_ip:{user_id}_{ip}"
            ip_key = f"ip:{ip}"

            # 获取当前的请求计数
            user_ip_count = int(rd.get(user_ip_key) or 0)
            ip_count = int(rd.get(ip_key) or 0)

            # 检查限流条件
            if user_ip_count >= user_limit:
                return error_response(
                    429,
                    {"error": "已超过用户和IP的请求限制", "result": False},
                )
            if ip_count >= ip_limit:
                return error_response(
                    429, {"error": "已超过IP的请求限制", "result": False}
                )

            # 增加计数
            rd.incr(user_ip_key)
            rd.incr(ip_key)

            # 设置键的到期时间（每天重置）
            reset_time = 24 * 60 * 60  # 24小时
            rd.expire(user_ip_key, reset_time)
            rd.expire(ip_key, reset_time)

            # 调用原始视图函数
            return view_func(view, request, *args, **kwargs)

        return _wrapped_view

    return decorator


def generate_cache_key(page, platform, category):
    # 生成缓存 key，使用请求参数并进行 hash 防止过长
    key_string = f"page={page}&platform={platform}&category={category}"
    return hashlib.md5(key_string.encode()).hexdigest()
