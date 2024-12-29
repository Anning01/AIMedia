# coding: utf-8
# -*- coding:utf-8 -*-
import os
import socket
import time
import json
import subprocess
import random
import string
import sys
import shutil
import requests
import importlib
importlib.reload(sys)

# 以下依赖不能删除，哪怕当前页面没有使用
nas_path = os.path.dirname(__file__)
helper_dir = os.path.dirname(os.path.abspath('__file__'))
sys.path.insert(0, nas_path)
parent_path = os.path.dirname(nas_path)
sys.path.insert(0, parent_path)
from sqlit_manage import *
from get_hot_data import *
from config import *
from ai_tools import *
from config import enable
from utils.text_to_image import Main as StableDiffusion
from auto_tools import AutoTools
from sql_data import get_account_info


class Client(object):
    token = os.environ.get('token')

    # 获取资源
    def get_task(self):
        pass

    # 图片处理
    def save_image_from_url(self,img_list, ids, content):
        root = f"temp/img_temp/{ids}"
        if not os.path.exists(root):
            os.makedirs(root)
        root = os.path.abspath(root)
        if len(img_list) > 0:
            if len(img_list) > 3:
                img_random = random.sample(img_list, 3)
            else:
                img_random = img_list
            for image_url in img_random:
                # 去水印
                image_url_new = del_watermark(image_url)
                save_path = rf"{root}/{img_list.index(image_url)}.jpg"
                num = 0
                while True:
                    if not os.path.exists(save_path):
                        print(f"图片{img_list.index(image_url)}正在处理中...")
                        headers = {
                            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                        }
                        try:
                            response = requests.get(image_url_new, headers=headers)
                            if response.status_code == 200:
                                with open(save_path, "wb") as file:
                                    file.write(response.content)
                        except:
                            pass
                    else:
                        break
                    num += 1
                    if num > 99:
                        break
        else:
            if enable:
                print("图片生成...")
                StableDiffusion().handle(content, 3, root)

        return root

    def task(self,task_opt):
        # 获取当前日期和时间
        current_time = datetime.now()
        # 计算1小时前的时间
        task_opt['publish_time'] = datetime.strptime(task_opt['publish_time'], '%Y-%m-%d %H:%M:%S')
        time_difference = current_time - task_opt['publish_time']
        if time_difference >= timedelta(hours=1):
            print("当前发布相隔大于1小时，可以发布")
            # # 生生文章
            print('---'*20)
            print('当前任务信息：')
            print(f'任务id：{task_opt["task_id"]}')
            print(f'发布平台：{task_opt["platform"]}')
            print('---' * 20)
            print("Ai正在生成文章...")
            article = hot2article(task_opt['content'],'')
            print(f'生成成功！！！')
            print("检查文章是否合格")
            if len(article) >500:
                print("文章符合条件")
                # 处理图片
                img_url_list = json.loads(task_opt['img_url_list'])
                imgs_path = self.save_image_from_url(img_url_list, task_opt["task_id"], article)
                # 获取登录权限
                base_url = "http://127.0.0.1:8000"
                headers = {"Content-Type": "application/json"}
                headers["Authorization"] = f"Bearer {self.token}"
                cookie = requests.get(f"{base_url}/user/account/", params=task_opt['uid'],headers=headers)
                cookie = cookie.json()[0]['cookie']
                print('已获取登录权限')
                print('开始发布，请勿干预浏览器...')
                publish_tool = AutoTools()
                print(cookie, article, task_opt['platform'], imgs_path)
                result = publish_tool.publish(cookie, article, task_opt['platform'], imgs_path)
                if result["status"]:
                    print('发布成功！！！')
                    client_update(task_opt["task_id"], "已发布")
                    print('跟新状态！！！')
                    shutil.rmtree(imgs_path)
                    print('清楚缓存！！！')
                else:
                    print('处理失败，等待下一轮')
            else:
                print('文章不符合,等待重新配置')
                # 当前任务ai无法生成内容，删除该配置
                del_task_info_about_task_id(task_opt["task_id"])
        else:
            print("当前账号发布时间未超过1小时")
    def run(self):
        host = '127.0.0.1'
        port = 1288
        client = socket.socket()
        try:
            client.connect((host, port))
        except:
            print('请求异常....')
            time.sleep(5)
            return

        data = client.recv(10240).decode()
        data = json.loads(data)
        if not data['status']:
            print('当前暂无任务...')
            time.sleep(5)
            return

        task_opt = data['data']
        # print(f'当前任务: {task}')
        self.task(task_opt)
        time.sleep(0.1)

        print('======================== 任务完成 ========================')


if __name__ == '__main__':
    random_number = ''.join(random.choices(string.digits, k=4))
    result = f"Ai机器人：{random_number}"
    os.system(f'title={result}')
    dw = Client()
    while (True):
        try:
            dw.run()
        except:
            pass
