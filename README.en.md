<div align="center">
<h1 align="center"> AIMedia 🤖 </h1>

<p align="center">
  <a href="https://github.com/Anning01/AIMedia/stargazers"><img src="https://img.shields.io/github/stars/Anning01/AIMedia.svg?style=for-the-badge" alt="Stargazers"></a>
  <a href="https://github.com/Anning01/AIMedia/issues"><img src="https://img.shields.io/github/issues/Anning01/AIMedia.svg?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/Anning01/AIMedia/network/members"><img src="https://img.shields.io/github/forks/Anning01/AIMedia.svg?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/Anning01/AIMedia/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anning01/AIMedia.svg?style=for-the-badge" alt="License"></a>
</p>
<br>
<h3>简体中文 | <a href="README-en.md">English</a></h3>
<div align="center">
  <a href="https://github.com/Anning01/AIMedia" target="_blank"><img src="docs/logo.png" style="width: 120px; height: 120px; border-radius: 50%;"/></a>
</div>
<br>
Automatically capture trending topics, auto-generate news, and automatically publish to major platforms. <b>Fully automated AI-powered media software</b>
<br>
</div>

## Features 🎯

- [x] Supports **trending news capture**, automatically fetching trending news from major platforms
    - [x] Douyin Trending
    - [x] NetEase News
    - [ ] Weibo Trending
- [x] Supports **AI-based auto-news creation**, with automatic publishing to various platforms
    - [x] Today’s Headlines
    - [ ] Little Red Book
    - [ ] WeChat Official Accounts
    - [ ] Baijia Platform
- [x] For text-only content, AI generates images to increase originality and improve reader engagement.

### Future Plans 📅

- [ ] Auto-generate videos for publishing across platforms

## Community & Discussions 💬

<img src="docs/wechat.png" width="250">

## Video Demonstration 📺

Bilibili video link：https://www.bilibili.com/video/BV1oYSVYaEaa/?share_source=copy_web&vd_source=998582dcaa6c1a862619086e9dda59cb

## Requirements 📦

- Minimum recommended: CPU with 4 cores or more, 8GB of RAM or more, GPU is not required
- Windows 10 or above

## Quick Start 🚀

Download the one-click startup package, extract, and use directly (avoid paths with **Chinese characters**, **special characters**, or **spaces**).

### Windows
- Baidu Drive: https://pan.baidu.com/s/1YIV2avc_i5V8IcltWoFh1g  Code: 99k1

After downloading, first extract `venv.tar.gz` to the `venv` folder in the current directory. The structure should look like this:


```
AIMedia  
  ├─venv
  ├─main.py
  ├─chrome
  ├─...
```


It is recommended to **double-click** `update.bat` first to update to the **latest code** (requires Git). Then right-click to **run as administrator** `webui.bat` to start.

After startup, the browser will open automatically (if a blank page opens, try using **Chrome** or **Edge**).

### Other Systems

Not supported; only Windows is supported.

## Installation & Deployment 📥

### Prerequisites

- Avoid using **paths with Chinese characters** to prevent unforeseen issues.
- Make sure your **network** is stable; VPN should be in "global traffic" mode.

#### ① Clone the Code

```shell
git clone https://github.com/Anning01/AIMedia.git
```
#### ② Edit the Configuration File

- Copy the `config.py` file and name it `local_config.py`.
- Configure `zhipu_aip_key` as specified in `config.py`. Enable the Stable Diffusion API if you need AI-generated images.

### Manual Deployment 📦

> Video Tutorial

- Full usage demonstration: Bilibili video link：https://www.bilibili.com/video/BV1oYSVYaEaa/?share_source=copy_web&vd_source=998582dcaa6c1a862619086e9dda59cb
- How to deploy on Windows: In progress `(*>﹏<*)′~

#### ① Create a Virtual Environment (Conda)

It is recommended to use [conda](https://www.anaconda.com/download/success) to create a Python virtual environment.

```shell
git clone https://github.com/Anning01/AIMedia.git
cd AIMedia
conda create -n AIMedia python=3.12.4
conda activate AIMedia
pip install -r requirements.txt
```

#### ② Start the Web Interface 🌐

Be sure to execute the following command in the AIMedia project `root directory`.

###### Windows

```bat
conda activate AIMedia
streamlit run main.py
```
#### ① Using venv (Ensure Python version 3.12.4)

```shell
git clone https://github.com/Anning01/AIMedia.git
cd AIMedia
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

#### ② Start the Web Interface 🌐

Be sure to execute the following command in the AIMedia project `root directory`.

###### Windows

```bat
streamlit run main.py
Or
.\webui.bat（not supported with Conda）
```

> Note：Our auto-publish feature depends on the Chrome beta version, which must be downloaded manually.

Download link:：

- Baidu Drive: Link:：https://pan.baidu.com/s/1x6J3K4KdWrI9vOG8yvSSBw  Code：7jyw

After downloading and extracting the model, place the entire directory in `.\AIMedia`,
so the final file path should look like this: `.\AIMedia\chrome`.

## Feedback & Suggestions 📢

- You can submit an [issue](https://github.com/Anning01/AIMedia/issues)
  or a [pull request](https://github.com/Anning01/AIMedia/pulls).

## License 📝

Click to view the [`LICENSE`](LICENSE) file.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Anning01/AIMedia&type=Date)](https://star-history.com/#Anning01/AIMedia&Date)
