#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/12/06 20:14
# @file:get_article.py
import ast
import re
from urllib.parse import urlparse

import requests
from lxml import etree


class GetArticle:
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }

    def __init__(self, url):
        self.url = url

    def extract_domain_from_url(self):
        # 解析 URL
        parsed_url = urlparse(self.url)

        # 获取域名（netloc 属性包含了端口号（如果有的话），但通常我们不需要它）
        domain = parsed_url.netloc

        # 如果需要，可以进一步处理 domain 以去掉端口号
        # 例如，使用 split(':') 的方式，但这里我们假设端口号不是必需的

        return domain

    def dispatch(self):
        domain = self.extract_domain_from_url()
        if domain == "www.163.com":
            return self.wangyi()
        elif domain == "www.thepaper.cn":
            return self.pengpai()
        elif domain == "www.sohu.com":
            return self.souhu()
        elif domain == "news.qq.com":
            return self.tenxun()
        elif "chinadaily.com.cn" in domain:
            return self.chinese_day()
        else:
            return None

    def wangyi(self):
        dict_ = None
        if "video" not in self.url:
            content = requests.get(self.url, headers=self.headers)
            content_html = etree.HTML(content.text)
            title = content_html.xpath('//*[@id="contain"]/div[2]/h1//text()')
            if not title:
                title = content_html.xpath('//*[@id="container"]/div[1]/h1//text()')
            img_list = content_html.xpath('//*[@id="content"]/div[2]/p/img/@src')
            txt = content_html.xpath('//*[@id="content"]/div[2]/p')
            article_info = ""
            for item in txt:
                t = item.xpath(".//text()")
                for i in t:
                    article_info += i
                    article_info += "\n"
            dict_ = {
                "title": title[0],
                "article_info": article_info,
                "img_list": img_list,
            }
        return dict_

    def pengpai(self):
        content = requests.get(self.url, headers=self.headers).text
        content_html = etree.HTML(content)
        img_list = content_html.xpath('//*[@id="__next"]/main/div[4]/div[1]/div[1]/div/div[2]/img/@src')

        title = content_html.xpath('//*[@id="__next"]//h1/text()')
        txt = content_html.xpath('//*[@id="__next"]/main/div[4]/div[1]/div[1]/div/div[2]/p')
        article_info = ""
        for item in txt:
            t = item.xpath(".//text()")
            for i in t:
                article_info += i
                article_info += "\n"
        if not article_info:
            return None
        dict_ = {
            "title": title[0],
            "article_info": article_info,
            "img_list": img_list,
        }
        return dict_

    def chinese_day(self):
        content = requests.get(self.url, headers=self.headers).text
        content_html = etree.HTML(content)
        content_div = content_html.xpath('//div[@id="Content"]')[0]

        # 提取 p 标签的文本列表
        text_list = content_div.xpath('.//p/text()')
        title = content_html.xpath('//*[@id="all"]/div[4]/div[1]/h1//text()')
        if not title:
            title = content_html.xpath('/html/body/div[5]/div[1]/div/h1//text()')

        # 提取 img 标签的 src 列表
        img_list = content_div.xpath('.//img/@src')
        img_list = ['https:' + i for i in img_list]
        article_info = ""
        for item in text_list:
            article_info += item
            article_info += "\n"
        if not article_info:
            return None
        dict_ = {
            "title": title[0] if title else "",
            "article_info": article_info,
            "img_list": img_list,
        }
        return dict_

    def souhu(self):
        content = requests.get(self.url, headers=self.headers).text
        content_html = etree.HTML(content)
        article_element = content_html.xpath('//article[@id="mp-editor"]')[0]
        # 移除 id="backsohucom" 的整个元素
        for backsohu_element in article_element.xpath('.//a[@id="backsohucom"]'):
            backsohu_element.getparent().remove(backsohu_element)

        # 提取文本列表，过滤掉“责任编辑”内容
        text_list = [
            p.xpath('string(.)').strip()
            for p in article_element.xpath('.//p[not(contains(., "责任编辑"))]')
            if p.xpath('string(.)').strip()
        ]

        strings = content_html.xpath('//*[@id="article-container"]/div[2]/div[1]/div/div[1]//h1//text()')
        cleaned_strings = []
        for s in strings:
            cleaned_string = ''.join(s.split())  # Remove all whitespace including empty strings
            cleaned_strings.append(cleaned_string)

        title = max(cleaned_strings, key=len)

        match = re.search(r'imgsList:\s*(\[[^\]]+\])', content, re.DOTALL)
        if match:
            imgs_list_str = match.group(1)
            try:
                img_list = ast.literal_eval(imgs_list_str)
                img_list = [f"https:{item['url']}" if 'https:' not in item['url'] else item['url'] for item in img_list]
            except Exception as e:
                img_list = []
        else:
            img_list = []

        article_info = ""
        for item in text_list:
            article_info += item
            article_info += "\n"
        if not article_info:
            return None
        dict_ = {
            "title": title,
            "article_info": article_info,
            "img_list": img_list,
        }
        return dict_

    def tenxun(self):
        response = requests.get(self.url, headers=self.headers)
        content_html = etree.HTML(response.text)
        content = content_html.xpath('//*[@id="ArticleContent"]/div[2]/div/p')
        if not content:
            content = content_html.xpath('//*[@id="article-content"]/div[2]/div/p')
        title = content_html.xpath('//*[@id="dc-normal-body"]/div[3]/div[1]/div[1]/div[2]/h1//text()')
        img_list = []
        article_info = ''
        for info in content:
            try:
                img = info.xpath('.//img/@src')
                if len(img) > 0:
                    img_list.append(img[0])
            except:
                pass
            txt = info.xpath('.//text()')
            for i in txt:
                article_info += i
                article_info += "\n"
        dict_ = {
            "title": title[0],
            "article_info": article_info,
            "img_list": img_list,
        }

        return dict_



if __name__ == '__main__':
    # url = "https://www.thepaper.cn/newsDetail_forward_29569997"
    # url = "https://cn.chinadaily.com.cn/a/202412/05/WS6751bf8aa310b59111da7532.html"
    # url = "https://www.sohu.com/a/833830761_491157?scm=10001.311_14-200000.0.10006.&spm=smpc.channel_218.block4_113_Mng7qw_1_fd.1.1733488904653tFoNKXN_530"
    # url = "https://fashion.chinadaily.com.cn/a/202411/01/WS6724bcc0a310b59111da143d.html"
    # url = "https://www.163.com/dy/article/JIOEPIH40530WJIN.html?clickfrom=w_yw"
    url = "https://news.qq.com/rain/a/20241220A07ICV00"
    # url = "https://news.qq.com/rain/a/20241206A09HLY00"
    get_article = GetArticle(url)
    print(get_article.dispatch())
