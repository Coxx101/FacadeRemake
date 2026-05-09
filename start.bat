@echo off
echo ==============================================
echo FacadeRemake 启动脚本
echo ==============================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Python 未安装或未添加到 PATH
    pause
    exit /b 1
)

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Node.js 未安装或未添加到 PATH
    pause
    exit /b 1
)

echo [步骤1/3] 启动后端服务器...
start "Backend" /D "e:\FacadeRemake\prototype" python -m uvicorn ws_server:app --host 0.0.0.0 --port 8000

REM 等待后端启动
echo [等待] 等待后端服务器启动...
timeout /t 3 /nobreak >nul

echo [步骤2/3] 安装前端依赖（如果需要）...
cd e:\FacadeRemake\frontend
if not exist node_modules (
    echo [安装] 安装前端依赖...
    npm install
)

echo [步骤3/3] 启动前端开发服务器...
npm run dev

echo ==============================================
echo 启动完成！
echo ==============================================