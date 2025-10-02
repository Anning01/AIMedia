import json
import os
from random import sample
from string import ascii_letters, digits
from wechatpayv3 import WeChatPay as wecaht, WeChatPayType

from django.conf import settings


class WeChatPay:
    # 微信支付商户号（直连模式）或服务商商户号（服务商模式，即sp_mchid)
    MCHID = settings.WECHAT_PAY_MCHID

    # 判断是否存在商户证书文件
    if not os.path.exists('./apiclient_key.pem'):
        raise FileNotFoundError('缺少商户证书文件 apiclient_key.pem，请将商户证书文件放在 back/ 目录下')
    # 商户证书私钥
    with open('./apiclient_key.pem') as f:
        PRIVATE_KEY = f.read()

    # 商户证书序列号
    CERT_SERIAL_NO = settings.WECHAT_PAY_CERT_SERIAL_NO

    # API v3密钥， https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay3_2.shtml
    APIV3_KEY = settings.WECHAT_PAY_APIV3_KEY

    # APPID，应用ID或服务商模式下的sp_appid
    APPID = settings.WECHAT_APPID

    # 回调地址，也可以在调用接口的时候覆盖
    NOTIFY_URL = settings.WECHAT_PAY_NOTIFY_URL

    # 微信支付平台证书缓存目录，减少证书下载调用次数，首次使用确保此目录为空目录。
    # 初始调试时可不设置，调试通过后再设置，示例值:'./cert'。
    # 新申请的微信支付商户号如果使用平台公钥模式，可以不用设置此参数。
    CERT_DIR = None

    # 接入模式:False=直连商户模式，True=服务商模式
    PARTNER_MODE = False

    # 代理设置，None或者{"https": "http://10.10.1.10:1080"}，详细格式参见https://requests.readthedocs.io/en/latest/user/advanced/#proxies
    PROXY = None

    # 请求超时时间配置
    TIMEOUT = (10, 30)  # 建立连接最大超时时间是10s，读取响应的最大超时时间是30s

    def __init__(self):
        self.wechatpay = wecaht(
            wechatpay_type=WeChatPayType.JSAPI,
            mchid=self.MCHID,
            private_key=self.PRIVATE_KEY,
            cert_serial_no=self.CERT_SERIAL_NO,
            apiv3_key=self.APIV3_KEY,
            appid=self.APPID,
            notify_url=self.NOTIFY_URL,
            cert_dir=self.CERT_DIR,
            partner_mode=self.PARTNER_MODE,
            proxy=self.PROXY,
            timeout=self.TIMEOUT)

    def pay_jsapi(self, out_trade_no, money, openid):
        description = '会员充值'
        amount = money * 100
        payer = {'openid': openid}
        code, message = self.wechatpay.pay(
            description=description,
            out_trade_no=out_trade_no,
            amount={'total': amount},
            pay_type=WeChatPayType.JSAPI,
            payer=payer
        )
        return code, message

    def sign(self, data):
        return self.wechatpay.sign(data)

    def callback(self, headers, data):
        return self.wechatpay.callback(headers, data)
