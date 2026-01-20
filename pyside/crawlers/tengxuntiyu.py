#!/usr/bin/env python
# @Time    : 2024/11/22 16:22
# @Author  : DNQTeach
# @File    : tengxuntiyu.py
import json
import re
from datetime import datetime

import requests


class TenXun:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    def get_news_list(self, code=None):
        sceneFlag = ["pc_208", "pc_100000", "pc_100000"]
        data = []
        for s in sceneFlag:
            if s == "pc_100008":
                page_id = "pc_100008_1502_0_88674"
                type_ = "type1502"
            elif s == "pc_100000":
                page_id = "pc_100000_1507_0_88605"
                type_ = "type1507"
            elif s == "pc_208":
                page_id = "pc_208_1502_0_88675"
                type_ = "type1502"
            params = {
                "sceneFlag": f"{s}",
                # 'qimei': '21deec4e70460884ccc663b60200000bd18b16',
            }
            response = requests.get(
                "https://matchweb.sports.qq.com/feeds/areaInfo", params=params, headers=self.headers
            )

            for item in response.json()["data"]["topItem"]:
                if item["id"] == page_id:
                    info = item[type_]["list"]
                    for item_info in info:
                        # 将时间戳转换为 datetime 对象
                        dt_object = datetime.fromtimestamp(int(item_info["createTime"]))
                        # 将 datetime 对象格式化为字符串
                        date_str = dt_object.strftime("%Y-%m-%d %H:%M:%S")
                        title = item_info["title"]
                        id = item_info["id"]
                        dict_ = {
                            "title": title,
                            "article_url": id,
                            "cover_url": item_info["pic"],
                            "date_str": date_str,
                        }
                        data.append(dict_)
        result = sorted(data, key=lambda x: x["date_str"], reverse=True)
        return result

    def get_news_info(self, new_data):
        article_id = new_data["article_url"]

        cover_url = new_data["cover_url"]
        title = new_data["title"]
        date_str = new_data["date_str"]
        params = {
            "tid": f"{article_id}",
            "page": "1",
        }
        response = requests.get(
            "https://shequweb.sports.qq.com/reply/listCite", params=params, headers=self.headers
        )
        try:
            content = response.json()
            content = content["data"]["topic"]["content"]

        except:
            # 使用正则表达式提取 JSON 部分
            match = re.search(r"\(({.*})\)", response.text)

            json_string = match.group(1)
            # 解析 JSON
            json_data = json.loads(json_string)
            # 输出解析后的 JSON 数据
            content = json_data["data"]["topic"]["content"]

        article_info = ""
        img_list = []
        for c in content:
            t = c["info"]
            if "https://sports3.gtimg.com/community" in t:
                img_list.append(t)
            else:
                article_info += t
                article_info += "\n"
        if len(article_info) > 0 and "不得转载" not in article_info:
            dict_ = {
                "title": title,
                "article_url": f"https://shequweb.sports.qq.com/reply/listCite?tid={article_id}&page=1",
                "cover_url": cover_url,
                "date_str": date_str,
                "article_info": article_info,
                "img_list": img_list,
            }
            return dict_


# a = TenXun()
# c = a.get_news_list('')
# # print(c)
# d = a.get_news_info(c[2])
# print(d)
