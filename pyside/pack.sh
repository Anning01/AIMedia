#!/bin/bash

echo "Starting the build process..."

# Check if python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python3 is not installed"
    exit 1
fi

# Check if required directories exist
mkdir -p chrome temp knowledge_base output

# Run the build command
echo "Building the executable..."

python3 -m nuitka --onefile \
--enable-plugin=pyside6 \
--follow-import-to=need \
--output-dir=output \
--jobs=4 \
./main.py \
--include-module=langchain_community.chat_models.huggingface \
--include-module=langchain_community.chat_models.moonshot \
--include-module=langchain_community.chat_models.openai \
--include-module=langchain_community.chat_models.zhipuai \
--include-package=ai_model \
--include-package=api \
--include-package=auto_browser \
--include-package=components \
--include-package=crawlers \
--include-package=utils \
--include-package=views \
--include-module=requests \
--include-module=qrcode \
--include-module=PIL \
--include-package=PySide6 \
--include-package=sqlite3 \
--include-package=json \
--include-package=datetime \
--include-package=selenium \
--include-package=beautifulsoup4 \
--include-package=lxml \
--include-data-dir=docs=docs \
--nofollow-import-to=tkinter \
--enable-plugin=numpy \
--include-package=numpy \
--include-package=pandas \
--include-package=langchain \
--include-package=langchain_core \
--include-package=langchain_community \
--include-package=transformers \
--include-package=torch \
--include-package=tqdm \
--include-package=regex \
--include-package=typing \
--include-package=aiohttp \
--include-package=asyncio \
--include-package=charset_normalizer \
--include-package=dotenv \
--include-package=python-dotenv \
--include-package=os \
--include-package=sys \
--include-package=time \
--include-package=uuid \
--include-package=base64 \
--include-package=hashlib \
--include-package=urllib3 \
--include-package=certifi \
--include-package=idna \
--include-package=websockets \
--include-package=colorama \
--include-data-dir=chrome=chrome 


# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Build completed successfully!"
echo "Executable can be found in the output directory."

# Copy necessary files to output directory
echo "Copying necessary files to output directory..."
[ -f ".env" ] && cp ".env" "output/"
[ -f "opt.json" ] && cp "opt.json" "output/"
[ -f "localData.db" ] && cp "localData.db" "output/"

echo "All done!"
