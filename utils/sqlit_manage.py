import os
import sqlite3
from datetime import datetime,timedelta


# 连接到SQLite数据库（如果数据库不存在，会自动创建）
def create_conn():
    # 获取当前文件的绝对路径
    current_file_path = os.path.abspath(__file__)
    # 获取当前文件所在的目录
    current_directory = os.path.dirname(current_file_path)
    # 获取上级目录
    parent_directory = os.path.dirname(current_directory)
    db_path = os.path.join(parent_directory, 'article_task.db')
    conn = sqlite3.connect(db_path)
    return conn


def create_database(conn):
    # 创建一个游标对象(
    cursor = conn.cursor()
    # 创建一个名为'task'的表,用于
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tasks (
        nickname TEXT,
        uid TEXT PRIMARY KEY,
        classify TEXT NOT NULL,
        platform TEXT NOT NULL,
        task_num INTEGER NOT NULL,
        status BOOLEAN DEFAULT FALSE,
        create_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    # 创建 task_info 表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS task_info (
        uid TEXT NOT NULL,
        platform TEXT NOT NULL,
        task_id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        img_url_list TEXT NOT NULL,
        status TEXT NOT NULL,
        publish_time DATETIME DEFAULT '2024-01-01 00:00:00',
        create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uid) REFERENCES tasks(uid)
    )
    ''')
    # 提交事务
    conn.commit()
    cursor.close()


# 创建触发器
def set_beijin_time(conn):
    cursor = conn.cursor()
    # 创建触发器，将 create_date 列设置为北京时间
    cursor.execute('''
     CREATE TRIGGER IF NOT EXISTS set_beijing_time
     AFTER INSERT ON task_info
     BEGIN
         UPDATE task_info
         SET create_date = DATETIME(create_date, '+8 hours')
         WHERE task_id = NEW.task_id;
     END;
     ''')
    conn.commit()
    cursor.close()
    conn.close()


# 保持配置
def create_task(nickname, uid, classify, posting_cycle, platform, conn):
    cursor = conn.cursor()
    # 跟新或者创建配置
    try:
        sql1 = f'''
            INSERT OR REPLACE INTO tasks (`nickname`, `uid`, `classify`, `platform`, `platform`,`task_num`)
            VALUES ('{nickname}','{uid}', '{classify}', '{platform}', '{platform}','{posting_cycle}')
        '''
        print(sql1)
        cursor.execute(sql1)

        # 提交事务
        flag = True
    except sqlite3.Error as e:
        print(f"数据插入或更新失败: {e}")
        conn.rollback()
        flag = False
    # 删除原有已经配置的任务
    try:
        sql2 = f'''DELETE FROM task_info WHERE uid = '{uid}' '''
        cursor.execute(sql2)
    except:
        print(f"删除失败: ")

    conn.commit()
    # 关闭连接
    conn.close()
    return flag


# 查询发布量
def select_task_num(uid, conn):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT task_num,classify FROM tasks WHERE uid = ?
    ''', (uid,))
    result = cursor.fetchone()
    if result:
        task_num = f'{result[0]}'
        classify = f'{result[1]}'
    else:
        task_num = '0'
        classify = '全部'
    conn.close()
    return task_num, classify


# 获取所有账号
def get_all_data():
    conn = create_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks")
    rows = cursor.fetchall()
    result_list = list(rows)
    return result_list


# 获取当天账号已经配置任务数量
def get_publish_num_today(uid):
    conn = create_conn()
    cursor = conn.cursor()
    # 获取当前日期
    current_date = datetime.now().strftime('%Y-%m-%d')

    # 查询指定 uid 的当天数据数量
    query = f"""
    SELECT COUNT(*) FROM task_info
    WHERE uid = {uid} AND DATE(create_date) = '{current_date}' 
    """
    cursor.execute(query)

    # 获取查询结果
    result = cursor.fetchone()

    # 打印查询结果
    count = result[0]
    # 关闭数据库连接
    conn.close()
    return count


# 判断内容是否重复
def is_repeat(content):
    conn = create_conn()
    cursor = conn.cursor()
    # 查询指定 content 的数据
    query = f"""
    SELECT EXISTS(SELECT 1 FROM task_info WHERE content = ?)
    """
    cursor.execute(query, (content,))

    # 获取查询结果
    result = cursor.fetchone()

    # 关闭数据库连接
    conn.close()

    # 检查查询结果是否为空
    if result is None:
        exists = False
    else:
        exists = bool(result[0])
    return exists


# 插入任务详情
def create_task_info(uid, task_id, content, img_url_list, platform):
    conn = create_conn()
    cursor = conn.cursor()
    sql = f'''INSERT INTO task_info (uid, task_id, content, img_url_list, status, publish_time,platform) VALUES ('{uid}', '{task_id}', '{content}', '{img_url_list}', '已配置', '2023-01-01 00:00:00','{platform}')'''
    cursor.execute(sql)
    conn.commit()
    cursor.close()
    conn.close()


def load_tasks_to_queue():
    # 获取当前日期和时间
    current_date = datetime.now().strftime('%Y-%m-%d')
    current_time = datetime.now()

    # 计算1小时前的时间
    one_hour_ago = current_time - timedelta(hours=1)

    # 获取 task_info 表中的所有任务
    conn = create_conn()
    cursor = conn.cursor()

    # 执行查询，添加条件：publish_time 离当前时间大于1小时
    cursor.execute('''
        SELECT * FROM task_info 
        WHERE status != '已发布' 
        AND DATE(create_date) = ?
        AND publish_time < ?
    ''', (current_date, one_hour_ago))

    tasks = cursor.fetchall()
    cursor.close()
    conn.close()

    return tasks


# 客户端跟新任务状态
def client_update(task_id,status):
    conn = create_conn()
    # 创建游标对象
    cursor = conn.cursor()
    publish_time = datetime.now()
    # 执行更新操作

    cursor.execute(f'''UPDATE task_info SET status = '{status}',publish_time = '{publish_time}' WHERE task_id = '{task_id}' ''')

    conn.commit()
    cursor.close()


# 根据task_id 删除任务
def del_task_info_about_task_id(task_id):
    conn = create_conn()
    cursor = conn.cursor()
    # 删除原有已经配置的任务
    try:
        sql2 = f'''DELETE FROM task_info WHERE task_id = '{task_id}' '''
        cursor.execute(sql2)
    except:
        print(f"删除失败: ")
    conn.commit()
    # 关闭连接
    conn.close()
