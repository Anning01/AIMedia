#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2024/12/11 04:38
# @Author  : DNQTeach
# @File    : spider_all.py
import json

from crawlers.pengpai import pengpai
from crawlers.wangyi import wangyi
from crawlers.zhongguoribao import ChineseDayNews
from crawlers.souhu import SouHu
from crawlers.tengxuxinwen import TenXuNews
from crawlers.tengxuntiyu import TenXun
from crawlers.ithome import ITHome
from crawlers.xinlang import XinLangGuoJi

def get_lsit(current_platform,code):
    if current_platform == "网易新闻":
        try:
            articles = wangyi().get_news_list(code)
        except Exception as e:
            print(f"获取网易新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "澎湃新闻":
        try:
            articles = pengpai().get_news_list(code)
        except Exception as e:
            print(f"获取澎湃新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "中国日报":
        try:
            articles = ChineseDayNews().get_news_list(code)
        except Exception as e:
            print(f"获取中国日报数据失败：{str(e)}")
            articles = []
    elif current_platform == "腾讯新闻":
        try:
            articles = TenXuNews().get_news_list(code)
        except Exception as e:
            print(f"获取腾讯新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "搜狐新闻":
        try:
            articles = SouHu().get_news_list(code)
        except Exception as e:
            print(f"获取搜狐新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "新浪国际":
        try:
            articles = XinLangGuoJi().get_news_list(code)
        except Exception as e:
            print(f"获取新浪国际数据失败：{str(e)}")
            articles = []
    elif current_platform == "IT之家":
        try:
            articles = ITHome().get_news_list(code)
        except Exception as e:
            print(f"获取IT之家数据失败：{str(e)}")
            articles = []
    else:
        try:
            articles = TenXun().get_news_list(code)
        except Exception as e:
            print(f"获取腾讯体育数据失败：{str(e)}")
            articles = []

    return articles



def get_lsit_info(current_platform,code):
    if current_platform == "网易新闻":
        try:
            articles = wangyi().get_news_info(code)
        except Exception as e:
            print(f"获取网易新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "澎湃新闻":
        try:
            articles = pengpai().get_news_info(code)
        except Exception as e:
            print(f"获取澎湃新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "中国日报":
        try:
            articles = ChineseDayNews().get_news_info(code)
        except Exception as e:
            print(f"获取中国日报数据失败：{str(e)}")
            articles = []
    elif current_platform == "腾讯新闻":
        try:
            articles = TenXuNews().get_news_info(code)
        except Exception as e:
            print(f"获取腾讯新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "搜狐新闻":
        try:
            articles = SouHu().get_news_info(code)
        except Exception as e:
            print(f"获取搜狐新闻数据失败：{str(e)}")
            articles = []
    elif current_platform == "新浪国际":
        try:
            articles = XinLangGuoJi().get_news_info(code)
        except Exception as e:
            print(f"获取新浪国际数据失败：{str(e)}")
            articles = []
    elif current_platform == "IT之家":
        try:
            articles = ITHome().get_news_info(code)
        except Exception as e:
            print(f"获取搜狐新闻数据失败：{str(e)}")
            articles = []
    else:
        try:
            articles = TenXun().get_news_info(code)
        except Exception as e:
            print(f"获取腾讯体育数据失败：{str(e)}")
            articles = []
    return articles


from datetime import datetime, timedelta


def is_less_than_2_minutes(datetime_str):
    """
    判断给定的 datetime 字符串是否小于2分钟

    :param datetime_str: 格式为 '%Y-%m-%d %H:%M:%S' 的 datetime 字符串
    :return: True 如果时间小于2分钟，否则 False
    """
    # 解析 datetime 字符串
    try:
        input_time = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        # print(datetime_str)
        # print("日期时间格式不正确，应为 '%Y-%m-%d %H:%M:%S'")
        return False

    # 获取当前时间
    current_time = datetime.now()

    # 计算时间差
    time_difference = current_time - input_time

    # 判断时间差是否小于2分钟
    if time_difference < timedelta(minutes=30):
        return True
    else:
        return False


def is_less_than_user_minutes(datetime_str):
    """
    判断给定的 datetime 字符串是否小于2分钟

    :param datetime_str: 格式为 '%Y-%m-%d %H:%M:%S' 的 datetime 字符串
    :return: True 如果时间小于2分钟，否则 False
    """
    try:
        file_path = 'opt.json'
        with open(file_path, 'r', encoding='utf-8') as file:
            content = json.load(file)
            publishNum = int(content['publishNum'])
    except:
        publishNum = 5

    # 解析 datetime 字符串
    try:
        # 原始时间字符串
        # 将 ISO 8601 格式的时间字符串转换为 datetime 对象
        dt_object = datetime.fromisoformat(datetime_str)

        # 将 datetime 对象格式化为字符串
        input_time = dt_object.strftime('%Y-%m-%d %H:%M:%S')
        input_time = datetime.strptime(input_time, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        # print(datetime_str)
        # print("日期时间格式不正确，应为 '%Y-%m-%d %H:%M:%S'")
        return False

    # 获取当前时间
    current_time = datetime.now()

    # 计算时间差
    time_difference = current_time - input_time

    # 判断时间差是否小于2分钟
    if time_difference < timedelta(minutes=publishNum):
        return True
    else:
        return False
