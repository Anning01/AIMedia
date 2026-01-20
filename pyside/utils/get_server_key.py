#!/usr/bin/env python
# @Time    : 2024/12/29 15:39
# @Author  : DNQTeach
# @File    : get_server_key.py


import base64
import hashlib

from cryptography.fernet import Fernet
from PySide6.QtCore import QSettings

from api.api_all import get_gml_key


def generate_key_from_string(input_string):
    key = "F4FQgz11cd-C4JFWXsd8mViLp6nLIUi6XDZ9Ca5hkls="
    # 将时间戳和输入字符串拼接
    combined = f"{input_string}:{key}"
    # 使用 SHA-256 哈希生成固定长度的密钥
    hash_value = hashlib.sha256(combined.encode("utf-8")).digest()
    # 将哈希值转换为 Base64 编码的 Fernet 密钥
    key = base64.urlsafe_b64encode(hash_value[:32])  # 取前 32 字节
    return key


# 初始化加密器
def initialize_fernet(key):
    return Fernet(key)


# 解密字符串
def decrypt_string(fernet, encrypted_text):
    # 将字符串编码为字节
    encrypted_bytes = encrypted_text.encode("utf-8")
    # 解密
    decrypted_bytes = fernet.decrypt(encrypted_bytes)
    # 返回解密后的字符串
    return decrypted_bytes.decode("utf-8")


def run_decrypt():
    settings = QSettings("AiMedia", "ai-media")
    openid = settings.value("openid")
    encrypted_text = get_gml_key()
    if encrypted_text:
        key = generate_key_from_string(openid)
        fernet = initialize_fernet(key.decode("utf-8"))
        return decrypt_string(fernet, encrypted_text)
    else:
        return None
