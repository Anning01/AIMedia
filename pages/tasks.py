import json
import os, shutil
import time

import requests
import streamlit as st

from config import enable
from utils.auth import is_login
from utils.sql_data import *
from utils.ai_tools import hot2article, del_watermark
from utils.auto_tools import AutoTools
import random
from datetime import datetime, timedelta
from utils.text_to_image import Main as StableDiffusion

# 判断是否登录
token = is_login()
if not token:
    st.switch_page("main.py")
else:
    st.session_state.token = token


def log_info(output_lines):
    # 初始化一个空的容器来显示打印台
    output_container = st.empty()
    # 清空容器内容
    output_container = output_container.empty()
    # 反转列表，使最新的内容在上方
    # reversed_lines = reversed(output_lines[-1:])
    # output_lines = output_lines[-2:]
    # 将内容格式化为 HTML
    st.write(output_lines[-2:])
    # output_html = "<br>".join(output_lines)
    # # 更新打印台
    # output_container.markdown(output_html, unsafe_allow_html=True)


def save_image_from_url(img_list, ids, content):
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
                # print("图片生成...")
                if not os.path.exists(save_path):
                    # print("需要生成")
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
            StableDiffusion().handle(content, 3, root)

    return root


# 任务输出台
@st.dialog("任务运行中,请勿关闭！！", width="small")
def task_logs():
    # # 暂时用单线程同步执行，后期优化
    # # 生成图片，后期添加
    # # 文案排版，后期添加
    # # 获取任务
    # for i in range(1, 4):
    i = 0
    while True:
        i += 1
        output_lines = [f"当前轮次：第{i}轮"]
        log_info(output_lines)
        task_opts = get_account_task(status="已发布")
        if len(task_opts) == 0:
            output_lines = [f"当前进度：任务已全部完成"]
            log_info(output_lines)
            st.rerun()
        random.shuffle(task_opts)
        for task_ev in task_opts:
            # 处理图片
            if task_ev["status"] == "已配置":
                output_lines = [
                    f"当前任务：账号：{task_ev['nickname']}，热点：{task_ev['task_opt']}"
                ]
                output_lines.append(f"当前进度：AI正在生产文章...")
                log_info(output_lines)
                article = hot2article(task_ev["task_opt"], task_ev["classify"])
                output_lines = [f"当前进度：文章生成成功..."]
                output_lines.append(f"文章：\n{article}")
                log_info(output_lines)
                if len(article) > 300:
                    # 跟新数据库
                    output_lines = [f"当前进度：跟新任务状态..."]
                    log_info(output_lines)
                    update_account_task(task_ev["id"], "已生产")
                    # 生成任务详细数据
                    output_lines.append(f"当前进度：保存任务详情..")
                    log_info(output_lines)
                    create_task_info(
                        task_ev["nickname"],
                        task_ev["uid"],
                        task_ev["platform"],
                        task_ev["classify"],
                        article,
                        task_ev["id"],
                    )
                    output_lines = [f"当前进度：生完成！！"]
                    log_info(output_lines)
            elif task_ev["status"] == "已生产":
                # 判断时间是否相差1小时
                now = datetime.now()
                # 获取当前账号最近发布时间
                old = get_last_time(task_ev["uid"])
                is_difference = True
                # 如果第一次发布
                if old:
                    # 判断是否相差1小时
                    one_hour = timedelta(hours=1)
                    time_difference = now - old
                    if time_difference < one_hour:
                        is_difference = False
                if is_difference:
                    # 获取任务详情
                    uid, content, platform = get_task_info(task_ev["id"])
                    output_lines = [f"当前任务：账号：{uid},发布平台：{platform}"]
                    output_lines.append(f"当前进度：已获取文章...")
                    log_info(output_lines)
                    # 获取账号cookie
                    cookie = get_account_info(uid)
                    output_lines = [f"当前进度：已获取账号登录权限..."]
                    log_info(output_lines)
                    publish_tool = AutoTools()
                    output_lines = [f"当前进度：等待浏览器，开始发布，请勿人工干预..."]
                    log_info(output_lines)
                    img_list = json.loads(task_ev["img_list"])
                    imgs_path = save_image_from_url(img_list, task_ev["id"], content)
                    result = publish_tool.publish(cookie, content, platform, imgs_path)
                    if result["status"]:
                        update_account_task(task_ev["id"], "已发布")
                        shutil.rmtree(imgs_path)
                else:
                    output_lines = [f"当前进度：当前账号发布时间小于1小时，跳过"]
                    log_info(output_lines)
            else:
                pass
            # 跟新数据
        time.sleep(6)


# 页面布局
st.title("今日任务")
# 新增账号按钮
cols = st.columns([0.8, 0.1])
with cols[1]:
    if st.button("启动任务"):
        task_logs()

# 展示账号数据
st.header("任务数据")
platform_filter = st.selectbox("选择状态", ["全部", "已配置", "已生产", "已发布"])
task_data = get_account_task()
tasks = [
    task
    for task in task_data
    if platform_filter == "全部" or task["status"] == platform_filter
]

# 展示任务列表
if tasks:
    cols = st.columns(7)
    cols[0].write("昵称")
    cols[1].write("UID")
    cols[2].write("任务平台")
    cols[3].write("所属分类")
    cols[4].write("热点事件")
    cols[5].write("任务进度")
    cols[6].write("操作")
    for i, task in enumerate(tasks):
        cols = st.columns(7)
        cols[0].write(task["nickname"])
        cols[1].write(task["uid"])
        cols[2].write(task["platform"])
        cols[3].write(task["classify"])
        cols[4].write(task["task_opt"].split("\n")[0])
        cols[5].write(task["status"])
        if cols[6].button("取消任务", key=f"cancel_{i}"):
            # 这里可以添加实际的取消任务逻辑
            del_account_task(task["id"])
            st.rerun()
else:
    st.warning("没有任务数据。")
