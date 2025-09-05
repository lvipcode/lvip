@echo off
setlocal enabledelayedexpansion

:: LinkedIn Data Extractor - Server Stop Script
if "%1"=="silent" goto :skip_header

echo ===============================================
echo LinkedIn Data Extractor Server Shutdown
echo ===============================================
echo.

:skip_header

:: Kill Node.js processes
echo [INFO] Stopping all Node.js processes...
taskkill /f /im node.exe >nul 2>&1
if not errorlevel 1 (
    echo [SUCCESS] Node.js processes terminated
) else (
    echo [INFO] No Node.js processes found
)

:: Kill npm processes
echo [INFO] Stopping all npm processes...
taskkill /f /im npm.exe >nul 2>&1
if not errorlevel 1 (
    echo [SUCCESS] npm processes terminated
) else (
    echo [INFO] No npm processes found
)

:: Kill processes on common development ports
echo [INFO] Freeing up development ports...
for %%p in (3000 3001 3002 3003 3004 3005 8000 8080 5000 5173 4200) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p "') do (
        if not "%%a"=="0" (
            echo [INFO] Killing process %%a on port %%p...
            taskkill /f /pid %%a >nul 2>&1
        )
    )
)

:: Kill Next.js development server processes
echo [INFO] Stopping Next.js development processes...
wmic process where "name='node.exe' and commandline like '%%next%dev%%'" delete >nul 2>&1

:: Kill any remaining processes that might be using our ports
echo [INFO] Force cleaning ports 3000-3005...
for %%p in (3000 3001 3002 3003 3004 3005) do (
    netstat -ano | findstr ":%%p " >nul 2>&1
    if not errorlevel 1 (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p "') do (
            if not "%%a"=="0" (
                taskkill /f /pid %%a >nul 2>&1
            )
        )
    )
)

:: Wait a moment for processes to fully terminate
timeout /t 2 /nobreak >nul 2>&1

:: Verify ports are free
echo [INFO] Verifying ports are free...
set "PORTS_FREED=true"
for %%p in (3000 3001 3002 3003 3004 3005) do (
    netstat -ano | findstr ":%%p " >nul 2>&1
    if not errorlevel 1 (
        echo [WARNING] Port %%p is still occupied
        set "PORTS_FREED=false"
    )
)

if "%PORTS_FREED%"=="true" (
    echo [SUCCESS] All development ports are now free
) else (
    echo [WARNING] Some ports may still be occupied
    echo [INFO] You may need to restart your computer or manually kill remaining processes
)

:: Clean up temporary files
echo [INFO] Cleaning up temporary files...
if exist ".next" (
    rmdir /s /q ".next" >nul 2>&1
    echo [SUCCESS] Cleared Next.js cache
)

if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache" >nul 2>&1
    echo [SUCCESS] Cleared node modules cache
)

if "%1"=="silent" goto :end

echo.
echo ===============================================
echo Server shutdown completed
echo ===============================================
echo.
pause

:end