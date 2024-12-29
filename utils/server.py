import socket, os, queue, json, time
import subprocess
import sys
import random

# 以下依赖不能删除，哪怕当前页面没有使用
nas_path = os.path.dirname(__file__)
helper_dir = os.path.dirname(os.path.abspath('__file__'))
sys.path.insert(0, nas_path)
parent_path = os.path.dirname(nas_path)
sys.path.insert(0, parent_path)
from sqlit_manage import *
from get_hot_data import *
from config import *
from ai_tools import title_clas

class Service(object):
    host = '127.0.0.1'
    port = 1288
    queue = queue.Queue()



    def __init__(self):
        self.service = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.service.bind((self.host, self.port))
        self.service.listen(5)
        time.sleep(2)

    def run(self):
        # self.net_start()
        # 获取本地账号信息
        result_list = get_all_data()
        # 生成任务，写入数据库
        for row in result_list:
            nickname, uid, classify, platform, task_num, status, create_date = row
            # 判断当前账号剩余配置任务
            publish_num = get_publish_num_today(uid)
            remaining_tasks = int(task_num) - publish_num
            if remaining_tasks< 0:
                remaining_tasks = 0
            print(f"账号:{nickname}---{uid},今天已配置：{publish_num}，还剩余：{remaining_tasks}个任务。")
            if remaining_tasks > 0:
                # 翻页
                page_idx = 0
                while remaining_tasks > 0 and page_idx < 3:
                    page_idx += 1
                    # 获取热点信息,需要有随机性，当前只有抖音，网易，需要随机使用一种
                    hot_platform = [wangyi]
                    selected_function = random.choice(hot_platform)
                    # 运行选中的函数
                    print(f'获取最新热点信息...{page_idx}')
                    hot_data = selected_function(page_idx)

                    for item in hot_data:
                        if classify != '全部':
                            # 获取当前文章的分类
                            try:
                                cls = title_clas(item['article_info'])
                            except:
                                cls = '未知'
                        else:
                            cls = '全部'

                        # 当前有缺陷，后期必须把任务上云，否则只能局部用户去重，无法全局去重,已经没有真正意义对文章去重
                        repeat_flag = is_repeat(item['article_info'].replace(' ',''))
                        if cls == classify and repeat_flag is False:
                            print('当前热点符合条件!')
                            # 符合条件插入数据库
                            task_id = f"{uid}_{nickname}_{''.join(random.choices('0123456789', k=8))}"
                            create_task_info(uid, task_id, item['article_info'].replace(' ',''), json.dumps(item['img_list']),platform)
                            remaining_tasks -= 1
                        else:
                            print('当前热点不符合条件!')

                        if remaining_tasks <= 0:
                            break

            else:
                print(f"当前账号今天已发布：{publish_num},已全部完成！")

        # 获取资源 写入队列
        # 将任务转换为字典格式并放入队列
        tasks = load_tasks_to_queue()
        opted = []
        opt = []
        for task in tasks:
            if task[0] not in opted:
                task_dict = {
                    'uid': task[0],
                    'platform':task[1],
                    'task_id': task[2],
                    'content': task[3],
                    'img_url_list': task[4],
                    'status': task[5],
                    'publish_time': task[6],
                    'create_date': task[7]
                }
                opted.append(task[0])
                opt.append(task[0])
                self.queue.put(task_dict)
        print(f'获取任务数量：{len(opt)},其他等待下一轮')
        print("任务初始化完成，等待机器人工作...")
        while True:
            client, addr = self.service.accept()
            print(f'【客户端信息】...{addr}')
            if self.queue.empty():
                rsp = {
                    'status': False,
                    'message': '当前无任务'
                }
            else:
                data = self.queue.get()
                rsp = {
                    'status': True,
                    'message': 'success',
                    'data': data
                }
            print(f'【发送数据】: {rsp}')
            client.send(json.dumps(rsp, ensure_ascii=False).encode('utf-8'))
            client.close()
            print('【发送完毕！！！】')
            print(f'-------------{time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())}-------------')
            if not rsp["status"]:
                break
    def start(self):
        current_file_path = os.path.abspath(__file__)
        # 构建命令
        command = ['cmd', '/c', 'start', 'cmd', '/k', 'python', current_file_path]
        # 运行命令并捕获输出
        subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                       creationflags=subprocess.CREATE_NEW_CONSOLE)

if __name__ == '__main__':
    os.system(f'title=中控服务')
    s = Service()

    while True:
        try:
            s.run()
        except Exception as e:
            print(f"Error: {e}")