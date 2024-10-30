import time

import streamlit as st
from st_pages import add_page_title, get_nav_from_toml
from utils.auth import is_login
from manage.user import register as register_user, login as login_user


@st.dialog("登录中...")
def vote(phone, password):
    status, message = login_user(phone, password)
    if status:
        st.success(message)
        del st.session_state["page"]
        time.sleep(2)
        st.switch_page("pages/hots.py")
    else:
        if isinstance(message, dict) and "non_field_errors" in message:
            st.error("".join(message["non_field_errors"]))  # 展示具体的错误信息
        else:
            st.error(message or "登录失败，请检查账号密码是否正确。")


# 登录页面
def login_page():
    phone = st.text_input("账号", placeholder="请输入手机号码")
    password = st.text_input("密码", type="password", placeholder="请输入密码")
    if st.button("没有账号？点击注册", key="register_button"):
        st.session_state.page = "register"
        st.rerun()  # 切换页面后重新渲染
    if st.button("登录"):
        vote(phone, password)


# 注册页面
def register_page():
    phone = st.text_input("账号", placeholder="请输入手机号码")
    password = st.text_input("密码", type="password", placeholder="请输入密码")
    confirm_password = st.text_input("确认密码", type="password", placeholder="请再次输入密码")
    if st.button("已有账号？点击登录", key="login_button"):
        st.session_state.page = "login"
        st.rerun()  # 切换页面后重新渲染
    if st.button("注册"):
        if len(phone) != 11:
            st.error("请输入正确手机号码")
        else:
            if password == confirm_password:
                status, message = register_user(phone, password, confirm_password)
                if status:
                    st.success("登录成功！")
                    del st.session_state["page"]
                    time.sleep(2)
                    st.switch_page("pages/hots.py")
                else:
                    st.error(message)
            else:
                st.error("两次输入的密码不一致。")


if __name__ == "__main__":
    st.set_page_config(
        page_title="Ai爆文大师",
        page_icon="🚀",
        layout="wide",
        initial_sidebar_state="auto",
        menu_items={"About": "接受定制"},
    )

    nav = get_nav_from_toml(".streamlit/pages.toml")

    st.logo("docs/logo.png")

    pg = st.navigation(nav)

    add_page_title(pg)

    pg.run()

    # 检查是否已经登录
    token = is_login()
    # 初始化页面状态
    if not token:
        if "page" not in st.session_state:
            st.session_state.page = "login"  # 默认首次加载进入登录页面
        elif "page" not in st.session_state and st.session_state.page == "register":
            st.session_state.page = "register"  # 默认首次加载进入登录页面
    else:
        st.session_state.token = token  # 默认首次加载进入登录页面
    # 根据页面状态显示对应的页面
    if "page" in st.session_state and st.session_state.page == "login":
        login_page()
    elif "page" in st.session_state and st.session_state.page == "register":
        register_page()
