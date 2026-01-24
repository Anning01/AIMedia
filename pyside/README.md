# AI Media Plus

一个基于 PySide6 的智能媒体管理应用，支持热点抓取、AI 写作、多平台自动发布等功能。

## 功能特点

- **实时热点** - 聚合多个新闻源的热点内容（IT之家、澎湃、搜狐、腾讯、网易、新浪等）
- **账号管理** - 管理多个自媒体平台账号（微信公众号、百家号、企鹅号等）
- **任务中心** - 统一管理内容创作和发布任务
- **一键托管** - 自动化内容发布到多个平台
- **模型配置** - 配置 AI 模型（OpenAI、智谱AI、Moonshot 等）
- **素材导入** - 批量导入和管理媒体素材
- **多种登录方式** - 支持微信扫码登录和账号密码登录（OpenID + Password）
- **自动更新** - 支持应用自动检测和更新

## 环境要求

- Python 3.12+
- 支持 Windows / macOS

## 安装依赖

```bash[README.md](../../../../ai-media-plus/README.md)
# 使用 pip
pip install -r requirements.txt

# 或使用 uv（推荐）
uv sync
```

## 配置后端地址

在运行应用前，需要配置后端 API 地址。编辑 `api/request_handler.py` 文件：

```python
BASE_URL = "http://your-backend-server.com/api"  # 修改为实际的后端地址
```

## 运行应用

```bash
python main.py
```

首次运行时会显示登录方式选择界面，支持两种登录方式：

### 微信扫码登录
- 显示微信二维码
- 使用微信扫描后确认登录

### 账号密码登录
- 输入 OpenID 和密码进行登录
- 适用于不方便扫码的场景

## 操作说明

### 1. 实时热点
- 浏览多个新闻源的热点文章
- 一键采集感兴趣的内容
- 支持 AI 改写和优化

### 2. 账号管理
- 添加和管理自媒体平台账号
- 支持微信公众号、百家号、企鹅号等平台
- 通过浏览器自动化完成账号绑定

### 3. 任务中心
- 查看所有创作和发布任务
- 管理任务状态和进度
- 支持任务的批量操作

### 4. 一键托管
- 配置自动发布规则
- 设置发布时间和频率
- 多平台同步发布

### 5. 模型配置
- 配置 AI 模型的 API Key
- 支持多种模型提供商
- 调整模型参数

### 6. 素材导入
- 批量导入图片、视频等素材
- 素材分类和标签管理
- 知识库构建

## 打包发布

### macOS / Linux

使用 Nuitka 进行打包：

```bash
# 赋予执行权限
chmod +x pack.sh

# 执行打包脚本
./pack.sh
```

### Windows

```bash
python -m nuitka --onefile ^
    --enable-plugin=pyside6 ^
    --output-dir=output ^
    --jobs=4 ^
    ./main.py ^
    --include-package=ai_model ^
    --include-package=api ^
    --include-package=auto_browser ^
    --include-package=components ^
    --include-package=crawlers ^
    --include-package=utils ^
    --include-package=views ^
    --include-data-dir=docs=docs ^
    --include-data-dir=chrome=chrome
```

打包完成后，可执行文件位于 `output` 目录。

### 打包后的目录结构

```
output/
├── main.exe (或 main.bin)   # 主程序
├── docs/                     # 资源文件
├── chrome/                   # 浏览器驱动
├── version.json              # 版本信息
└── .env (可选)               # 环境配置
```

## 项目结构

```
pyside/
├── main.py                 # 程序入口
├── api/                    # API 请求处理
├── ai_model/               # AI 模型集成
├── auto_browser/           # 浏览器自动化
├── components/             # UI 组件
├── crawlers/               # 新闻爬虫
├── views/                  # 视图/窗口
├── utils/                  # 工具函数
├── docs/                   # 资源文件
├── config/                 # 配置文件
├── version.json            # 版本信息
├── requirements.txt        # 依赖清单
└── pack.sh                 # 打包脚本
```

## 常见问题

### 1. 运行时提示缺少模块
确保已安装所有依赖：
```bash
pip install -r requirements.txt
```

### 2. 浏览器自动化失败
确保 `chrome` 目录下有对应系统的 ChromeDriver，或让程序自动下载：
```bash
pip install webdriver-manager
```

### 3. 字体显示异常
程序会自动选择系统可用字体，如需自定义可修改 `main.py` 中的字体配置。

## 版本信息

当前版本：1.0.0

查看 `version.json` 了解详细版本信息。

## selenium 链接超时
<img width="795" height="272" alt="3017d274ad99289d06de215a33fc6aa0" src="https://github.com/user-attachments/assets/63bdccfd-4c95-46c4-93b5-9ed09e25cf58" />
<img width="1821" height="342" alt="image" src="https://github.com/user-attachments/assets/cc37461f-02cf-4db5-9202-e5184afa4042" />

把按照的环境包中的\venv\Lib\site-packages\webdriver_manager\drivers\chrome.py替换

## License

MIT License
