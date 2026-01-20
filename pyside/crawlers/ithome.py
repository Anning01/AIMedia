#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/12/21 22:38
# @file:ithome.py
from datetime import datetime

import requests
from lxml import etree


class ITHome:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    def convert_time_str(self, time_str, date_str=None):
        """
        将时间字符串转换为标准的日期时间格式 %Y-%m-%d %H:%M:%S

        参数：
        - time_str (str): 形如 '22 48' 的时间字符串，表示 22 小时 48 分钟
        - date_str (str, optional): 形如 '2024-12-21' 的日期字符串。如果未提供，将使用当前日期

        返回：
        - str: 格式化后的日期时间字符串，例如 '2024-12-21 22:48:00'
        """
        try:
            # 如果提供了日期字符串，则解析它；否则使用当前日期
            if date_str:
                date_part = datetime.strptime(date_str, "%Y-%m-%d").date()
            else:
                date_part = datetime.now().date()

            # 分割时间字符串，提取小时和分钟
            hour, minute = map(int, time_str.strip().split())

            # 创建完整的 datetime 对象
            full_datetime = datetime.combine(date_part, datetime.min.time()).replace(
                hour=hour, minute=minute, second=0
            )

            # 格式化为指定的字符串格式
            formatted_datetime = full_datetime.strftime("%Y-%m-%d %H:%M:%S")

            return formatted_datetime
        except ValueError as ve:
            return f"输入格式错误: {ve}"
        except Exception as e:
            return f"发生错误: {e}"

    def get_news_list(self, url=None):
        response = requests.get(url, headers=self.headers)
        response.encoding = response.apparent_encoding
        content = response.text
        content_html = etree.HTML(content)
        # 初始化结果列表
        result = []

        news_items = content_html.xpath('//*[@id="nnews"]/div[3]/ul/li')
        for item in news_items:
            # 提取标题和链接
            title_elements = item.xpath(".//a")
            if title_elements:
                title = title_elements[0].text.strip()
                link = title_elements[0].get("href").strip()

                date_str = item.xpath("./b//text()")
                if date_str:
                    date_str = self.convert_time_str(date_str[0].strip())
            else:
                # 如果没有标题或链接，跳过该条目
                continue

            # 只添加有实际内容的条目
            if title and link and date_str:
                # 将数据添加到列表中
                result.append({"title": title, "article_url": link, "date_str": date_str})
        return result

    def get_news_info(self, news, category=None):
        article_url = news["article_url"]

        response = requests.get(article_url, headers=self.headers)
        response.encoding = response.apparent_encoding
        content = response.text
        content_html = etree.HTML(content)
        content_div = content_html.xpath('//*[@id="paragraph"]')[0]

        # 提取 p 标签的文本列表
        text_list = content_div.xpath('.//p[not(@class="ad-tips") and not(descendant::dir)]/text()')

        # 提取 img 标签的 src 列表
        data_original_list = content_div.xpath(
            './/p[not(@class="ad-tips") and not(descendant::dir)]//img/@data-original'
        )
        src_list = content_div.xpath(
            './/p[not(@class="ad-tips") and not(descendant::dir)]//img/@src'
        )

        # 组合结果，优先使用 data-original
        img_list = []
        for data_original, src in zip(data_original_list, src_list):
            if data_original and not data_original.strip().startswith("//"):
                img_url = data_original.strip()
            elif data_original and data_original.strip().startswith("//"):
                img_url = "https:" + data_original.strip()
            else:
                img_url = src.strip()
                if img_url.startswith("//"):
                    img_url = "https:" + img_url
            img_list.append(img_url)

        article_info = ""
        for item in text_list:
            article_info += item
            article_info += "\n"
        if not article_info:
            return None
        if len(article_info) < 50:
            return None
        dict_ = {
            "title": news["title"],
            "article_url": article_url,
            "cover_url": img_list[0] if img_list else "",
            "date_str": news["date_str"],
            "article_info": article_info.replace("\u3000", "").replace("\xa0", ""),
            "img_list": img_list,
            "category": category,
        }
        return dict_


# if __name__ == '__main__':
#     id_home = ITHome()
#     news_list = id_home.get_news_list('https://www.ithome.com/')
#     print(news_list)
#     info = id_home.get_news_info(news_list[0])
#     print(info)
