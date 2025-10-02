from datetime import datetime
import json
from pathlib import Path
import os

from api.api_all import get_notice, mark_as_read_notice


class NoticeService:
    """通知服务"""
    
    def get_notices(self):
        """获取所有通知"""
        return get_notice()
    
    def mark_as_read(self, notice_id):
        """将通知标记为已读"""
        mark_as_read_notice(notice_id)
    
    def get_unread_count(self):
        """获取未读通知数量"""
        notices = self.get_notices()
        return sum(1 for notice in notices if not notice['is_read'])
