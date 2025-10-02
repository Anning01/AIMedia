import json

from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
    QComboBox, QPushButton, QScrollArea, QLabel, QFrame)
from PySide6.QtCore import Qt

from api.api_all import create_news, delete_account, delete_news, get_news_list
from utils.hot_spot_service import HotSpotService
from utils.account_service import AccountService

from crawlers.ithome import ITHome
from crawlers.xinlang import XinLangGuoJi
from views.article_dialog import ArticleDialog
from views.account_dialog import AccountDialog
from utils.article_service import ArticleService
from crawlers.wangyi import wangyi  # 导入wangyi模块
from crawlers.pengpai import pengpai  # 导入pengpai模块
from crawlers.zhongguoribao import ChineseDayNews  # 导入中国日报爬虫
from crawlers.tengxuxinwen import TenXuNews  # 导入腾讯新闻爬虫
from crawlers.souhu import SouHu  # 导入搜狐新闻爬虫
from crawlers.tengxuntiyu import TenXun  # 导入腾讯体育爬虫
from utils.message_popup import MessagePopup

class HotSpotWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.article_service = ArticleService()  # 添加文章服务
        self.account_service = AccountService()  # 添加账号服务
        self.hot_spot_service = HotSpotService()  # 添加热点服务
        self.current_platform = "网易新闻"  # 默认平台
        self.current_category = None
        self.current_category_code = None
        self.platform_data = HotSpotService.PLATFORM_CONFIG  # 直接从类属性获取平台配置数据
        self.wangyi_crawler = wangyi()  # 初始化网易新闻爬虫
        self.pengpai_crawler = pengpai()  # 初始化澎湃新闻爬虫
        self.zhiguoribao_crawler = ChineseDayNews()  # 初始化中国日报爬虫
        self.tengxunxinwen_crawler = TenXuNews()  # 初始化腾讯新闻爬虫
        self.souhu_crawler = SouHu()  # 初始化搜狐新闻爬虫
        self.tengxuntiyu_crawler = TenXun()  # 初始化腾讯体育爬虫
        self.xinlangguoji = XinLangGuoJi()
        self.it_honme = ITHome()
        self.init_ui()
        self.update_categories()  # 初始化分类
        # self.load_data()

    def init_ui(self):
        """初始化UI"""
        # 设置整体样式
        self.setStyleSheet("""
            QWidget {
                background: transparent;
            }
            QFrame#newsCard {
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
            }
            QFrame#newsCard:hover {
                border-color: #2ECC71;
            }
            QComboBox {
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 5px 10px;
                min-width: 100px;
                background: white;
            }
            QComboBox:hover {
                border-color: #2ECC71;
            }
            QPushButton {
                color: white;
                border: none;
                border-radius: 4px;
                padding: 5px 15px;
            }
            QPushButton:hover {
                background-color: #27AE60;
            }
            QPushButton#viewBtn {
                background-color: #2ECC71;
            }
            QPushButton#configBtn {
                background-color: #E67E22;
            }
            QPushButton#configBtn:hover {
                background-color: #D35400;
            }
            QPushButton#cancelBtn {
                background-color: #E74C3C;
            }
            QPushButton#cancelBtn:hover {
                background-color: #C0392B;
            }
            QLabel#titleLabel {
                font-weight: bold;
                font-size: 14px;
                color: #333;
                background: transparent;
                border: none;
            }
            QLabel#metaLabel {
                color: #666;
                font-size: 12px;
                background: transparent;
                border: none;
            }
        """)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        self.setLayout(layout)

        # 顶部工具栏
        toolbar = QHBoxLayout()
        toolbar.setSpacing(10)
        
        # 平台选择下拉框
        self.platform_combo = QComboBox()
        self.platform_combo.addItems(["网易新闻", "中国日报", "澎湃新闻", "搜狐新闻", "腾讯新闻", "腾讯体育","新浪国际","IT之家"])
        self.platform_combo.currentTextChanged.connect(self.on_platform_changed)
        toolbar.addWidget(self.platform_combo)

        # 分类选择下拉框
        self.category_combo = QComboBox()
        toolbar.addWidget(self.category_combo)
        self.category_combo.currentTextChanged.connect(self.on_category_changed)
        
        # 刷新按钮
        refresh_btn = QPushButton("刷新")
        refresh_btn.setObjectName("viewBtn")
        refresh_btn.clicked.connect(self.load_data)
        toolbar.addWidget(refresh_btn)
        
        toolbar.addStretch()
        layout.addLayout(toolbar)

        # 滚动区域
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        layout.addWidget(scroll)

        # 内容容器
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout()
        self.content_layout.setSpacing(10)
        self.content_widget.setLayout(self.content_layout)
        scroll.setWidget(self.content_widget)

    def on_platform_changed(self, platform_name):
        """平台变更处理"""
        self.current_platform = platform_name
        # 打印当前平台信息
        # print(f"\n当前平台: {platform_name}")
        # 更新分类并加载数据
        self.update_categories()
        self.load_data()

    def update_categories(self):
        """更新分类下拉框"""
        self.category_combo.clear()
        if self.current_platform:
            # 获取当前平台的分类列表
            for platform in self.platform_data:
                if platform["name"] == self.current_platform:
                    categories = platform["children"]
                    category_names = [cat["name"] for cat in categories]
                    self.category_combo.addItems(category_names)
                    if categories:
                        # 设置默认分类
                        self.current_category = categories[0]["name"]
                        self.current_category_code = categories[0]["code"]
                        # 打印当前分类信息
                        # print(f"当前分类: {self.current_category}")
                        # print(f"分类代码: {self.current_category_code}")
                    break

    def on_category_changed(self, category_name):
        """分类变更处理"""
        if self.current_platform:
            # 在平台数据中查找对应的分类信息
            for platform in self.platform_data:
                if platform["name"] == self.current_platform:
                    for category in platform["children"]:
                        if category["name"] == category_name:
                            self.current_category = category["name"]
                            self.current_category_code = category["code"]
                            # 打印当前分类信息
                            print(f"\n当前平台: {self.current_platform}")
                            print(f"当前分类: {self.current_category}")
                            print(f"分类代码: {self.current_category_code}")
                            self.load_data()
                            break

    def create_article_card(self, article):
        """创建文章卡片"""
        card = QFrame()
        card.setObjectName("newsCard")
        card.setFixedHeight(90)
        card.setMinimumWidth(400)
        card_layout = QHBoxLayout()
        card_layout.setContentsMargins(15, 12, 15, 12)
        card.setLayout(card_layout)

        # 文章信息
        info_layout = QVBoxLayout()
        info_layout.setSpacing(5)
        info_layout.setContentsMargins(0, 0, 0, 0)
        
        # 标题
        title = QLabel(article["title"])
        title.setObjectName("titleLabel")
        title.setWordWrap(True)
        title.setFixedHeight(40)
        info_layout.addWidget(title)
        
        # 平台、分类、时间和配置状态
        meta_text = f"{article['platform']} · {article['category']} · {article['time']}"
        # if article.get("configured_account"):
        #     meta_text += f" · 已配置: {article['configured_account']['nickname']}"
        meta = QLabel(meta_text)
        meta.setObjectName("metaLabel")
        meta.setFixedHeight(20)
        info_layout.addWidget(meta)
        
        card_layout.addLayout(info_layout, stretch=1)

        # 按钮组
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(8)
        btn_layout.setContentsMargins(0, 0, 0, 0)
        
        # 查看按钮
        view_btn = QPushButton("查看")
        view_btn.setObjectName("viewBtn")
        view_btn.setFixedSize(70, 30)
        view_btn.clicked.connect(lambda checked, a=article: self.show_article(a))
        btn_layout.addWidget(view_btn)
        
        # 配置/取消配置按钮
        if article.get("configured_account"):
            config_btn = QPushButton("取消配置")
            config_btn.setObjectName("cancelBtn")
            config_btn.setFixedSize(85, 30)  # 增加宽度以适应文字
        elif article.get("configured_other"):
            config_btn = QPushButton("他人已用")
            config_btn.setObjectName("cancelBtn")
            config_btn.setFixedSize(85, 30)  # 增加宽度以适应文字
        else:
            config_btn = QPushButton("开始配置")
            config_btn.setObjectName("configBtn")
            config_btn.setFixedSize(85, 30)
        
        config_btn.clicked.connect(lambda checked, a=article: 
            self.cancel_account_config(a) if a.get("configured_account") 
            else self.show_account_selector(a))
        btn_layout.addWidget(config_btn)
        
        card_layout.addLayout(btn_layout)
        return card

    def load_data(self):
        """加载数据"""
        if not self.current_platform or not self.current_category:
            return
        
        print(f"正在加载数据... 平台：{self.current_platform}, 分类：{self.current_category}")
        
        # 清除现有内容
        for i in reversed(range(self.content_layout.count())): 
            item = self.content_layout.itemAt(i)
            if item and item.widget():
                item.widget().deleteLater()
            self.content_layout.takeAt(i)
        
        if self.current_platform == "网易新闻":
            try:
                articles = self.wangyi_crawler.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取网易新闻数据失败：{str(e)}")
                articles = []
        elif self.current_platform == "澎湃新闻":
            try:
                articles = self.pengpai_crawler.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取澎湃新闻数据失败：{str(e)}")
                articles = []
        elif self.current_platform == "中国日报":
            try:
                articles = self.zhiguoribao_crawler.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取中国日报数据失败：{str(e)}")
                articles = []
        elif self.current_platform == "腾讯新闻":
            try:
                articles = self.tengxunxinwen_crawler.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取腾讯新闻数据失败：{str(e)}")
                articles = []
        elif self.current_platform == "搜狐新闻":
            try:
                articles = self.souhu_crawler.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取搜狐新闻数据失败：{str(e)}")
                articles = []
        elif self.current_platform == "腾讯体育":
            try:
                articles = self.tengxuntiyu_crawler.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取腾讯体育数据失败：{str(e)}")
                articles = []
        elif self.current_platform == "新浪国际":
            try:
                articles = self.xinlangguoji.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取新浪国际数据失败：{str(e)}")
                articles = []
        elif self.current_platform == "IT之家":
            try:
                articles = self.it_honme.get_news_list(self.current_category_code)
            except Exception as e:
                print(f"获取新浪国际数据失败：{str(e)}")
                articles = []
        else:
            # 其他平台暂时使用模拟数据
            articles = HotSpotService.get_mock_data()
        formatted_articles = []
        # 转换数据格式以适配现有的display_articles方法
        all_news = get_news_list()
        title_list = [item['title'] for item in all_news]
        id_list = [item['id'] for item in all_news]
        for article in articles:
            if article["title"] in title_list:
                idx = title_list.index(article["title"])
                formatted_article = {
                    "title": article["title"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "time": article["date_str"],
                    "raw_data": article,  # 保存原始数据，用于后续获取详情
                    "configured_account": {'account_id':id_list[idx]}
                }
            else:
                formatted_article = {
                    "title": article["title"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "time": article["date_str"],
                    "raw_data": article,  # 保存原始数据，用于后续获取详情
                }
            formatted_articles.append(formatted_article)

        self.articles = formatted_articles
        self.display_articles(self.articles)

    def display_articles(self, articles):
        """显示文章列表"""
        for article in articles:
            card = self.create_article_card(article)
            self.content_layout.addWidget(card)

    def filter_articles(self, _):
        """根据平台和分类筛选文章"""
        platform = self.platform_combo.currentText()
        category = self.category_combo.currentText()
        
        filtered = [a for a in self.articles if a["platform"] == platform]
            
        # 分类筛选
        if category != "全部":
            filtered = [a for a in filtered if a["category"] == category]
        
        # 清除现有内容并重新显示筛选后的文章
        self.display_filtered_articles(filtered)

    def display_filtered_articles(self, articles):
        """显示筛选后的文章列表"""
        # 清除现有内容
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()
        
        # 显示筛选后的文章
        for article in articles:
            card = self.create_article_card(article)
            self.content_layout.addWidget(card)
        
        # 添加底部弹性空间
        self.content_layout.addStretch()

    def show_article(self, article):
        """显示文章详情"""
        dialog = ArticleDialog(self)
        
        if self.current_platform == "网易新闻" and "raw_data" in article:
            try:
                # 获取文章详情
                article_detail = self.wangyi_crawler.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        elif self.current_platform == "澎湃新闻" and "raw_data" in article:
            try:
                # 获取文章详情
                article_detail = self.pengpai_crawler.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        elif self.current_platform == "中国日报" and "raw_data" in article:
            try:
                # 获取文章详情
                article_detail = self.zhiguoribao_crawler.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        elif self.current_platform == "腾讯新闻" and "raw_data" in article:
            try:
                # 获取文章详情
                article_detail = self.tengxunxinwen_crawler.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        elif self.current_platform == "搜狐新闻" and "raw_data" in article:
            try:
                # 获取文章详情
                article_detail = self.souhu_crawler.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        elif self.current_platform == "新浪国际" and "raw_data" in article:
            try:
                # 获取文章详情
                article_detail = self.xinlangguoji.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        elif self.current_platform == "IT之家" and "raw_data" in article:
            try:
                # 获取文章详情
                article_detail = self.it_honme.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        else:
            try:
                # 获取文章详情
                article_detail = self.tengxuntiyu_crawler.get_news_info(article["raw_data"])
                if not article_detail or not article_detail.get("article_info"):
                    popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                    popup.show()
                    return
                # 构造展示数据
                display_article = {
                    "title": article_detail["title"],
                    "time": article_detail["date_str"],
                    "content": article_detail["article_info"],
                    "platform": self.current_platform,
                    "category": self.current_category,
                    "raw_data": article_detail  # 保存完整数据供后续使用
                }
                dialog.set_article(display_article)
            except Exception as e:
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
        dialog.exec()
        
    def show_account_selector(self, article):
        """显示账号选择器"""
        dialog = AccountDialog(self)
        dialog.account_selected.connect(lambda account: self.configure_account(article, account))
        dialog.exec_()
        
    def configure_account(self, article, account):
        """配置文章的发布账号"""
        platform = article['platform']
        raw_data = article['raw_data']
        try:
            if platform == '网易新闻':
                data = wangyi().get_news_info(raw_data)
            elif platform == '中国日报':
                data = ChineseDayNews().get_news_info(raw_data)
            elif platform == '澎湃新闻':
                data = pengpai().get_news_info(raw_data)
            elif platform == '搜狐新闻':
                data = SouHu().get_news_info(raw_data)
            elif platform == '腾讯新闻':
                data = TenXuNews().get_news_info(raw_data)
            elif platform == '新浪国际':
                data = XinLangGuoJi().get_news_info(raw_data)
            elif platform == 'IT之家':
                data = ITHome().get_news_info(raw_data)
            else:
                data = TenXun().get_news_info(raw_data)
                
            if not data or not data.get('article_info'):
                popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
                popup.show()
                return
                
            data_d = {
                "title": data['title'],
                "article_url": data['article_url'],
                "cover_url": data['cover_url'],
                "date_str": data['date_str'],
                "article_info": data['article_info'],
                "img_list": data['img_list'],
                "account": account['id']
            }
            try:
                res = create_news(data_d)
                if res.get('id'):
                    account['account_id'] = res['id']
                    article["configured_account"] = account
                    self.display_filtered_articles(self.articles)
                    popup = MessagePopup(f"已成功配置账号: {account['nickname']}", parent=self)
                    popup.show()
            except Exception as e:
                print(str(e))
                if "已存在" in str(e):
                    account['configured_other'] = {"id":0}
                    article["configured_other"] = {"id":0}
                    popup = MessagePopup("该文章已被其他人配置", parent=self, message_type="warning")
                    popup.show()

                elif "上限" in str(e):
                    account['configured_other'] = {"id": 0}
                    article["configured_other"] = {"id": 0}
                    popup = MessagePopup("已达到账号配置上限，请调整", parent=self, message_type="warning")
                    popup.show()
                else:
                    account['configured_other'] = {"id": 0}
                    article["configured_other"] = {"id": 0}
                    popup = MessagePopup(f"{str(e)}", parent=self, message_type="error")
                    popup.show()

        except Exception as e:

            popup = MessagePopup("文章内容解析失败", parent=self, message_type="error")
            popup.show()

        
    def cancel_account_config(self, article):
        """取消文章的账号配置"""
        delete_news(article['configured_account']['account_id'])
        article.pop("configured_account", None)
        # 刷新显示
        self.display_filtered_articles(self.articles)
