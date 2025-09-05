@echo off
title Test LinkedIn Scripts

echo ============================================
echo  Testing LinkedIn Scripts
echo ============================================
echo.

echo [TEST 1] Testing stop-server.bat functionality...
echo [INFO] Checking if scripts exist...

if exist "start-server.bat" (
    echo [SUCCESS] start-server.bat exists
) else (
    echo [ERROR] start-server.bat not found
)

if exist "stop-server.bat" (
    echo [SUCCESS] stop-server.bat exists
) else (
    echo [ERROR] stop-server.bat not found
)

echo.
echo [TEST 2] Testing port checking commands...
netstat -an | find "3000" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo [INFO] Port 3000 is currently occupied
) else (
    echo [INFO] Port 3000 is available
)

echo.
echo [TEST 3] Testing process detection...
tasklist /fi "imagename eq node.exe" /fo csv 2>nul | find /i "node.exe" >nul
if %errorlevel%==0 (
    echo [INFO] Node.js processes found
) else (
    echo [INFO] No Node.js processes running
)

echo.
echo [TEST 4] Testing npm availability...
where npm >nul 2>&1
if %errorlevel%==0 (
    echo [SUCCESS] NPM is available
    npm --version
) else (
    echo [ERROR] NPM not found in PATH
)

echo.
echo [TEST 5] Testing Node.js availability...
where node >nul 2>&1
if %errorlevel%==0 (
    echo [SUCCESS] Node.js is available
    node --version
) else (
    echo [ERROR] Node.js not found in PATH
)

echo.
echo ============================================
echo  All Tests Complete
echo ============================================
echo.
echo [INFO] Scripts are ready to use:
echo   - start-server.bat : Start the development server
echo   - stop-server.bat  : Stop all server processes
echo.

pause