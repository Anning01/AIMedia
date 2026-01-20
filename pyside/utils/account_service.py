from api.api_all import get_account_list
from utils.local_data import LocalData


class AccountService:
    """账号服务"""

    def __init__(self):
        self._accounts = []
        self.local_data = LocalData()  # 创建 LocalData 实例
        self._init_mock_data()

    def _init_mock_data(self):
        """初始化数据"""
        self._accounts = []
        data = get_account_list()

        if data:
            self._accounts = [
                {
                    "id": account["id"],
                    "uid": account["uid"],
                    "nickname": account["nickname"],
                    "platform": account["platform_value"],
                    "is_expired": account["expiry_time"],
                    "platform_code": account["platform"],
                    "daily_publish_count": account["daily_publish_count"],
                }
                for account in data
            ]

    def get_accounts(self):
        """获取所有账号"""
        self._init_mock_data()
        return self._accounts

    def delete_account(self, uid):
        """删除账号"""
        self.local_data.delete_account(uid)  # 根据 UID 删除账号
        self._accounts = [acc for acc in self._accounts if acc["uid"] != uid]  # 从内存中删除账号

    def _is_account_exists(self, uid):
        """检查账号是否存在"""
        return any(acc["uid"] == uid for acc in self._accounts)

    def get_publish_limit(self, uid):
        """获取账号发布量限制
        Args:
            uid: 账号UID
        Returns:
            int: 发布量限制
        """
        return self.local_data.get_publish_limit(uid)

    def update_publish_limit(self, uid, limit):
        """更新账号发布量限制
        Args:
            uid: 账号UID
            limit: 发布量限制
        Returns:
            bool: 是否更新成功
        """
        return self.local_data.update_publish_limit(uid, limit)
