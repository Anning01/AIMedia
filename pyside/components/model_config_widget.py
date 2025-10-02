from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QLineEdit, QRadioButton, QTextEdit,
    QFrame, QMessageBox, QButtonGroup, QScrollArea)
from PySide6.QtCore import Qt, QThread, Signal
from utils.model_service import ModelService

class PreviewTask(QThread):
    """预览任务线程"""
    finished = Signal(dict)
    
    def __init__(self, model_service):
        super().__init__()
        self.model_service = model_service
    
    def run(self):
        result = self.model_service.preview_task()
        self.finished.emit(result)

class ModelConfigWidget(QWidget):
    """模型配置组件"""
    
    def __init__(self):
        super().__init__()
        self.model_service = ModelService()
        self.preview_thread = None
        self.init_ui()
        self.load_config()
    
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 10, 20, 10)
        layout.setSpacing(10)
        self.setLayout(layout)
        
        # 顶部标题
        title_frame = QFrame()
        title_frame.setObjectName("titleFrame")
        title_layout = QHBoxLayout()
        title_frame.setLayout(title_layout)
        
        title = QLabel("模型配置")
        title.setObjectName("title")
        title_layout.addWidget(title)
        title_layout.addStretch()
        
        layout.addWidget(title_frame)
        
        # 创建滚动区域
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setObjectName("scrollArea")
        
        # 内容区域
        content_widget = QWidget()
        content_layout = QVBoxLayout()
        content_widget.setLayout(content_layout)
        
        # GLM配置
        glm_frame = QFrame()
        glm_layout = QHBoxLayout()
        glm_frame.setLayout(glm_layout)
        
        glm_label = QLabel("GLM API Key:")
        glm_label.setFixedWidth(100)
        self.glm_key = QLineEdit()
        self.glm_key.setPlaceholderText("请输入GLM API Key")
        self.glm_key.setMinimumHeight(40)
        glm_link = QPushButton("GLM开放平台")
        glm_link.setObjectName("linkBtn")
        glm_link.clicked.connect(lambda: self.open_platform("glm"))
        
        glm_layout.addWidget(glm_label)
        glm_layout.addWidget(self.glm_key)
        glm_layout.addWidget(glm_link)
        
        content_layout.addWidget(glm_frame)
        
        # Kimi配置
        kimi_frame = QFrame()
        kimi_layout = QHBoxLayout()
        kimi_frame.setLayout(kimi_layout)
        
        kimi_label = QLabel("Kimi API Key:")
        kimi_label.setFixedWidth(100)
        self.kimi_key = QLineEdit()
        self.kimi_key.setPlaceholderText("请输入Kimi API Key")
        self.kimi_key.setMinimumHeight(40)
        kimi_link = QPushButton("Kimi开放平台")
        kimi_link.setObjectName("linkBtn")
        kimi_link.clicked.connect(lambda: self.open_platform("kimi"))
        
        kimi_layout.addWidget(kimi_label)
        kimi_layout.addWidget(self.kimi_key)
        kimi_layout.addWidget(kimi_link)
        
        content_layout.addWidget(kimi_frame)
        
        # 模型选择
        model_frame = QFrame()
        model_layout = QVBoxLayout()
        model_frame.setLayout(model_layout)
        
        model_label = QLabel("模型选择:")
        model_layout.addWidget(model_label)
        
        radio_frame = QFrame()
        radio_layout = QHBoxLayout()
        radio_frame.setLayout(radio_layout)
        
        self.model_group = QButtonGroup()
        self.glm_radio = QRadioButton("GLM")
        self.kimi_radio = QRadioButton("Kimi")
        self.other_radio = QRadioButton("其他模型")
        self.model_group.addButton(self.glm_radio)
        self.model_group.addButton(self.kimi_radio)
        self.model_group.addButton(self.other_radio)

        radio_layout.addWidget(self.glm_radio)
        radio_layout.addWidget(self.kimi_radio)
        radio_layout.addWidget(self.other_radio)
        radio_layout.addStretch()
        
        model_layout.addWidget(radio_frame)
        
        # 其他模型配置
        self.other_frame = QFrame()
        other_layout = QVBoxLayout()
        self.other_frame.setLayout(other_layout)
        
        # API Key
        api_key_layout = QHBoxLayout()
        api_key_label = QLabel("API Key:")
        api_key_label.setFixedWidth(100)
        self.other_api_key = QLineEdit()
        self.other_api_key.setPlaceholderText("请输入API Key")
        self.other_api_key.setMinimumHeight(40)
        api_key_layout.addWidget(api_key_label)
        api_key_layout.addWidget(self.other_api_key)
        other_layout.addLayout(api_key_layout)
        
        # Base URL
        base_url_layout = QHBoxLayout()
        base_url_label = QLabel("Base URL:")
        base_url_label.setFixedWidth(100)
        self.other_base_url = QLineEdit()
        self.other_base_url.setPlaceholderText("请输入Base URL")
        self.other_base_url.setMinimumHeight(40)
        base_url_layout.addWidget(base_url_label)
        base_url_layout.addWidget(self.other_base_url)
        other_layout.addLayout(base_url_layout)
        
        # Model
        model_name_layout = QHBoxLayout()
        model_name_label = QLabel("Model:")
        model_name_label.setFixedWidth(100)
        self.other_model = QLineEdit()
        self.other_model.setPlaceholderText("请输入模型名称")
        self.other_model.setMinimumHeight(40)
        model_name_layout.addWidget(model_name_label)
        model_name_layout.addWidget(self.other_model)
        other_layout.addLayout(model_name_layout)
        
        # Temperature
        temp_layout = QHBoxLayout()
        temp_label = QLabel("Temperature:")
        temp_label.setFixedWidth(100)
        self.other_temp = QLineEdit()
        self.other_temp.setPlaceholderText("请输入temperature值")
        self.other_temp.setText("0.7")
        self.other_temp.setMinimumHeight(40)
        temp_layout.addWidget(temp_label)
        temp_layout.addWidget(self.other_temp)
        other_layout.addLayout(temp_layout)
        
        model_layout.addWidget(self.other_frame)
        self.other_frame.setVisible(False)
        
        # 连接单选按钮信号
        self.other_radio.toggled.connect(self.other_frame.setVisible)
        
        note = QLabel("注：当套餐额度达到，将自动使用已配置的模型继续任务，直到完成设置发布量")
        note.setObjectName("note")
        model_layout.addWidget(note)

        content_layout.addWidget(model_frame)

        # 发布量
        publishNum_frame = QFrame()
        publishNum_layout = QHBoxLayout()
        publishNum_frame.setLayout(publishNum_layout)

        publishNum_label = QLabel("同一账号发布间隔:")
        publishNum_label.setFixedWidth(100)
        self.publishNum = QLineEdit()
        self.publishNum.setPlaceholderText("请输入发布间隔/分钟")
        self.publishNum.setMinimumHeight(40)
        publishNum_layout.addWidget(publishNum_label)
        publishNum_layout.addWidget(self.publishNum)
        content_layout.addWidget(publishNum_frame)

        
        # Prompt配置
        prompt_frame = QFrame()
        prompt_layout = QVBoxLayout()
        prompt_frame.setLayout(prompt_layout)
        
        prompt_label = QLabel("Prompt配置:")
        self.prompt_edit = QTextEdit()
        self.prompt_edit.setPlaceholderText("请输入提示词（可选）")
        self.prompt_edit.setMinimumHeight(200)  # 从100增加到200
        
        prompt_layout.addWidget(prompt_label)
        prompt_layout.addWidget(self.prompt_edit)
        
        content_layout.addWidget(prompt_frame)
        
        # 测试文案
        test_frame = QFrame()
        test_layout = QVBoxLayout()
        test_frame.setLayout(test_layout)

        test_label = QLabel("测试文案:")
        self.test_edit = QTextEdit()
        self.test_edit.setPlaceholderText("请输入文案，格式：标题+换行+内容")
        self.test_edit.setMinimumHeight(200)  # 从100增加到200

        test_layout.addWidget(test_label)
        test_layout.addWidget(self.test_edit)

        content_layout.addWidget(test_frame)

        scroll.setWidget(content_widget)
        layout.addWidget(scroll)

        # 底部按钮
        button_frame = QFrame()
        button_layout = QHBoxLayout()
        button_frame.setLayout(button_layout)
        
        preview_btn = QPushButton("设置预览")
        preview_btn.setObjectName("previewBtn")
        preview_btn.clicked.connect(lambda: self.preview_article(self.test_edit.toPlainText().strip()))
        
        save_btn = QPushButton("保存配置")
        save_btn.setObjectName("saveBtn")
        save_btn.clicked.connect(self.save_config)
        
        button_layout.addStretch()
        button_layout.addWidget(preview_btn)
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
        # 设置样式
        self.setStyleSheet("""
            QWidget {
                background: #F8F9FA;
                color: #2C3E50;
            }
            QFrame {
                border: none;
                border-radius: 8px;
            }
            #titleFrame, #contentFrame {
                background: white;
                padding: 20px;
            }
            #scrollArea {
                background: white;
                border: none;
            }
            #scrollArea QWidget {
                background: white;
            }
            QLabel {
                color: #2C3E50;
            }
            QLabel#title {
                color: #2C3E50;
                font-size: 18px;
                font-weight: bold;
            }
            QLabel#note {
                color: #7F8C8D;
                font-size: 12px;
                margin-top: 4px;
            }
            QLineEdit, QTextEdit {
                border: 1px solid #BDC3C7;
                border-radius: 4px;
                padding: 8px;
                background: white;
                color: #2C3E50;
            }
            QLineEdit:focus, QTextEdit:focus {
                border-color: #3498DB;
            }
            QPushButton#linkBtn {
                background: none;
                border: none;
                color: #3498DB;
                padding: 8px 16px;
            }
            QPushButton#linkBtn:hover {
                color: #2980B9;
            }
            QPushButton#previewBtn, QPushButton#saveBtn {
                background-color: #3498DB;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 24px;
                font-weight: bold;
            }
            QPushButton#previewBtn {
                background-color: #2ECC71;
            }
            QPushButton#previewBtn:hover {
                background-color: #27AE60;
            }
            QPushButton#saveBtn:hover {
                background-color: #2980B9;
            }
            QRadioButton {
                spacing: 8px;
                color: #2C3E50;
            }
            QRadioButton::indicator {
                width: 16px;
                height: 16px;
                border: 2px solid #BDC3C7;
                border-radius: 9px;
                background-color: white;
            }
            QRadioButton::indicator:checked {
                background-color: #3498DB;
                border: 2px solid #3498DB;
            }
            QRadioButton::indicator:unchecked {
                background-color: white;
            }
            QScrollArea {
                border: none;
            }
            QScrollBar:vertical {
                border: none;
                background: #F8F9FA;
                width: 10px;
                margin: 0px;
            }
            QScrollBar::handle:vertical {
                background: #BDC3C7;
                border-radius: 5px;
                min-height: 20px;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
                background: none;
            }
        """)
    
    def load_config(self):
        """加载配置"""
        config = self.model_service.get_config()
        
        self.glm_key.setText(config["glm"]["api_key"])
        self.kimi_key.setText(config["kimi"]["api_key"])
        
        if "other" in config:
            self.other_api_key.setText(config["other"].get("api_key", ""))
            self.other_base_url.setText(config["other"].get("platform_url", ""))
            self.other_model.setText(config["other"].get("model", ""))
            self.other_temp.setText(str(config["other"].get("temperature", "0.7")))

        self.publishNum.setText(config["publishNum"])
        if config["selected_model"] == "glm":
            self.glm_radio.setChecked(True)
        elif config["selected_model"] == "kimi":
            self.kimi_radio.setChecked(True)
        else:
            self.other_radio.setChecked(True)
        
        self.prompt_edit.setText(config["prompt"])
    
    def get_current_config(self):
        """获取当前配置"""
        selected_model = "glm" if self.glm_radio.isChecked() else ("kimi" if self.kimi_radio.isChecked() else "other")
        
        # 验证temperature是否为有效的数值(0-2)
        try:
            temp = float(self.other_temp.text().strip())
            if not (0 <= temp <= 2):
                raise ValueError("Temperature must be between 0 and 2")
            # 如果是整数值，转换为整数类型
            temperature = int(temp) if temp.is_integer() else temp
        except ValueError:
            temperature = 0.7  # 默认值
            self.other_temp.setText(str(temperature))
        
        config = {
            "glm": {
                "api_key": self.glm_key.text().strip(),
                "platform_url": self.model_service.get_config()["glm"]["platform_url"]
            },
            "kimi": {
                "api_key": self.kimi_key.text().strip(),
                "platform_url": self.model_service.get_config()["kimi"]["platform_url"]
            },
            "other": {
                "api_key": self.other_api_key.text().strip(),
                "platform_url": self.other_base_url.text().strip(),
                "model": self.other_model.text().strip(),
                "temperature": temperature
            },
            "publishNum": self.publishNum.text().strip(),
            "selected_model": selected_model,
            "prompt": self.prompt_edit.toPlainText().strip()
        }
        return config
    
    def open_platform(self, platform):
        """打开平台链接"""
        import webbrowser
        config = self.model_service.get_config()
        webbrowser.open(config[platform]["platform_url"])
    
    def preview_article(self,topic):
        """预览文章"""
        try:
            config = self.get_current_config()
            selected_model = config["selected_model"]
            if not config[selected_model]["api_key"]:
                QMessageBox.warning(self, "警告", f"请先配置{selected_model.upper()} API Key")
                return
                
            # 移除提示词必填检查
            # 创建预览对话框
            from components.preview_dialog import PreviewDialog
            
            def preview_task():
                return self.model_service.preview_task(topic,selected_model,config[selected_model]["api_key"],self.prompt_edit.toPlainText().strip())
                
            preview_dialog = PreviewDialog(
                preview_task=preview_task,
                parent=self
            )
            preview_dialog.exec()
            
        except Exception as e:
            print(f"预览文章出错: {e}")
            QMessageBox.warning(self, "错误", f"预览失败: {str(e)}")
    
    def handle_preview_result(self, result):
        """处理预览结果"""
        msg = QMessageBox(self)
        msg.setWindowTitle("预览结果")
        msg.setText(f"标题：{result['title']}\n\n内容：{result['content']}")
        msg.setIcon(QMessageBox.Information)
        msg.exec_()
    
    def save_config(self):
        """保存配置"""
        config = self.get_current_config()
        selected_model = config["selected_model"]
        if not config[selected_model]["api_key"]:
            QMessageBox.warning(self, "警告", f"请先配置{selected_model.upper()} API Key")
            return
        
        self.model_service.save_config(config)
        
        # 使用新的消息提示
        from utils.message_popup import MessagePopup
        success_popup = MessagePopup("配置保存成功", parent=self)
        success_popup.move(
            self.mapToGlobal(self.rect().center()) - success_popup.rect().center()
        )
        success_popup.show()
