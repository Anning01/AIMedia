#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2024/11/22 18:15
# @Author  : DNQTeach
# @File    : wangyi.py
import re
from datetime import datetime, timedelta
import requests
import json
from lxml import etree

class wangyi:
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }
    def get_news_list(self,code=None):
        url = code
        params = {
            "callback": "data_callback",
        }
        response = requests.get(url, params=params, headers=self.headers)
        res = response.text.replace("data_callback(", "")[0:-1]
        data_str = json.loads(res.rstrip(",\n ]").strip() + "]")
        result = []
        for item in data_str[:20]:
            if 'video' not in item["docurl"]:
                result.append({
                    "title": item["title"],
                    "article_url":  item["docurl"],
                    "cover_url": item["imgurl"],
                    "date_str": datetime.strptime(item['time'], '%m/%d/%Y %H:%M:%S').strftime('%Y-%m-%d %H:%M:%S')
                })
        result = sorted(result, key=lambda x: x["date_str"], reverse=True)
        return result

    def get_news_info(self, item, category=None):
        title = item["title"]
        article_url = item["article_url"]
        cover_url = item["cover_url"]
        dict_ = None
        if "video" not in article_url:
            try:
                content = requests.get(article_url, headers=self.headers)
                content_html = etree.HTML(content.text)
                try:
                    date_str = (
                        content_html.xpath('//*[@id="contain"]/div[2]/div[2]/text()')[0]
                        .strip()
                        .replace("　来源:", "")
                    )
                except:
                    date_str = (
                        content_html.xpath(
                            '//*[@id="container"]/div[1]/div[2]/text()[1]'
                        )[0]
                        .strip()
                        .replace("　来源:", "")
                    )
                date_str = re.search(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}', date_str).group()
                date_str = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                img_list = content_html.xpath('//*[@id="content"]/div[2]/p/img/@src')
                txt = content_html.xpath('//*[@id="content"]/div[2]/p')

                article_info = ""
                for item in txt:
                    t = item.xpath(".//text()")
                    for i in t:
                        article_info += i
                        article_info += "\n"
                if len(article_info) > 0 and "不得转载" not in article_info:
                    dict_ = {
                        "title": title,
                        "article_url": article_url,
                        "cover_url": cover_url,
                        "date_str": datetime.strftime(date_str, "%Y-%m-%d %H:%M:%S"),
                        "article_info": article_info,
                        "img_list": img_list,
                    }

            except:
                pass
        return dict_

url_list = {
    "时事热点":"https://news.163.com/special/cm_yaowen20200213/?callback=data_callback",
    "军事":"https://news.163.com/special/cm_war/?callback=data_callback",
    "社会":"https://news.163.com/special/cm_guonei/?callback=data_callback",
    "科技":"https://tech.163.com/special/00097UHL/tech_datalist.js?callback=data_callback",
    "娱乐":"https://ent.163.com/special/000381Q1/newsdata_movieidx.js?callback=data_callback",
    "经济":"https://money.163.com/special/00259K2L/data_stock_redian.js?callback=data_callback",
    "教育":"https://edu.163.com/special/002987KB/newsdata_edu_hot.js?callback=data_callback",
    "生活":"https://baby.163.com/special/003687OS/newsdata_hot.js?callback=data_callback"
}
# a = wangyi()
# c = a.get_news_list(url_list['科技'])
# print(c)
# d = a.get_news_info(c[1])
# print(d)