<div align="center">
<h1 align="center"> AIMedia </h1>

<p align="center">
  <a href="https://github.com/Anning01/AIMedia/stargazers"><img src="https://img.shields.io/github/stars/Anning01/AIMedia.svg?style=for-the-badge" alt="Stargazers"></a>
  <a href="https://github.com/Anning01/AIMedia/issues"><img src="https://img.shields.io/github/issues/Anning01/AIMedia.svg?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/Anning01/AIMedia/network/members"><img src="https://img.shields.io/github/forks/Anning01/AIMedia.svg?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/Anning01/AIMedia/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anning01/AIMedia.svg?style=for-the-badge" alt="License"></a>
</p>
<br>
<h3><a href="README.md">简体中文</a> | English</h3>
<div align="center">
  <a href="https://github.com/Anning01/AIMedia" target="_blank"><img src="pyside/docs/logo.png" style="width: 120px; height: 120px; border-radius: 50%;" alt="AIMedia Logo"/></a>
</div>
<br>
Automatically capture trending topics, auto-generate news, and publish to major platforms. <b>Fully automated AI-powered media software</b>
<br>
<br>
New Architecture: <b>Django</b> Backend + <b>PySide6</b> Desktop Client, providing enterprise-grade stability and excellent user experience
<br>
</div>

> **Warning**
>
> This is an **enterprise-level project** that includes a complete Django backend service, PySide6 desktop client, and integrates WeChat Pay, login, and other enterprise features.
>
> **To use this project, you need to:**
> - Deploy the Django backend service yourself
> - Package the PySide6 desktop application
> - Configure databases, payment interfaces, and other complex environments
>
> **New Version in Development: [AiMaster](https://github.com/Anning01/AiMaster)**
>
> We are developing a lighter, more stable new version using:
> - **FastAPI** backend (replacing Django, lighter)
> - **Browser extension** client (no packaging required, ready to use)
> - **Official Account API** direct calls (more stable and reliable)
>
> The new version is more suitable for quick deployment and use, stay tuned!
>
> Developers interested only in web scraping can check [article-spider](https://github.com/Anning01/article-spider)

## Project Architecture

This project uses a frontend-backend separation architecture, consisting of two main parts:

### Backend Service - Django (back/)
- RESTful API interface
- Database management and persistence
- Task scheduling and automation
- Trending news scraping service
- AI content generation engine
- Multi-platform publishing management

### Frontend Application - PySide6 (pyside/)
- Intuitive graphical user interface
- Local task management
- Real-time data monitoring
- Configuration management panel
- Cross-platform desktop application

### Tech Stack
- **Backend**: Django 5.x + Django REST Framework
- **Frontend**: PySide6 (Qt for Python)
- **Database**: SQLite / PostgreSQL / MySQL
- **AI**: Zhipu AI + Stable Diffusion
- **Automation**: Selenium + Chrome

## Features

### Trending News Scraping
- [x] Douyin Trending
- [x] NetEase News
- [x] Weibo Trending
- [x] The Paper
- [x] China Daily
- [x] Sohu News

### AI Smart Creation
- [x] AI auto-creation based on trending news
- [x] AI image generation (increase originality)
- [x] Multi-platform content adaptation

### Multi-platform Publishing
- [x] Toutiao (Today's Headlines)
- [x] Tencent Content Platform
- [x] WeChat Official Accounts
- [x] Baijia Platform

### System Management
- [x] Django admin system
- [x] PySide6 desktop client
- [x] Task scheduling and monitoring
- [x] Configuration management
- [x] WeChat Pay integration
- [x] WeChat login integration

## Deployment Notes

**This is an enterprise-level project**, not suitable for out-of-the-box use. Please fully understand the following requirements before use:

### Technical Requirements
- Django project deployment experience required
- PySide6 application packaging knowledge required
- WeChat Pay, login, and other third-party interfaces need to be configured
- Database services need to be set up and maintained

### Deployment Workload
- **Backend deployment**: Django server configuration, database migration, environment variable configuration, etc.
- **Frontend packaging**: PySide6 application compilation, dependency packaging, icon resources, etc.
- **Interface configuration**: WeChat Pay merchant ID, application keys, callback URLs, etc.
- **Operations maintenance**: Log monitoring, error handling, version updates, etc.

**If you need a lighter, easier-to-use solution, please follow the new version [AiMaster](https://github.com/Anning01/AiMaster)!**

### Future Plans

> **Note**: This project (AIMedia) as an enterprise-level version will focus on stability for future maintenance.
>
> New feature development has been migrated to the lighter new version **[AiMaster](https://github.com/Anning01/AiMaster)**, using FastAPI + browser extension architecture, easier to deploy and use.

- [ ] ~~Auto-generate videos for publishing across platforms~~ (will be implemented in AiMaster)
- [ ] ~~Mobile application development~~ (will be implemented in AiMaster)
- [ ] ~~More platform integration~~ (will be implemented in AiMaster)
- [x] Bug fixes and stability maintenance

## Requirements

### Hardware Requirements
- CPU: 4 cores or more
- Memory: 8GB or more
- Disk: 10GB available space
- GPU: Not required (recommended for AI image generation)

### Software Requirements
- Windows 10 or above
- Python 3.12.4
- Chrome browser (required for automated publishing)

## Quick Start

#### Prerequisites
- Avoid using **paths with Chinese characters** to prevent unforeseen issues
- Make sure your **network** is stable; VPN should be in "global traffic" mode

#### 1. Clone the Code

```shell
git clone https://github.com/Anning01/AIMedia.git
cd AIMedia
```

#### 2. Create Virtual Environment

**Using Conda (Recommended)**

```shell
conda create -n AIMedia python=3.12.4
conda activate AIMedia
pip install -r requirements.txt
```

**Using venv**

```shell
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

#### 3. Configure Project

- Copy `config.py` file and name it `local_config.py`
- Configure `zhipu_aip_key` as specified in `config.py`
- Enable and configure Stable Diffusion API if you need AI image generation

#### 4. Download Chrome Browser (Required for Auto-publishing)

Download link:
- Baidu Drive: https://pan.baidu.com/s/1x6J3K4KdWrI9vOG8yvSSBw  Code: 7jyw

After downloading, extract and place the entire directory in `.\AIMedia\pyside`, so the final path should be: `.\AIMedia\pyside\chrome`

#### 5. Start the Project

Please refer to the documentation for backend and frontend respectively:

- **Django Backend**: See [back/README.md](back/README.md)
- **PySide6 Frontend**: See [pyside/README.md](pyside/README.md)

## Project Structure

```
AIMedia/
├── back/                   # Django Backend
│   ├── manage.py          # Django management script
│   ├── config/            # Project configuration
│   ├── apps/              # Application modules
│   └── ...
├── pyside/                # PySide6 Frontend
│   ├── main.py            # Main entry
│   ├── ui/                # UI interface
│   ├── utils/             # Utility functions
│   └── ...
├── docs/                  # Documentation resources
├── config.py              # Configuration template
├── requirements.txt       # Python dependencies
├── LICENSE                # License
└── README.md              # Project description
```

## Video Demo

Bilibili video link: https://www.bilibili.com/video/BV1HABgYKE6H

## Community & Discussions

<img src="pyside/docs/wechat.png" width="250" alt="WeChat QR Code">

## Feedback & Suggestions

- You can submit an [issue](https://github.com/Anning01/AIMedia/issues)
  or a [pull request](https://github.com/Anning01/AIMedia/pulls)

## License

Click to view the [LICENSE](LICENSE) file

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Anning01/AIMedia&type=Date)](https://star-history.com/#Anning01/AIMedia&Date)