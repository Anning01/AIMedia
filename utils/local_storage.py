from streamlit_local_storage import LocalStorage


# 保存数据到 localStorage
def save_data(key, value):
    LocalStorage().setItem(key, value)


# 从 localStorage 读取数据
def get_data():
    token = LocalStorage().getItem("token")
    return token


def get_sessionid():
    sessionid_token = LocalStorage().getItem('sessionid_token')
    return sessionid_token