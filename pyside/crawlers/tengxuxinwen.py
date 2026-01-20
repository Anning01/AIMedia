#!/usr/bin/env python
# @Time    : 2024/11/22 20:31
# @Author  : DNQTeach
# @File    : tengxuxinwen.py

import requests
from lxml import etree


class TenXuNews:
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    def get_news_list(self, code=None):
        json_data = {
            "base_req": {
                "from": "pc",
            },
            "forward": "2",
            "qimei36": "0_C47K1MESdC7T6",
            "device_id": "0_C47K1MESdC7T6",
            "flush_num": 1,
            "channel_id": code,
            "item_count": 12,
            "is_local_chlid": "0",
        }
        response = requests.post(
            "https://i.news.qq.com/web_feed/getPCList", headers=self.headers, json=json_data
        )
        data = []
        for item in response.json()["data"]:
            if item.get("sub_item"):
                pass
            else:
                data.append(
                    {
                        "title": item["title"],
                        "cover_url": item["pic_info"]["big_img"],
                        "date_str": item["publish_time"],
                        "article_url": f"https://news.qq.com/rain/a/{item['id']}",
                    }
                )
        result = sorted(data, key=lambda x: x["date_str"], reverse=True)
        return result

    def get_news_info(self, news_data):
        title = news_data["title"]
        cover_url = news_data["cover_url"]
        if isinstance(cover_url, list):
            cover_url = cover_url[0]
        date_str = news_data["date_str"]
        article_url = news_data["article_url"]
        response = requests.get(article_url, headers=self.headers)
        content_html = etree.HTML(response.text)
        content = content_html.xpath('//*[@id="article-content"]/div[2]/div/p')
        img_list = []
        article_info = ""
        for info in content:
            try:
                img = info.xpath(".//img/@src")
                if len(img) > 0:
                    img_list.append(img[0])
            except:
                pass
            txt = info.xpath(".//text()")
            for i in txt:
                article_info += i
                article_info += "\n"
        dict_ = {
            "title": title,
            "article_url": article_url,
            "cover_url": cover_url,
            "date_str": date_str,
            "article_info": article_info,
            "img_list": img_list,
        }

        return dict_


cls = {
    "经济": "news_news_finance",
    "科技": "news_news_tech",
    "娱乐": "news_news_ent",
    "国际": "news_news_world",
    "军事": "news_news_mil",
    "游戏": "news_news_game",
    "汽车": "news_news_auto",
    "房地产": "news_news_house",
    "健康": "news_news_antip",
    "教育": "news_news_edu",
    "文化": "news_news_history",
    "生活": "news_news_baby",
}


# a = TenXuNews()
# c= a.get_news_list('news_news_baby')
#
# d = a.get_news_info(c[0])
# print(d)
