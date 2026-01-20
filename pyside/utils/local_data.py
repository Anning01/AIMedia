import sqlite3
import threading
from datetime import datetime, timedelta


class LocalData:
    _local = threading.local()

    def __init__(self, db_name="localData.db"):
        self.db_name = db_name

    def _init_db_connection(self):
        """初始化或重新初始化数据库连接"""
        try:
            # 检查连接是否存在且有效
            if hasattr(self._local, "conn") and self._local.conn is not None:
                try:
                    # 尝试执行一个简单的查询来测试连接
                    self._local.conn.execute("SELECT 1")
                    return
                except (sqlite3.OperationalError, sqlite3.ProgrammingError):
                    # 如果连接已关闭或无效，关闭它（如果可能）并创建新连接
                    try:
                        self._local.conn.close()
                    except:
                        pass

            # 创建新连接
            self._local.conn = sqlite3.connect(self.db_name)
            self._local.cursor = self._local.conn.cursor()

            # 确保表存在
            self._ensure_tables_exist()

        except Exception as e:
            print(f"数据库连接初始化错误: {str(e)}")
            raise

    def _ensure_tables_exist(self):
        """确保所有必需的表都存在"""
        self.create_table()
        self.create_publish_table()
        self.create_material_table()

    def _get_cursor(self):
        """获取当前线程的游标，确保连接有效"""
        self._init_db_connection()
        return self._local.cursor

    def _get_conn(self):
        """获取当前线程的连接，确保连接有效"""
        self._init_db_connection()
        return self._local.conn

    def create_table(self):
        # 创建账号表，如果不存在
        self._get_cursor().execute("""
            CREATE TABLE IF NOT EXISTS account (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                nickname TEXT NOT NULL,
                uid TEXT NOT NULL,
                cookie TEXT,
                status TEXT DEFAULT "正常",
                publish_limit INTEGER DEFAULT 0,
                create_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self._get_conn().commit()

    def create_publish_table(self):
        # 创建发布配置表，如果不存在
        self._get_cursor().execute("""
            CREATE TABLE IF NOT EXISTS publish_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                uid TEXT NOT NULL,
                platform TEXT NOT NULL,
                targets TEXT NOT NULL,
                codes TEXT NOT NULL,
                account_id TEXT NOT NULL,
                create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                
            )
        """)
        self._get_conn().commit()

    def create_material_table(self):
        # 创建素材表，如果不存在
        self._get_cursor().execute("""
            CREATE TABLE IF NOT EXISTS material (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                image_list TEXT,
                platform TEXT NOT NULL,
                account_id TEXT NOT NULL,
                nickname TEXT NOT NULL,
                status INTEGER DEFAULT 0,
                upload_time TEXT NOT NULL
            )
        """)
        self._get_conn().commit()

    def update_status(self):
        # 更新状态，如果 update_time 距离现在大于 30 天，status 设为已过期
        thirty_days_ago = datetime.now() - timedelta(days=30)
        self._get_cursor().execute(
            """
            UPDATE account
            SET status = "已过期"
            WHERE create_time < ?
        """,
            (thirty_days_ago,),
        )
        self._get_conn().commit()

    def insert_account(self, platform, nickname, uid, cookie):
        # 检查 UID 是否存在
        self._get_cursor().execute("SELECT COUNT(*) FROM account WHERE uid = ?", (uid,))
        if self._get_cursor().fetchone()[0] > 0:
            # 如果存在，更新账号信息
            self.update_account(nickname, cookie, uid)
            print("账号更新成功")
        else:
            # 如果不存在，插入新账号
            self._get_cursor().execute(
                """
                INSERT INTO account (platform, nickname, uid, cookie)
                VALUES (?, ?, ?, ?)
            """,
                (platform, nickname, uid, cookie),
            )
            self._get_conn().commit()
            print("账号插入成功")

    def get_accounts(self, uid):
        self._get_cursor().execute("SELECT * FROM account WHERE uid = ?", (uid,))
        return self._get_cursor().fetchall()

    def update_account(self, nickname=None, cookie=None, uid=None):
        if nickname is not None and cookie is not None:
            self._get_cursor().execute(
                """
                UPDATE account
                SET nickname = ?, cookie = ?
                WHERE uid = ?
            """,
                (nickname, cookie, uid),
            )
            self._get_conn().commit()
        else:
            raise ValueError("platform, uid, nickname, and cookie must all be provided for update.")

    def delete_account(self, uid):
        """根据 UID 删除账号"""
        self._get_cursor().execute("DELETE FROM account WHERE uid = ?", (uid,))
        self._get_conn().commit()

    def get_cooke(self, uid):
        self._get_cursor().execute("SELECT cookie FROM account WHERE uid=?", (uid,))
        cookie = self._get_cursor().fetchall()
        return cookie[0][0]

    def save_publish_config(self, nickname, uid, platform, targets, codes, account_id):
        # 检查 UID 是否存在
        self._get_cursor().execute("SELECT COUNT(*) FROM publish_config WHERE uid = ?", (uid,))
        if self._get_cursor().fetchone()[0] > 0:
            # 如果存在，更新发布配置
            self.update_publish_config(nickname, uid, platform, targets, codes, account_id)
            print("发布配置更新成功")
        else:
            # 如果不存在，插入新配置
            self._get_cursor().execute(
                """
                INSERT INTO publish_config (nickname, uid, platform, targets, codes, account_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (nickname, uid, platform, ",".join(targets), ",".join(codes), account_id),
            )
            self._get_conn().commit()
            print("发布配置插入成功")

    def update_publish_config(self, nickname, uid, platform, targets, codes, account_id):
        self._get_cursor().execute(
            """
            UPDATE publish_config
            SET nickname = ?, platform = ?, targets = ?, codes = ?, account_id = ?
            WHERE uid = ?
        """,
            (nickname, platform, ",".join(targets), ",".join(codes), account_id, uid),
        )
        self._get_conn().commit()

    def update_publish_config_pat(self, nickname, uid, platform, account_id):
        self._get_cursor().execute(
            """
            UPDATE publish_config
            SET nickname = ?, uid = ?,platform = ?
            WHERE account_id = ?
        """,
            (nickname, uid, platform, account_id),
        )
        self._get_conn().commit()

    def delete_publish_config(self, account_id):
        """根据 account_id 删除账号"""
        self._get_cursor().execute("DELETE FROM publish_config WHERE account_id = ?", (account_id,))
        self._get_conn().commit()

    def get_publish_configs(self, uid):
        self._get_cursor().execute("SELECT * FROM publish_config WHERE uid=?", (uid,))
        return self._get_cursor().fetchall()

    def get_publish_configs_all(self):
        self._get_cursor().execute("SELECT * FROM publish_config ")
        return self._get_cursor().fetchall()

    def insert_material(self, title, content, image_list, platform, account_id, nickname):
        """插入新的素材"""
        upload_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self._get_cursor().execute(
            """
            INSERT INTO material (title, content, image_list, platform, account_id, nickname, upload_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (
                title,
                content,
                "===".join(image_list) if isinstance(image_list, list) else image_list,
                platform,
                account_id,
                nickname,
                upload_time,
            ),
        )
        self._get_conn().commit()
        return self._get_cursor().lastrowid

    def get_material(self, material_id):
        """根据ID获取素材"""
        self._get_cursor().execute("SELECT * FROM material WHERE id = ?", (material_id,))
        return self._get_cursor().fetchone()

    def get_materials(self, status=None):
        """获取所有素材，可选按状态筛选"""
        if status is not None:
            self._get_cursor().execute(
                "SELECT * FROM material WHERE status = ? ORDER BY upload_time DESC", (status,)
            )
        else:
            self._get_cursor().execute("SELECT * FROM material ORDER BY upload_time DESC")
        return self._get_cursor().fetchall()

    def update_material_status(self, material_id, status):
        """更新素材状态"""
        self._get_cursor().execute(
            """
            UPDATE material
            SET status = ?
            WHERE id = ?
        """,
            (status, material_id),
        )
        self._get_conn().commit()

    def delete_material(self, material_id):
        """删除素材"""
        self._get_cursor().execute("DELETE FROM material WHERE id = ?", (material_id,))
        self._get_conn().commit()

    def update_publish_limit(self, uid, limit):
        """更新账号发布量限制
        Args:
            uid: 账号UID
            limit: 发布量限制
        """
        try:
            cursor = self._get_cursor()
            cursor.execute(
                """
                UPDATE account 
                SET publish_limit = ? 
                WHERE uid = ?
            """,
                (limit, uid),
            )
            self._get_conn().commit()
            return True
        except Exception as e:
            print(f"更新发布量限制失败: {str(e)}")
            return False

    def get_publish_limit(self, uid):
        """获取账号发布量限制
        Args:
            uid: 账号UID
        Returns:
            int: 发布量限制
        """
        try:
            cursor = self._get_cursor()
            cursor.execute(
                """
                SELECT publish_limit 
                FROM account 
                WHERE uid = ?
            """,
                (uid,),
            )
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            print(f"获取发布量限制失败: {str(e)}")
            return 0

    def close(self):
        if hasattr(self._local, "conn") and self._local.conn is not None:
            self._local.conn.close()
