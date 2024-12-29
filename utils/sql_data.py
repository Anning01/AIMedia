from manage.account import get_account_list, create_account, delete_account
from manage.task import (
    get_task_list,
    create_task_,
    delete_task,
    partial_update_task,
    create_task_info_,
    get_task_info_list,
    check_pub_time,
)
from datetime import datetime, timedelta
import json


# 登录账号，如果存在跟新，不存在新增
def login_account(nickName, cookies, uid, platform):
    # 获取今天的日期
    today = datetime.today()
    # 计算15天后的日期
    future_date = today + timedelta(days=15)
    # 将日期格式化为字符串
    expiry_time = future_date.strftime("%Y-%m-%d %H:%M:%S")

    create_account(
        data={
            "nickname": nickName,
            "uid": uid,
            "cookie": cookies,
            "platform": platform,
            "expiry_time": expiry_time,
            "classify": "全部",
        }
    )


# 获取当前用户已经登录的账号
def get_login_account():
    accounts = get_account_list()

    res_list = []
    for account in accounts:
        expiration_date = datetime.strptime(account["expiry_time"], "%Y-%m-%d %H:%M:%S")
        # 获取当前日期
        current_date = datetime.now()
        # 检查会员是否过期
        if current_date < expiration_date:
            expired = False
        else:
            expired = True
        dict_ = {
            "nickname": account["nickname"],
            "uid": account["uid"],
            "classify": account["classify"],
            "platform": account["platform"],
            "expired": expired,
        }
        res_list.append(dict_)
    return res_list


# 获取指定账号信息
def get_account_info(uid):
    result = get_account_list(params={"uid": uid})
    return result[0]["cookie"]


# 删除指定账号
def del_login_account(uid):
    delete_account(uid)


# 配置任务
def create_task(classify, content, selected_account, img_list):
    # 获取当前用户信息
    nickname = selected_account["nickname"]
    uid = selected_account["uid"]
    platform = selected_account["platform"]

    task_old = get_task_list(params={"platform": platform, "task_opt": content})
    if len(task_old) == 0:
        create_task_(
            {
                "account": selected_account["id"],
                "nickname": nickname,
                "uid": uid,
                "platform": platform,
                "classify": classify,
                "status": "已配置",
                "task_opt": content,
                "img_list": json.dumps(img_list),
            }
        )
        return True
    else:
        return False


# 获取账号当天任务
def get_account_task(status=None):
    today_date = datetime.now().strftime("%Y-%m-%d")

    tasks = get_task_list(
        params={"created_time__date": today_date, "status_not": status}
    )

    return tasks


# 取消任务，删除指定任务
def del_account_task(task_id):
    delete_task(task_id)


# 跟新任务状态
def update_account_task(task_id, status):
    partial_update_task(task_id, {"status": status})


# 记录任务详情
def create_task_info(nickname, uid, platform, classify, content, task_id):
    # 获取当前用户信息
    create_task_info_(
        {
            "task": task_id,
            "nickname": nickname,
            "uid": uid,
            "platform": platform,
            "classify": classify,
            "content": content,
        }
    )


def get_task_info(task_id):
    result = get_task_info_list(params={"task": task_id})
    return result[0]["uid"], result[0]["content"], result[0]["platform"]


def get_last_time(uid):
    result = check_pub_time(uid)
    pub_time = result["pub_time"]
    if pub_time is None:
        return None
    datetime_obj = datetime.strptime(pub_time, "%Y-%m-%d %H:%M:%S")
    return datetime_obj
