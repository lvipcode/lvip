@echo off
echo Starting LinkedIn Data Extraction System...
echo.

echo ========================================
echo Step 1: Force closing existing services
echo ========================================

echo Killing Node.js processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im npx.exe >nul 2>&1

echo Killing processes using port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Killing processes using port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8080"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Killing Chrome processes...
taskkill /f /im chrome.exe >nul 2>&1
taskkill /f /im msedge.exe >nul 2>&1

echo Waiting for processes to terminate...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo Step 2: Starting required services
echo ========================================

echo Installing dependencies...
call npm install

echo Starting development server...
start "LinkedIn System Server" cmd /c "npm run dev"

echo Waiting for server to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo System Status
echo ========================================

echo Checking if server is running on port 3000...
netstat -an | find ":3000" >nul
if %errorlevel% == 0 (
    echo [SUCCESS] Server is running on http://localhost:3000
) else (
    echo [WARNING] Server may still be starting up
)

echo.
echo ========================================
echo Next Steps
echo ========================================
echo 1. Open browser and go to http://localhost:3000
echo 2. Install Chrome extension from extension/ folder
echo 3. Configure extension API URL to http://localhost:3000/api
echo.

echo System startup completed!
pause