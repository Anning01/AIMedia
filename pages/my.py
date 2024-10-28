import streamlit as st
import requests

from manage.account import use_activation_code
from manage.user import get_user
from utils.auth import is_login

# 判断是否登录
token = is_login()
if not token:
    st.switch_page("main.py")
else:
    st.session_state.token = token

# 如果用户 phone 是 123，添加 "会员配置" 菜单
user = get_user()

user_data = {
    "username": user["phone"],
    "membership_level": user["level"],
    "expiration_date": user["expiry_time"],
}


# 模拟兑换卡密函数
def activate_membership(card_key):
    # 这里可以替换为实际的兑换卡密接口请求代码
    response = use_activation_code(card_key)
    print(response["message"])
    return response["result"]


# 用户信息展示
cols = st.columns(3)
cols[0].write(f"**账号:** {user_data['username']}")
cols[1].write(f"**会员等级:** Lv{user_data['membership_level']}")
cols[2].write(f"**会员到期日期:** {user_data['expiration_date']}")

# 会员激活
st.header("会员激活")
card_key = st.text_input("卡密")

if st.button("兑换"):
    if card_key:
        result = activate_membership(card_key)
        if result:
            st.success("卡密兑换成功！")
            # 更新用户数据
            user_data["membership_level"] = result.get(
                "new_membership_level", user_data["membership_level"]
            )
            user_data["expiration_date"] = result.get(
                "new_expiration_date", user_data["expiration_date"]
            )
            st.write(f"**新的会员等级:** {user_data['membership_level']}")
            st.write(f"**新的会员到期日期:** {user_data['expiration_date']}")
        else:
            st.error("卡密兑换失败，请检查卡密是否正确。")
    else:
        st.warning("请输入卡密。")
