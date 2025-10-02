from PySide6.QtCore import QObject, Signal
from PySide6.QtWidgets import QApplication

class ThemeManager(QObject):
    theme_changed = Signal(str)
    
    THEMES = {
        "默认蓝": {
            "primary": "#3498DB",
            "secondary": "#2C3E50",
            "background": "#ECF0F1",
            "text": "#2C3E50",
            "border": "#BDC3C7",
            "hover": "#34495E",
            "active": "#E74C3C"
        },
        "暗夜黑": {
            "primary": "#2C3E50",
            "secondary": "#34495E",
            "background": "#1A1A1A",
            "text": "#ECF0F1",
            "border": "#2C3E50",
            "hover": "#3498DB",
            "active": "#E74C3C"
        },
        "森林绿": {
            "primary": "#27AE60",
            "secondary": "#2C3E50",
            "background": "#ECF0F1",
            "text": "#2C3E50",
            "border": "#BDC3C7",
            "hover": "#219A52",
            "active": "#E74C3C"
        },
        "深紫色": {
            "primary": "#8E44AD",
            "secondary": "#2C3E50",
            "background": "#ECF0F1",
            "text": "#2C3E50",
            "border": "#BDC3C7",
            "hover": "#703688",
            "active": "#E74C3C"
        },
        "橙色调": {
            "primary": "#D35400",
            "secondary": "#2C3E50",
            "background": "#ECF0F1",
            "text": "#2C3E50",
            "border": "#BDC3C7",
            "hover": "#A04000",
            "active": "#E74C3C"
        },
        "科技银": {
            "primary": "#95A5A6",
            "secondary": "#2C3E50",
            "background": "#ECF0F1",
            "text": "#2C3E50",
            "border": "#BDC3C7",
            "hover": "#7F8C8D",
            "active": "#E74C3C"
        },
        "粉色调": {
            "primary": "#E91E63",
            "secondary": "#2C3E50",
            "background": "#ECF0F1",
            "text": "#2C3E50",
            "border": "#BDC3C7",
            "hover": "#C2185B",
            "active": "#E74C3C"
        },
        "金色调": {
            "primary": "#F1C40F",
            "secondary": "#2C3E50",
            "background": "#ECF0F1",
            "text": "#2C3E50",
            "border": "#BDC3C7",
            "hover": "#D4AC0D",
            "active": "#E74C3C"
        }
    }
    
    def __init__(self):
        super().__init__()
        self._current_theme = "默认蓝"
    
    def get_current_theme(self):
        return self._current_theme
    
    def get_theme_colors(self):
        return self.THEMES[self._current_theme]
    
    def set_theme(self, theme_name):
        if theme_name in self.THEMES:
            self._current_theme = theme_name
            self.apply_theme()
            self.theme_changed.emit(theme_name)
    
    def get_theme_names(self):
        return list(self.THEMES.keys())
    
    def apply_theme(self):
        colors = self.get_theme_colors()
        QApplication.instance().setStyleSheet(f"""
            /* 主窗口样式 */
            QMainWindow {{
                background-color: {colors['background']};
            }}
            
            /* 侧边栏样式 */
            #sidebar {{
                background-color: {colors['secondary']};
                color: {colors['text']};
                border-right: 1px solid {colors['border']};
            }}
            
            #logo {{
                padding: 20px 0;
            }}
            
            /* 导航按钮样式 */
            #nav_button {{
                border: none;
                text-align: left;
                padding: 10px 20px;
                color: #ECF0F1;
                background-color: transparent;
            }}
            
            #nav_button:hover {{
                background-color: {colors['hover']};
            }}
            
            #nav_button:checked {{
                background-color: {colors['primary']};
                border-left: 4px solid {colors['active']};
            }}
            
            /* 内容区样式 */
            #content_area {{
                background-color: {colors['background']};
            }}
            
            /* 标题栏样式 */
            #title_bar {{
                background-color: white;
                border-bottom: 1px solid {colors['border']};
            }}
            
            #page_title {{
                color: {colors['text']};
            }}
            
            /* 主题切换按钮样式 */
            #theme_button {{
                padding: 8px 15px;
                background-color: {colors['primary']};
                color: white;
                border: none;
                border-radius: 4px;
            }}
            
            #theme_button:hover {{
                background-color: {colors['hover']};
            }}
            
            #theme_menu {{
                background-color: white;
                border: 1px solid {colors['border']};
            }}
            
            #theme_menu::item {{
                padding: 8px 20px;
            }}
            
            #theme_menu::item:selected {{
                background-color: {colors['primary']};
                color: white;
            }}
            
            /* 用户信息样式 */
            #user_info {{
                background-color: white;
                border: 1px solid {colors['border']};
                border-radius: 5px;
                padding: 5px;
            }}
            
            /* 滚动区域样式 */
            QScrollArea {{
                border: none;
                background-color: transparent;
            }}
            
            QScrollBar:vertical {{
                border: none;
                background: {colors['background']};
                width: 10px;
                margin: 0;
            }}
            
            QScrollBar::handle:vertical {{
                background: {colors['border']};
                min-height: 20px;
                border-radius: 5px;
            }}
            
            QScrollBar::add-line:vertical,
            QScrollBar::sub-line:vertical {{
                border: none;
                background: none;
            }}
            
            /* 页面内容样式 */
            QLabel[objectName^="label_"] {{
                color: {colors['text']};
                background-color: white;
                border-radius: 10px;
                padding: 40px;
                border: 1px solid {colors['border']};
            }}
            
            /* 弹出框样式 */
            #user_info_popup {{
                background-color: white;
                border: 1px solid {colors['border']};
                border-radius: 8px;
            }}
            
            /* VIP标签样式 */
            #vip_label {{
                color: #F1C40F;
                font-weight: bold;
            }}
            
            #non_vip_label {{
                color: gray;
            }}
        """)
