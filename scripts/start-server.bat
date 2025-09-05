@echo off
setlocal enabledelayedexpansion

:: LinkedIn Data Extractor - Server Start Script
echo ===============================================
echo LinkedIn Data Extractor Server Startup
echo ===============================================
echo.

:: Change to project directory
cd /d "%~dp0\.."

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH
    pause
    exit /b 1
)

:: Display Node.js and npm versions
echo [INFO] Node.js version:
node --version
echo [INFO] npm version:
npm --version
echo.

:: Kill processes on target ports first
echo [INFO] Cleaning up existing processes on ports 3000-3005...
call "%~dp0\stop-server.bat" silent
echo.

:: Install dependencies if needed
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed successfully
    echo.
)

:: Find available port
set "TARGET_PORT="
for %%p in (3000 3001 3002 3003 3004 3005) do (
    echo [INFO] Checking port %%p...
    netstat -ano | findstr ":%%p " >nul 2>&1
    if errorlevel 1 (
        set "TARGET_PORT=%%p"
        echo [SUCCESS] Port %%p is available
        goto :found_port
    ) else (
        echo [WARNING] Port %%p is occupied
    )
)

:found_port
if "%TARGET_PORT%"=="" (
    echo [ERROR] No available ports found in range 3000-3005
    echo Please manually kill processes or restart your computer
    pause
    exit /b 1
)

:: Update environment file
echo [INFO] Updating environment configuration for port %TARGET_PORT%...
if exist ".env.local" (
    powershell -Command "(Get-Content '.env.local') -replace 'NEXT_PUBLIC_APP_URL=http://localhost:\d+', 'NEXT_PUBLIC_APP_URL=http://localhost:%TARGET_PORT%' | Set-Content '.env.local'"
) else (
    echo [WARNING] .env.local not found, using default configuration
)

:: Update Chrome extension default API URL
echo [INFO] Updating Chrome extension configuration...
if exist "extension\background.js" (
    powershell -Command "(Get-Content 'extension\background.js') -replace 'http://localhost:\d+/api', 'http://localhost:%TARGET_PORT%/api' | Set-Content 'extension\background.js'"
)
if exist "extension\popup.html" (
    powershell -Command "(Get-Content 'extension\popup.html') -replace 'http://localhost:\d+/api', 'http://localhost:%TARGET_PORT%/api' | Set-Content 'extension\popup.html'"
)

echo [SUCCESS] Configuration updated for port %TARGET_PORT%
echo.

:: Start the server
echo [INFO] Starting LinkedIn Data Extractor Server on port %TARGET_PORT%...
echo [INFO] Server URL: http://localhost:%TARGET_PORT%
echo [INFO] API Base URL: http://localhost:%TARGET_PORT%/api
echo.
echo ===============================================
echo Server is starting... Press Ctrl+C to stop
echo ===============================================
echo.

:: Start server with error handling
npm run dev -- --port %TARGET_PORT%
if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start
    echo Please check the error messages above
    pause
    exit /b 1
)

pause