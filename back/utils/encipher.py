#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/12/29 15:17
# @file:encipher.py
import base64
import hashlib

from cryptography.fernet import Fernet


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


# 加密字符串
def encrypt_string(fernet, plaintext):
    # 将字符串编码为字节
    plaintext_bytes = plaintext.encode("utf-8")
    # 加密
    encrypted_bytes = fernet.encrypt(plaintext_bytes)
    # 返回加密后的字符串
    return encrypted_bytes.decode("utf-8")


# 解密字符串
def decrypt_string(fernet, encrypted_text):
    # 将字符串编码为字节
    encrypted_bytes = encrypted_text.encode("utf-8")
    # 解密
    decrypted_bytes = fernet.decrypt(encrypted_bytes)
    # 返回解密后的字符串
    return decrypted_bytes.decode("utf-8")


# 示例用法
if __name__ == "__main__":
    # 生成密钥
    key = "ViLp6nLIUi6XDZ9C"
    time_key = generate_key_from_string(key)
    print("Generated Key:", time_key.decode("utf-8"))

    # 初始化加密器
    fernet = initialize_fernet(time_key)

    # 要加密的字符串
    plaintext = "这是我的秘密信息"
    print("Original String:", plaintext)

    # 加密
    encrypted_text = encrypt_string(fernet, plaintext)
    print("Encrypted String:", encrypted_text)

    # 解密
    decrypted_text = decrypt_string(fernet, encrypted_text)
    print("Decrypted String:", decrypted_text)
