import streamlit as st

from manage.account import get_account_list
from utils.auth import auth_level_expiry_time, is_login
from utils.get_hot_data import hot_data, hot_item, wangyi
import requests
import threading
from utils.sql_data import create_task
from utils.auto_tools import AutoTools
from utils.local_storage import *

# 模拟数据
def get_hot_data(category, page):
    try:
        sessionid_token = get_sessionid()
    except:
        sessionid_token = None
    if sessionid_token:
        data = hot_data(category, page,sessionid_token)
        return data,sessionid_token
    else:
        return None,None



@st.dialog("任务配置")
def vote(video_list, sentence, sentence_tag_name):
    # 获取账号数据
    # accounts = get_login_account()
    accounts = get_account_list()

    if not accounts:
        st.warning("没有可用的账号")
        return

    # 显示下拉框
    account_options = [
        f"昵称：{account['nickname']}，平台：{account['platform']}，uid；{account['uid']}"
        for account in accounts
    ]
    selected_account_option = st.selectbox("选择账号", account_options)

    # 解析选择的账号
    selected_account_index = account_options.index(selected_account_option)
    selected_account = accounts[selected_account_index]
    # 点击确定按钮
    cols = st.columns([0.8, 0.2])
    opt_status = None
    with cols[1]:
        if st.button("确定", use_container_width=True):
            img_list = []
            # 请求接口进行配置
            opt_status = create_task(
                sentence_tag_name, sentence, selected_account, img_list
            )
    if opt_status is True:
        srt_ = "配置成功"
        st.markdown(f"<span style='color:green;'>{srt_}</span>", unsafe_allow_html=True)
    elif opt_status is False:
        srt_ = "您旗下已有或者已发布相同配置，为提高账号权重，无法为您重复配置"
        st.markdown(f"<span style='color:red;'>{srt_}</span>", unsafe_allow_html=True)
    else:
        pass

    st.write(f"事件：{sentence}，分类：{sentence_tag_name}")
    st.write(f"相关视频：")
    idx = 1
    for item in video_list:
        # st.write(f"url{idx}：{item['url']}")
        response = requests.get(item["url"])
        st.video(response.content)
        idx += 1


@st.dialog("任务配置")
def vote_wangyi(video_list, sentence, img_list):
    # 获取账号数据
    # accounts = get_login_account(phone)
    accounts = get_account_list()

    if not accounts:
        st.warning("没有可用的账号")
        return

    # 显示下拉框
    account_options = [
        f"昵称：{account['nickname']}，平台：{account['platform']}，uid；{account['uid']}"
        for account in accounts
    ]
    selected_account_option = st.selectbox("选择账号", account_options)

    # 解析选择的账号
    selected_account_index = account_options.index(selected_account_option)
    selected_account = accounts[selected_account_index]
    # 点击确定按钮
    cols = st.columns([0.8, 0.2])
    opt_status = None
    task_opt = sentence + "\n" + video_list
    with cols[1]:
        if st.button("确定", use_container_width=True):
            # 请求接口进行配置
            opt_status = create_task("未知", task_opt, selected_account, img_list)
    if opt_status is True:
        srt_ = "配置成功"
        st.markdown(f"<span style='color:green;'>{srt_}</span>", unsafe_allow_html=True)
    elif opt_status is False:
        srt_ = "您旗下已有或者已发布相同配置，为提高账号权重，无法为您重复配置"
        st.markdown(f"<span style='color:red;'>{srt_}</span>", unsafe_allow_html=True)
    else:
        pass

    st.write(f"事件：{sentence}")
    st.write(f"相关素材：")
    for img in img_list:
        st.image(img, caption="示例图片", use_column_width=True)
        # st.write(img)


def show_data(hot_data,sessionid_token):
    # 显示列名
    st.write("### 热点具体数据")
    warn_srt_ = "部分视频数据因不符合制作要求已经过滤，如视频中只有音乐，即使没有视频也不影响配置使用"
    st.markdown(f"<span style='color:red;'>{warn_srt_}</span>", unsafe_allow_html=True)
    cols = st.columns(
        [0.05, 0.3, 0.2, 0.2, 0.15, 0.1], gap="medium", vertical_alignment="top"
    )
    cols[0].write("排名")
    cols[1].write("热点事件")
    cols[2].write("热力值")
    cols[3].write("相关视频")
    cols[4].write("分类")
    cols[5].write("操作")

    # 显示每条数据
    for item in hot_data:
        cols = st.columns([0.05, 0.3, 0.2, 0.2, 0.14, 0.1])
        cols[0].write(item["num"])
        cols[1].write(item["sentence"])
        cols[2].write(item["hot_score"])

        # 相关视频按钮

        if cols[3].button(
            f"{item['video_count']}个视频",
            key=f"video_{item['num']}",
            use_container_width=True,
        ):
            pass
            # video_list = hot_item(item["sentence_id"], item["video_count"])
            # # 每行展示4个视频
            # for i in range(0, len(video_list), 10):
            #     row_cols = st.columns(10)
            #     for j in range(10):
            #         if i + j < len(video_list):
            #             video = video_list[i + j]
            #             with row_cols[j]:
            #                 response = requests.get(video["url"])
            #                 st.video(response.content)

        cols[4].write(item["sentence_tag_name"])

        # 配置按钮
        if cols[5].button("配置", key=f"config_{item['num']}", use_container_width=True):
            result, message = auth_level_expiry_time()
            if result:

                video_list = hot_item(item["sentence_id"], item["video_count"],sessionid_token)
                vote(video_list, item["sentence"], item["sentence_tag_name"])
            else:
                st.write(message)


def show_data_wangyi(hot_data):
    # 显示列名
    st.write("### 热点具体数据")
    cols = st.columns(
        [0.05, 0.6, 0.1, 0.15, 0.1], gap="medium", vertical_alignment="center"
    )
    cols[0].write("排名")
    cols[1].write("热点事件")
    cols[2].write("查看文章")
    cols[3].write("发布日期")
    cols[4].write("操作")

    # 显示每条数据
    for item in hot_data:
        cols = st.columns([0.05, 0.6, 0.1, 0.15, 0.1], vertical_alignment="center")
        cols[0].write(hot_data.index(item) + 1)
        cols[1].write(item["title"])

        # 相关视频按钮
        if cols[2].button(
            f"查看",
            key=f"video_{hot_data.index(item)+1}",
            use_container_width=True,
        ):
            st.write(item["article_info"])

        cols[3].write(item["date_str"])
        # 配置按钮
        if cols[4].button(
            "配置", key=f"config_{hot_data.index(item)}", use_container_width=True
        ):
            result, message = auth_level_expiry_time()
            if result:
                vote_wangyi(item["article_info"], item["title"], item["img_list"])
            else:
                st.write(message)

# @st.cache_resource
@st.dialog("扫码登录")
def get_scrt_douyin():
    auto = AutoTools()
    cookies = auto.get_cookies_douy_hot('抖音热点宝')
    for item in  cookies:
        if item['name'] == 'sessionid_douhot':
            sessionid = item['value']
            save_data('sessionid_token',sessionid)
            st.rerun()



def page_douyin():
    # 页面布局
    # 头部：热点分类
    categories = [
        "全部",
        "美食",
        "旅行",
        "站内玩法",
        "话题互动",
        "娱乐",
        "社会",
        "二次元",
        "交通",
        "亲子",
        "体育",
        "军事",
        "剧情",
        "动物萌宠",
        "天气",
        "才艺",
        "文化教育",
        "时尚",
        "时政",
        "校园",
        "汽车",
        "游戏",
        "科技",
        "财经",
    ]
    # 创建按钮
    category_buttons = []
    cols = st.columns(12)  # 每行12个按钮
    for i, category in enumerate(categories):
        with cols[i % 12]:
            category_buttons.append(st.button(category, use_container_width=True))

    st.write("### 获取抖音密钥,网页打开后登录扫码")
    cols = st.columns([0.9, 0.1])
    with cols[1]:
        if st.button("点击扫码"):
            get_scrt_douyin()

    # 获取选中的分类
    for i, button in enumerate(category_buttons):
        if button:
            st.session_state.selected_category = categories[i]
            st.session_state.page_ = 1
            st.rerun()
            break

    # 获取数据
    hot_data,sessionid_token = get_hot_data(st.session_state.selected_category, st.session_state.page_)
    if hot_data:
        show_data(hot_data,sessionid_token)
    else:
        st.write('请扫码')

    # 底部：页码
    page_count = 20
    page_cols = st.columns(page_count)  # 每行10个按钮
    page_buttons = []
    for i in range(1, 11):
        with page_cols[page_count - 11 + i]:
            page_buttons.append(st.button(str(i), use_container_width=True))

    # 点击页码发起请求数据
    if any(page_buttons):
        selected_page = page_buttons.index(True) + 1
        st.session_state.page_ = selected_page
        st.rerun()


def page_wangyi():
    # 获取数据
    hot_data = wangyi(st.session_state.page_)
    show_data_wangyi(hot_data)

    # 底部：页码
    page_count = 20
    page_cols = st.columns(page_count)  # 每行10个按钮
    page_buttons = []
    for i in range(1, 11):
        with page_cols[page_count - 11 + i]:
            page_buttons.append(st.button(str(i), use_container_width=True))

    # 点击页码发起请求数据
    if any(page_buttons):
        selected_page = page_buttons.index(True) + 1
        st.session_state.page_ = selected_page
        st.rerun()


# 初始化session状态
if "source_page" not in st.session_state:
    st.session_state.source_page = "热点库"
if "page_" not in st.session_state:
    st.session_state.page_ = 1
if "selected_category" not in st.session_state:
    st.session_state.selected_category = "全部"
if "selected_platform" not in st.session_state:
    st.session_state.selected_platform = "抖音"


# 判断是否登录
token = is_login()
if not token:
    st.switch_page("main.py")
else:
    st.session_state.token = token

# 创建标签栏
platforms = ["抖音", "网易新闻"]
st.session_state.selected_platform = st.sidebar.radio("选择平台", platforms)

if st.session_state.selected_platform == "抖音":
    page_douyin()
if st.session_state.selected_platform == "网易新闻":
    page_wangyi()
