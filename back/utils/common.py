#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/11/21 15:46
# @file:common.py
import json
import random
import time

from utils.redis_cli import rd


def get_all_objects(key):
    """
    获取 Redis 哈希表中存储的所有对象。
    :return: 对象列表
    """
    all_data = rd.hgetall(key)
    return [json.loads(value) for value in all_data.values()]


def delete_object_by_key(key, field):
    """
    删除 Redis 哈希表中指定键的值。
    如果删除的是哈希表中最后一个键，则删除整个哈希表。

    :param key: Redis 哈希表的主键
    :param field: 要删除的字段（键）
    :return: 删除操作是否成功（True 或 False）
    """
    # 检查字段是否存在
    if rd.hexists(key, field):
        # 删除指定字段
        rd.hdel(key, field)

        # 检查哈希表是否已空
        if rd.hlen(key) == 0:
            rd.delete(key)  # 删除整个哈希表


def update_objects_with_cleanup(objects, key):
    """
    使用双缓冲更新 Redis 中的对象列表，保证数据一致性。
    :param key: Redis 中存储的哈希键。
    :param objects: 要更新的对象列表，需包含唯一的 `user_id` 字段。
    """
    if objects:
        temp_key = f"{key}_temp"

        # 写入临时键
        with rd.pipeline() as pipe:
            # 按user_id分组存储对象
            grouped_objects = {}
            for obj in objects:
                user_id = obj["user_id"]
                if user_id not in grouped_objects:
                    grouped_objects[user_id] = []
                grouped_objects[user_id].append(obj)

            # 将分组后的对象写入Redis
            for user_id, user_objects in grouped_objects.items():
                pipe.hset(
                    temp_key, user_id, json.dumps(user_objects)
                )  # 用user_id作为哈希表字段的key,存储该用户的所有对象
            pipe.execute()

        # 使用 rename 替换原键
        rd.rename(temp_key, key)
    else:
        # 检查键是否存在，避免不必要的删除操作
        if rd.exists(key):
            rd.delete(key)


def generate_order_no(order_header):
    time_ms = int(time.time() * 1000)
    time_str = time.strftime("%Y%m%d%H%M%S") + str(time_ms)[-3:]

    random_suffix = str(random.randint(100, 999))

    order_no = time_str + random_suffix
    return order_header + order_no
