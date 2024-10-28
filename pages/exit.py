import time

import streamlit as st
from streamlit_local_storage import LocalStorage

st.write("注销中...")
LocalStorage().deleteAll()
time.sleep(1)
st.switch_page("main.py")
