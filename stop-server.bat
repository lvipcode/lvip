@echo off
title LinkedIn Data Extractor - Stop Server

echo ============================================
echo  LinkedIn Data Extractor - Stop Server
echo ============================================
echo.

echo [INFO] Forcefully terminating all server processes...

REM 简单直接的进程终止
echo [ACTION] Killing Node.js processes...
taskkill /f /im node.exe 2>nul
if %errorlevel%==0 (
    echo [SUCCESS] Node.js processes terminated
) else (
    echo [INFO] No Node.js processes found
)

echo [ACTION] Killing NPM processes...
taskkill /f /im npm.exe 2>nul
if %errorlevel%==0 (
    echo [SUCCESS] NPM processes terminated  
) else (
    echo [INFO] No NPM processes found
)

echo [ACTION] Killing Next.js processes...
taskkill /f /im next.exe 2>nul
if %errorlevel%==0 (
    echo [SUCCESS] Next.js processes terminated
) else (
    echo [INFO] No Next.js processes found  
)

echo.
echo [INFO] Waiting for system cleanup...
timeout /t 3 /nobreak >nul

echo.
echo [INFO] Checking port 3000 status...
netstat -an | find ":3000" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo [WARNING] Port 3000 may still be occupied
    echo [INFO] Showing current port usage:
    netstat -an | find ":3000"
) else (
    echo [SUCCESS] Port 3000 appears to be free
)

echo.
echo ============================================
echo [SUCCESS] Server stop operation completed
echo [INFO] You can now try to start the server
echo ============================================
echo.

pause