#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/10/13 16:29
# @file:Translation.py
import requests
from alibabacloud_alimt20181012.client import Client as alimt20181012Client
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_alimt20181012 import models as alimt_20181012_models
from config import access_key, secret, language


class Sample:
    def __init__(self):
        pass

    @staticmethod
    def create_client(
        access_key_id: str,
        access_key_secret: str,
        region_id: str,
    ) -> alimt20181012Client:
        config = open_api_models.Config()
        config.access_key_id = access_key_id
        config.access_key_secret = access_key_secret
        config.region_id = region_id
        config.connect_timeout = 5000
        config.read_timeout = 10000
        return alimt20181012Client(config)

    @staticmethod
    async def create_client_async(
        access_key_id: str,
        access_key_secret: str,
        region_id: str,
    ) -> alimt20181012Client:
        config = open_api_models.Config()
        config.access_key_id = access_key_id
        config.access_key_secret = access_key_secret
        config.region_id = region_id
        return alimt20181012Client(config)

    @staticmethod
    def main(
        text,
        region="cn-hangzhou",
        format_type="text",
        source_language=language,
        target_language="en",
    ) -> None:
        if language == "en":
            return text
        client = Sample.create_client(access_key, secret, region)
        request = alimt_20181012_models.TranslateGeneralRequest(
            format_type=format_type,
            source_language=source_language,
            target_language=target_language,
            source_text=text,
        )
        response = client.translate_general(request)
        return response.body.data.translated

    @staticmethod
    async def main_async(
        text,
        region="cn-hangzhou",
        format_type="text",
        source_language="zh",
        target_language="en",
    ) -> None:
        client = await Sample.create_client_async(access_key, secret, region)
        request = alimt_20181012_models.TranslateGeneralRequest(
            format_type=format_type,
            source_language=source_language,
            target_language=target_language,
            source_text=text,
        )
        response = await client.translate_general_async(request)
        return response.body.data.translated


if __name__ == "__main__":
    print(Sample.main("你好"))
