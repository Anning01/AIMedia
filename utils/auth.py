from manage.common import check_member
from utils.local_storage import get_data


# 检查会员是否过期
def auth_level_expiry_time():
    return check_member()


def is_login():
    token = get_data()
    return token
