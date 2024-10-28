import streamlit as st
from utils.auth import auth_level_expiry_time, is_login
import time
from utils.auto_tools import AutoTools
from utils.sql_data import (
    login_account,
    get_login_account,
    del_login_account,
    get_account_info,
)


# 模拟登录函数
def login(platform):
    # 这里可以替换为实际的登录接口请求代码
    print(f"登录到 {platform}")
    auto = AutoTools()
    nickName, cookies, uid = auto.get_cookies(platform)
    login_account(nickName, cookies, uid, platform)


@st.dialog("正在执行")
def vote():
    st.write(f"等待谷歌浏览器启动后人工登录")
    st.write(f"登录后不要人工干预")
    st.write(f"浏览器启动后可以继续增加账号，无需等待")


@st.dialog("正在查看账号数据...")
def data_vote(uid, platform):
    st.write(f"浏览器启动中，请耐心等代...")
    auto = AutoTools()
    cookie = get_account_info(uid)
    auto.get_acconut_data(cookie, platform)


# 模拟请求数据函数
def get_account_data():
    res_list = get_login_account()
    # 这里可以替换为实际的接口请求代码
    return res_list


# 判断是否登录
token = is_login()
if not token:
    st.switch_page("main.py")
else:
    st.session_state.token = token

# 初始化 session state
if "show_form" not in st.session_state:
    st.session_state.show_form = False

# 新增账号按钮
cols = st.columns([0.8, 0.1])
with cols[1]:
    if st.button("新增账号"):
        if not auth_level_expiry_time():
            st.warning("会员过期")
            time.sleep(3)
            st.rerun()
        st.session_state.show_form = True

# 如果 show_form 为 True，则渲染表单
if st.session_state.show_form:
    with cols[1]:
        form_placeholder = st.empty()
        with form_placeholder.form(key="add_account_form"):
            platforms = ["公众号", "小红书", "头条号"]
            selected_platform = st.selectbox(
                "选择平台", platforms, key="platform_selectbox"
            )
            if st.form_submit_button("确定"):
                vote()
                login(selected_platform)
                st.session_state.show_form = False  # 重置表单状态
                form_placeholder.empty()  # 清除表单
                st.rerun()

# 展示账号数据
st.header("账号数据")
platform_filter = st.selectbox("选择平台", ["全部", "公众号", "小红书", "头条号"])
account_data = get_account_data()
filtered_data = [
    account
    for account in account_data
    if platform_filter == "全部" or account["platform"] == platform_filter
]

if filtered_data:
    cols = st.columns(7)
    cols[0].write("昵称")
    cols[1].write("UID")
    cols[2].write("分类")
    cols[3].write("是否过期")
    cols[4].write("归属平台")
    cols[5].write("操作")
    cols[6].write("数据分析")
    # cols[6].write("操作")
    for account in filtered_data:
        print()
        cols = st.columns(7)
        cols[0].write(account["nickname"])
        cols[1].write(account["uid"])
        cols[2].write(account["classify"])
        cols[3].write("是" if account["expired"] else "否")
        cols[4].write(account["platform"])
        if cols[5].button("删除账号", key=f"delete_{account['uid']}"):
            # 这里可以添加实际的删除账号逻辑
            del_login_account(account["id"])
            st.rerun()
        if cols[6].button("账号数据", key=f"get_{account['uid']}"):
            # 这里可以添加实际的删除账号逻辑
            data_vote(account["uid"], account["platform"])
else:
    st.warning("没有账号数据。")
