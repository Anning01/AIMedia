@echo off

REM 首先打包更新程序
call pack_updater.bat

REM 打包主程序
python -m nuitka ^
    --mingw64 ^
    --standalone ^
    --assume-yes-for-downloads ^
    --show-progress ^
    --show-memory ^
    --plugin-enable=pyside6 ^
    --include-package-data=langchain ^
    --include-package-data=langchain_community ^
    --include-package-data=langchain_core ^
    --include-package-data=langchain_openai ^
    --include-package-data=openai ^
    --windows-icon-from-ico=docs/logo.png ^
    --output-dir=output ^
    main.py

REM 创建发布目录
if not exist "dist" mkdir dist

REM 复制主程序
copy /y "output\main.exe" "dist\AiMedia.exe"

REM 复制更新程序
copy /y "output\updater.exe" "dist\updater.exe"

REM 复制必要的文件和目录
xcopy /y /e /i "docs" "dist\docs"
xcopy /y /e /i "api" "dist\api"
xcopy /y /e /i "components" "dist\components"
xcopy /y /e /i "utils" "dist\utils"
xcopy /y /e /i "views" "dist\views"
xcopy /y /e /i "ai_model" "dist\ai_model"
xcopy /y /e /i "auto_browser" "dist\auto_browser"
xcopy /y /e /i "crawlers" "dist\crawlers"
copy /y "version.json" "dist\version.json"
copy /y "opt.json" "dist\opt.json"

REM 打包发布目录
cd dist
powershell Compress-Archive -Path *.* -DestinationPath ..\AiMedia.zip -Force
cd ..

echo 打包完成！
echo 主程序包: dist\AiMedia.exe
echo 更新包: AiMedia.zip
