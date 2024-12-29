
from datetime import datetime, timedelta
import requests
import json
from lxml import etree


def format_date(date):
    return date.strftime("%Y%m%d")


def hot_data(category, page,sessionid):
    cag = {
        "全部": "",
        "美食": "&sentence_tag=9000",
        "旅行": "&sentence_tag=10000",
        "站内玩法": "&sentence_tag=1004,1000,1002,1003,1001",
        "话题互动": "&sentence_tag=20001,20006,20000,20003,20005,20002,20",
        "娱乐": "&sentence_tag=2007,2000,2011,2012,2009,2010,2004,2005,2003,2008,2001,2002,2006",
        "社会": "&sentence_tag=4005,4006,4007,4003,4004,4000",
        "二次元": "&sentence_tag=13000",
        "交通": "&sentence_tag=23000",
        "亲子": "&sentence_tag=19000",
        "体育": "&sentence_tag=5002,5000,5001",
        "军事": "&sentence_tag=21000",
        "剧情": "&sentence_tag=18000",
        "动物萌宠": "&sentence_tag=8000",
        "天气": "&sentence_tag=22001,22002",
        "才艺": "&sentence_tag=17000",
        "文化教育": "&sentence_tag=14000",
        "时尚": "&sentence_tag=16000",
        "时政": "&sentence_tag=3000,3001,3002",
        "校园": "&sentence_tag=15000",
        "汽车": "&sentence_tag=11000",
        "游戏": "&sentence_tag=12000,12001",
        "科技": "&sentence_tag=6000",
        "财经": "&sentence_tag=7000",
    }

    cookies = {
        "sessionid_douhot": sessionid,
        "sessionid_ss_douhot": sessionid,
    }
    headers = {
        "authority": "douhot.douyin.com",
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "sec-ch-ua": '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    }
    # 获取当前日期
    today = datetime.now()

    # 获取昨天的日期
    yesterday = today - timedelta(days=1)

    # 格式化日期
    today_formatted = format_date(today)
    yesterday_formatted = format_date(yesterday)
    response = requests.get(
        f"https://douhot.douyin.com/douhot/v1/billboard/total?type=range&start_date={yesterday_formatted}&end_date={today_formatted}&page={page}&page_size=10{cag[category]}",
        cookies=cookies,
        headers=headers,
    )
    data = []
    i = 1
    for item in response.json()["data"]["objs"]:
        dict_ = {
            "sentence": item["sentence"],
            "sentence_id": item["sentence_id"],
            "sentence_tag_name": item["sentence_tag_name"],
            "hot_score": f'{round(int(item["hot_score"])/10000,2)}万',
            "video_count": item["video_count"],
            "num": i,
        }
        data.append(dict_)
        i += 1
    return data


def hot_item(sentence_id, num,sessionid):
    cookies = {
        "sessionid_douhot": sessionid,
        "sessionid_ss_douhot": sessionid,
    }

    headers = {
        "authority": "douhot.douyin.com",
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "sec-ch-ua": '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    }

    params = {
        "page": "1",
        "page_size": "30",
    }

    response = requests.get(
        f"https://douhot.douyin.com/douhot/v1/sentence/{sentence_id}/sentence_item",
        params=params,
        cookies=cookies,
        headers=headers,
    )
    video_list = []
    for item in response.json()["data"]["objs"]:
        item_duration = item["item_info"]["item_duration"] / 1000

        if item_duration >= 30 and item_duration <= 60 * 3:
            dict_ = {
                "url": item["item_info"]["item_url"],
                "cover": item["item_info"]["item_cover_url"],
                "title": item["item_info"]["item_title"],
                "id": item["item_info"]["item_id"],
            }
            video_list.append(dict_)
        if len(video_list) >= num:
            break
    return video_list


def wangyi(page):
    if page == 1:
        url = "https://news.163.com/special/cm_yaowen20200213/?callback=data_callback"
    elif page == 10:
        url = f"https://news.163.com/special/cm_yaowen20200213_{page}/?callback=data_callback"
    else:
        url = f"https://news.163.com/special/cm_yaowen20200213_0{page}/?callback=data_callback"

    data = []

    headers = {
        "accept": "*/*",
        "accept-language": "zh-CN,zh;q=0.9",
        # 'cookie': 'P_INFO=16602065002|1727678719|1|d90_client|00&99|null&null&null#gud&440100#10#0|&0|null|16602065002; _ntes_nuid=3ed19ddd4f140c77c8c3d4f50a726efa; _antanalysis_s_id=1729131629646; UserProvince=%u5168%u56FD; pver_n_f_l_n3=a; Hm_lvt_f8682ef0d24236cab0e9148c7b64de8a=1729133176; BAIDU_SSP_lcr=http://localhost:63342/; s_n_f_l_n3=115b86d864941cac1729140414621; Hm_lpvt_f8682ef0d24236cab0e9148c7b64de8a=1729144132; _ntes_origin_from=localhost%3A63342; ne_analysis_trace_id=1729148602678; vinfo_n_f_l_n3=115b86d864941cac.1.3.1729131629255.1729140047776.1729149045364',
        "referer": "https://news.163.com/",
        "sec-ch-ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "script",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }
    params = {
        "callback": "data_callback",
    }
    response = requests.get(url, params=params, headers=headers)
    res = response.text.replace("data_callback(", "")[0:-1]
    data_str = json.loads(res.rstrip(",\n ]").strip() + "]")

    for item in data_str:
        title = item["title"]
        article_url = item["docurl"]
        cover_url = item["imgurl"]
        if "video" not in article_url:
            try:
                headers = {
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                }
                content = requests.get(article_url, headers=headers)
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
                        "date_str": date_str,
                        "article_info": article_info,
                        "img_list": img_list,
                    }
                    data.append(dict_)
            except:
                pass
    data_sort = sorted(data, key=lambda x: x["date_str"], reverse=True)
    return data_sort
