import streamlit as st

from utils.local_storage import get_data
from utils.sqlit_manage import *
from utils.sql_data import get_login_account
from st_pages import Page, Section, add_page_title
from utils.auth import is_login

from utils.client import Client
from utils.server import Service
import threading
from utils.sqlit_manage import *
import locale
import subprocess


# 初始化本地数据数据库

create_database(create_conn())
set_beijin_time(create_conn())



# 保存配置--保存数据到本地sqlite
@st.dialog('保存配置')
def opt_vot(nickname,uid,classify,posting_cycle,platform):
    conn = create_conn()
    flag = create_task(nickname,uid,classify,posting_cycle,platform,conn)
    if flag:
        st.write('保存成功')
    else:
        st.write('保存失败')


# 判断是否登录
token = is_login()
if not token:
    st.switch_page("main.py")
else:
    st.session_state.token = token

@st.cache_resource
def start_server():
    # 使用一个标志来确保任务只启动一次
    started = False
    def run_server():
        nonlocal started
        if not started:
            started = True
            # s = Service()
            # s.start()
            current_path = os.path.dirname(__file__)
            parent_path = os.path.dirname(current_path)
            script_path = os.path.join(parent_path, "utils", "server.py")
            # 构建命令
            command = ['cmd', '/c', 'start', 'cmd', '/k', 'python', script_path]
            # 运行命令并捕获输出
            subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                           creationflags=subprocess.CREATE_NEW_CONSOLE)
    threading.Thread(target=run_server).start()

# 开始托管按钮
st.write('AI托管中控服务，仅可开启一次')
cols = st.columns([0.8, 0.1])
with cols[1]:
    if st.button("开启服务"):
        start_server()



@st.cache_resource
def start_client():
    # 使用一个标志来确保任务只启动一次
    started = False

    token = get_data()
    print(f"Token: {token}")
    def run_client():
        nonlocal started
        if not started:
            started = True
            # 获取 token

            current_path = os.path.dirname(__file__)
            parent_path = os.path.dirname(current_path)
            script_path = os.path.join(parent_path, "utils", "client.py")

            # 构建命令行，将 token 作为环境变量传递
            # command = ['cmd', '/c', 'start', 'cmd', '/k', 'python', script_path]
            command = ['cmd', '/c', 'start', 'cmd', '/k', f'set token={token} && python {script_path}']

            subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                           creationflags=subprocess.CREATE_NEW_CONSOLE)
            started = False
            # 运行命令并捕获输出
            # try:
            #    subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            #                             creationflags=subprocess.CREATE_NEW_CONSOLE,
            #                             encoding=locale.getpreferredencoding())
            #
            # except UnicodeDecodeError as e:
            #     subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            #                             creationflags=subprocess.CREATE_NEW_CONSOLE, errors='ignore')
    threading.Thread(target=run_client).start()

st.write('托管机器人，可开启多个，根据电脑cpu和自己的任务量')
cols = st.columns([0.8, 0.1])
with cols[1]:
    if st.button("启动托管"):
        start_client()
        start_client.clear()




start_server.clear()

# 获取用户信息
user_data = get_login_account()
account_configs = []
for item in user_data:
    conn = create_conn()
    task_num,classify = select_task_num(item['uid'],conn)
    print(task_num)
    dict_ = {
        "nickname": item['nickname'],
        "uid": item['uid'],
        "classify": classify,
        "posting_cycle":task_num,
        "platform": item['platform'],
    }
    account_configs.append(dict_)

# 页面布局
st.title("AI 托管配置")
# 根据搜索条件过滤账号配置
search_query = st.text_input("搜索账号 (UID 或 昵称 或发布量)")
posting_cycle_query = st.text_input("搜索发文周期")

if search_query or posting_cycle_query:
    filtered_configs = [
        config for config in account_configs
        if (search_query.lower() in config["uid"].lower() or search_query.lower() in config["nickname"].lower()) and
           (not posting_cycle_query or config["posting_cycle"] == posting_cycle_query)
    ]
else:
    filtered_configs = account_configs


# 账号分类选项
account_categories = [
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
# 发文数量选项
posting_cycles = ["0", "3", "5", "7", "10"]


# 展示账号配置列表
if filtered_configs:
        cols = st.columns(6)
        cols[0].write("昵称")
        cols[1].write("UID")
        cols[2].write("账号分类")
        cols[3].write("发文周期")
        cols[4].write("发布平台")
        cols[5].write("保存配置")
        for i, config in enumerate(filtered_configs):
            cols = st.columns(6)
            cols[0].write(config["nickname"])
            cols[1].write(config["uid"])
            config["classify"] = cols[2].selectbox(
                f"选择分类",
                account_categories,
                index=account_categories.index(config["classify"]),
                key=f"classify_{i}"
            )
            config["posting_cycle"] = cols[3].selectbox(
                f"每日发布",
                posting_cycles,
                index=posting_cycles.index(config["posting_cycle"]),
                key=f"posting_cycle_{i}"
            )
            cols[4].write(config["platform"])
            if cols[5].button("确认", key=f"get_{i}_{config['uid']}"):
                # 这里可以添加实际的删除账号逻辑
                opt_vot(config["nickname"],config["uid"],config["classify"],config["posting_cycle"],config["platform"])
        # st.session_state.filtered_configs = filtered_configs
else:
    st.warning("没有账号配置。")


