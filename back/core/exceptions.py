"""
通用的业务异常码和信息声明

命名格式说明：以 EXCEPTION_ 为前缀
"""

import importlib
import inspect
from django.utils.encoding import force_str

EXCEPTION_SYSTEM_ERROR = 10000
EXCEPTION_PARAMETER_FORMAT_ERROR = 10001
EXCEPTION_SERVER_IS_BUSY = 10002
EXCEPTION_SERVER_NOT_ENABLE = 10003
EXCEPTION_KEY_MISMATCH = 1004
EXCEPTION_DATA_INCLUDE_INVALID_IDS = 10010

ERROR_PHRASES = {
    EXCEPTION_PARAMETER_FORMAT_ERROR: "参数格式错误",
    EXCEPTION_SERVER_IS_BUSY: "服务器繁忙，请稍后再试",
    EXCEPTION_SERVER_NOT_ENABLE: "服务未启用",
    EXCEPTION_KEY_MISMATCH: "密钥不匹配",
    EXCEPTION_DATA_INCLUDE_INVALID_IDS: "请求数据包含了无效的主键",
}


class LoadAppExceptions:
    """加载应用内的异常短语"""

    app_list = ["user", "draw"]

    @classmethod
    def get_valid_exception(cls, data):
        if isinstance(data, int):
            return data

    @classmethod
    def load_app_exceptions(cls):
        """加载应用定义的异常短语"""
        for item in cls.app_list:
            try:
                module = importlib.import_module(f"apps.{item}.exceptions")
                for item in inspect.getmembers(
                    module, predicate=cls.get_valid_exception
                ):
                    key, value = item
                    globals().update({key: value})

                app_error_phrases = getattr(module, "ERROR_PHRASES", None)
                if isinstance(app_error_phrases, dict):
                    ERROR_PHRASES.update(app_error_phrases)
            except Exception:
                pass


LoadAppExceptions.load_app_exceptions()


class BusinessException(Exception):
    """通用业务异常类"""

    default_code = EXCEPTION_SYSTEM_ERROR
    default_message = "系统错误"
    default_app = ""

    def __init__(self, code=None, message=None, data="", app=""):
        self.code = code if code is not None else self.default_code

        if message is not None:
            self.message = message
        else:
            get_message = ""
            if code in ERROR_PHRASES:
                get_message = force_str(ERROR_PHRASES.get(code))
            if not get_message:
                get_message = force_str(self.default_message)
            self.message = get_message

        self.data = data
        self.app = app if app else force_str(self.default_app)

    def __str__(self):
        return f"{self.code}:{self.message}"


def raise_business_exception(code, message="", data="", app=""):
    """抛出业务异常"""
    raise BusinessException(code=code, message=message, data=data, app=app)
