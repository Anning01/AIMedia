import os
import shutil
import random
import shutil
import time
from datetime import datetime

from utils.article_product import article_create
from utils.hot_spot_service import HotSpotService
from utils.local_data import LocalData
from utils.precess_image import precess_image
from utils.token_check import check_user_token

from api.api_all import get_news_list, delete_news, token_report, partial_update_news, create_news, get_account_info, \
    get_news_one
from auto_browser.auto_base import AutoTools
from crawlers.spider_all import get_lsit, get_lsit_info, is_less_than_2_minutes, is_less_than_user_minutes
from utils.get_user_ope import user_opt


class TaskService:
    """任务服务"""
    category_code_map = {
        "政治": "1",
        "经济": "2",
        "社会": "3",
        "科技": "4",
        "体育": "5",
        "娱乐": "6",
        "国际": "7",
        "军事": "8",
        "文化": "9",
        "生活": "10",
        "教育": "11",
        "健康": "12",
        "民生": "13",
        "数码3C":"14",
        "时事热点": "16",
        "奇闻趣事": "17",
        "其他": "25",
        "游戏": "26"
    }

    def __init__(self):
        self._tasks = []
        self._init_mock_data()
    
    def _init_mock_data(self):
        """初始化模拟数据"""
        results = get_news_list()
        self._tasks = [
            {
                "id":item['id'],
                "nickname": item['account_name'],
                "uid": item['account_uid'],
                "title": item['title'],
                # "category":item['account_uid'],
                "platform": item['account_platform_name'],
                "status": item['status_value'],
                "start_time": item['created_at']
            }
            for item in results
        ]
    
    def get_tasks(self, status=None):
        """获取任务列表
        Args:
            status: 任务状态过滤
        """
        self._init_mock_data()
        if status and status != "全部":
            return [t for t in self._tasks if t["status"] == status]
        return self._tasks
    
    def cancel_task(self, task_id):
        """取消任务"""
        delete_news(task_id)

    def start_monitor_task(self,log):
        """启动新闻监控任务"""
        # TODO: 实现新闻监控任务
        # 获取分类
        local_data = LocalData()
        accounts = local_data.get_publish_configs_all()
        log.append_log('获取新闻监控配置')
        task = []
        for item in accounts:
            account = item[6]
            targets = item[5]
            for info in HotSpotService.PLATFORM_CONFIG:
                platform = info['name']
                for c in info['children']:
                    if c['classify'] in targets:
                        code = c['code']
                        dict_ = {
                            'platform':platform,
                            'code':code,
                            'account':account
                        }
                        task.append(dict_)

        return task



    
    def start_production_task(self,log,item):
        """启动任务生产任务"""
        # TODO: 实现任务生产任务
        try:
            is_publish,is_not_full, api_key, selected_model, prompt = check_user_token()
            print("是否可以发布：",is_publish)
            print("是否使用我们的key：",is_not_full)
            if is_publish:
                log.append_log('加载任务')
                log.append_log(f'任务平台：{item["platform"]}')
                topic = item['title'] + '\n' + item['article_info']
                log.append_log('开始生产内容')
                is_create,article = self.produce_content(topic, selected_model,api_key,prompt,item['id'],is_not_full)
                log.append_log('开始处理图片')
                img_list = precess_image(item['img_list'], item['id'], log, article)
                img_l = os.listdir(img_list)
                if len(img_l) == 3:
                    if is_create:
                        log.append_log('检测到文章已经生成，获取文章')
                        cookies = get_account_info(item['account'])
                        cookie = cookies['cookie']
                        log.append_log('开始发布，等待浏览器启动')
                        self.publish_content(article, cookie, img_list,item['platform'],item['id'])
                        log.append_log('发布成功')
                        log.append_log('清除缓存')
                    else:
                        print("删除任务")
                        self.cancel_task(item["id"])
                        log.append_log('文章生产失败，已经释放')
                else:
                    print("删除任务")
                    self.cancel_task(item["id"])
                shutil.rmtree(img_list)
            else:
                self.cancel_task(item["id"])
                log.append_log('请在模型中心配置模型和api_key')

        except Exception as e:
            print(e)
            log.append_log(f'Unexpected error: {e}')

    def produce_content(self, topic, selected_model, api_key, prompt, _id, is_not_full):
        """生产内容
        Args:
            topic: 文章主题
            selected_model: 选择的模型
            api_key: API密钥
            prompt: 提示词
            _id: 文章ID
            is_not_full: 是否使用内部模型
        Returns:
            tuple: (是否成功, 文章内容)
        """
        try:
            # 检查输入参数
            if not topic or not isinstance(topic, str):
                print("Invalid topic")
                return False, None

            # 尝试生成文章
            article, usetokens, enable = article_create(topic, selected_model, api_key, prompt, is_not_full)
            
            # 如果生成失败，直接返回
            if not article:
                print("Article generation failed")
                return False, None

            try:
                # 处理原始和新文章内容
                lines = topic.splitlines()
                original_title = lines[0].strip() if lines else ""
                original_content = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

                lines_new = article.splitlines()
                new_title = lines_new[0].strip() if lines_new else ""
                new_content = "\n".join(lines_new[1:]).strip() if len(lines_new) > 1 else ""

                # 准备报告数据
                report_data = {
                    'original_title': original_title,
                    'original_content': original_content,
                    'image_list': '',
                    'new_title': new_title,
                    'new_content': new_content,
                    'use_token': usetokens,
                    'enable': enable
                }
                # 尝试发送报告
                try:
                    token_report(report_data)
                except Exception as e:
                    print(f"Failed to send token report: {str(e)}")
                    # 继续执行，不影响主流程

                # 更新文章状态
                if len(article) > 500:
                    try:
                        partial_update_news(_id, {"status": 1})
                    except Exception as e:
                        print(f"Failed to update article status: {str(e)}")
                        # 继续返回文章内容，不影响主流程

                return True, article

            except Exception as e:
                print(f"Error processing article content: {str(e)}")
                if article:  # 如果文章内容已生成，仍然返回
                    return True, article
                return False, None

        except Exception as e:
            print(f"Error in produce_content: {str(e)}")
            return False, None

    def publish_content(self, article, cookie, img_list,platform,_id):
        """发布内容"""
        # TODO: 实现内容发布逻辑
        publish_tool = AutoTools()
        result = publish_tool.publish(cookie, article, platform, img_list)

        # 获取当前日期和时间
        now = datetime.now()
        if result["status"]:
            # 跟新文章状态
            partial_update_news(_id, {"status": 2,"published_at":now.strftime("%Y-%m-%d %H:%M:%S")})
        else:
            self.cancel_task(_id)
            # partial_update_news(_id, {"status": 3,"published_at":now.strftime("%Y-%m-%d %H:%M:%S")})
        return result

    def start_auto_publish_task(self, log):
        """启动一键托管任务"""
        log.append_log('托管启动')
        try:
            spider_task = self.start_monitor_task(log)
            if not spider_task:
                log.append_log('获取监控配置失败，请检查配置')
                return

            selected_model,api_key,config = user_opt()
            if False in [selected_model,api_key]:
                log.append_log("请先配置模型和api_key")
                time.sleep(10)
                return

            while True:
                try:
                    random.shuffle(spider_task)
                    log.append_log('开始监控')
                    publish_flag = False
                    for t in spider_task:
                        if publish_flag:
                            break

                        """获取当前账号最近发布时间"""
                        try:
                            history = get_news_list({"account__id": t['account'], "status": 2})
                            time_l = [h['published_at'] for h in history if h['published_at'] is not None]
                            max_time = max(time_l)
                            if is_less_than_user_minutes(max_time):
                                log.append_log(f'当前账号发布间隔时间不足xx，暂时跳过')
                                continue
                            else:
                                log.append_log(f'当前账号发布间隔已满足√√，开始监控')
                        except:
                            pass

                        try:
                            time.sleep(1)
                            log.append_log(f'监控平台：{t["platform"]}')
                            res = get_lsit(t['platform'], t['code'])
                            if not res:
                                log.append_log(f'获取{t["platform"]}平台数据失败，跳过')
                                continue
                            for conten in res:
                                try:
                                    date_at = conten['date_str']
                                    log.append_log(f'发布时间：{date_at}')
                                    flage = is_less_than_2_minutes(date_at)
                                    if flage:
                                        article = get_lsit_info(t['platform'], conten)
                                        if not article:
                                            log.append_log('获取文章详情失败，跳过')
                                            continue
                                        data_d = {
                                            "title": article['title'],
                                            "article_url": article['article_url'],
                                            "cover_url": article['cover_url'],
                                            "date_str": article['date_str'],
                                            "article_info": article['article_info'],
                                            "img_list": article['img_list'],
                                            "account": t['account'],
                                            "status": 5
                                        }
                                        try:
                                            res = create_news(data_d)
                                            if res:
                                                data_id = res['id']
                                                result = get_news_one(data_id)
                                                item = {
                                                    'id': result['id'],
                                                    'account': result['account'],
                                                    'platform': result['account_platform_name'],
                                                    'title': result['title'],
                                                    'article_info': result['article_info'],
                                                    'img_list': result['img_list'],
                                                    'status': result['status'],
                                                }

                                                log.append_log(f'加入成功，开始生产')
                                                self.start_production_task(log, item)
                                                publish_flag =True
                                                break
                                            else:
                                                log.append_log('创建新闻失败，跳过')
                                        except Exception as e:
                                            log.append_log(f'保存新闻: {str(e)}')
                                            continue
                                    else:
                                        log.append_log(f'发布时间大于5分钟')
                                except Exception as e:
                                    log.append_log(f'处理文章出错: {str(e)}')
                                    continue
                        except Exception as e:
                            log.append_log(f'监控平台出错: {str(e)}')
                            continue
                            
                    # 每轮监控完成后休息一下
                    log.append_log('本轮监控完成，休息60秒')
                    time.sleep(60)
                    
                except Exception as e:
                    log.append_log(f'监控循环出错: {str(e)}')
                    log.append_log('等待60秒后重试')
                    time.sleep(60)
                    continue
                    
        except Exception as e:
            log.append_log(f'托管任务出错: {str(e)}')
            log.append_log('3秒后重新启动托管任务')
            time.sleep(3)
            # 递归调用，重新启动托管任务
            self.start_auto_publish_task(log)
