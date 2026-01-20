from datetime import datetime, timedelta

from core.account import create_account, delete_account, get_account_list
from core.news import create_news
from core.task import (
    check_pub_time,
    create_task_info_,
    delete_task,
    get_task_info_list,
    get_task_list,
    partial_update_task,
)


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


def get_login_account():
    accounts = get_account_list()
    res_list = []
    for account in accounts:
        expiration_date = datetime.strptime(account["expiry_time"], "%Y-%m-%d %H:%M:%S")
        current_date = datetime.now()
        expired = current_date >= expiration_date

        dict_ = {
            "data_id": account["id"],
            "nickname": account["nickname"],
            "uid": account["uid"],
            "classify": account["news_category"],
            "platform_value": account["platform_value"],
            "expired": expired,
        }
        res_list.append(dict_)
    return res_list


def get_account_info(uid):
    result = get_account_list(params={"uid": uid})
    return result[0]["cookie"] if result else None


def del_login_account(uid):
    delete_account(uid)


def create_task(elected_account, code, res, platform_category):
    # 获取当前用户信息
    account = elected_account["id"] if elected_account else None

    data = {
        "platform_category": platform_category,
        "title": res["title"],
        "article_url": res["article_url"],
        "cover_url": res["cover_url"],
        "date_str": res["date_str"],
        "article_info": res["article_info"],
        "img_list": res["img_list"],
        "account": account,
    }

    try:
        res = create_news(data)
        return isinstance(res, dict)
    except:
        return False


def get_account_task(status=None):
    today_date = datetime.now().strftime("%Y-%m-%d")
    return get_task_list(params={"created_time__date": today_date, "status_not": status})


def del_account_task(task_id):
    delete_task(task_id)


def update_account_task(task_id, status):
    if status == "已发布":
        publish_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        partial_update_task(task_id, {"status": status, "publish_time": publish_time})
    else:
        partial_update_task(task_id, {"status": status})


def create_task_info(nickname, uid, platform, classify, content, task_id):
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
    if result:
        return result[0]["uid"], result[0]["content"], result[0]["platform"]
    return None, None, None


def get_last_time(uid):
    result = check_pub_time(uid)
    pub_time = result.get("pub_time")
    if pub_time:
        return datetime.strptime(pub_time, "%Y-%m-%d %H:%M:%S")
    return None
