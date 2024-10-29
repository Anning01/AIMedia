@echo off

REM 使用 PowerShell 设置终端输出为 UTF-8 编码
powershell -Command "chcp 65001"

REM 删除项目里的所有 .pyc 文件
echo 删除项目里的所有 .pyc 文件
for /r %%f in (*.pyc) do (
    if exist "%%f" (
        del "%%f"
    )
)


REM 删除 C 盘里的一个文件夹
set folder_to_delete=C:\selenium
echo 删除文件夹: %folder_to_delete%
if exist "%folder_to_delete%" (
    rmdir /s /q "%folder_to_delete%"
    echo 文件夹已删除
) else (
    echo 文件夹不存在
)

REM 执行 git pull
echo 执行 git pull
git pull

REM 进入虚拟环境
set venv_path=.\.venv\Scripts\activate
echo 进入虚拟环境: %venv_path%
call %venv_path%


REM 安装 requirements.txt 文件中的依赖项
echo 安装 requirements.txt 文件中的依赖项
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple --exists-action=s -r requirements.txt

REM 运行 streamlit run main.py
echo 运行 streamlit run main.py
streamlit run main.py

pause