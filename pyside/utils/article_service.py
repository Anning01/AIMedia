class ArticleService:
    """文章服务"""

    def __init__(self):
        self.selected_account = None

    def select_account(self, account):
        """选择账号"""
        self.selected_account = account

    def get_selected_account(self):
        """获取选中的账号"""
        return self.selected_account

    def clear_selected_account(self):
        """清除选中的账号"""
        self.selected_account = None
