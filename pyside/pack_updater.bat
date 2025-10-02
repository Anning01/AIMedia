@echo off
python -m nuitka ^
    --mingw64 ^
    --standalone ^
    --assume-yes-for-downloads ^
    --show-progress ^
    --show-memory ^
    --plugin-enable=pyside6 ^
    --include-package=patoolib ^
    --windows-icon-from-ico=docs/logo.png ^
    --output-dir=output ^
    updater.py

echo Copying updater.exe to dist directory...
if not exist "dist" mkdir dist
copy /y "output\updater.exe" "dist\updater.exe"
