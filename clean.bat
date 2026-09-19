@echo off
title Workspace Cleanup Script
color 0E
cls

echo ============================================================
echo   NSE/BSE AI Trading Workstation - Workspace Clean Script
echo ============================================================
echo.
echo  This script will clean up all temporary dependencies,
echo  caches, scratch files, and build assets to reduce the
echo  project's size, while keeping your portable applications.
echo.
echo  The following folders and files will be REMOVED:
echo    - Root node_modules\
echo    - artifacts\api-server\node_modules\
echo    - artifacts\api-server\dist\
echo    - artifacts\market-dashboard\node_modules\
echo    - artifacts\market-dashboard\dist\
echo    - artifacts\desktop-app\node_modules\
echo    - artifacts\desktop-app\app-dist\
echo    - dist-portable\win-unpacked\ (Unpacked files)
echo    - scratch\test-screener.js (Temp scratch file)
echo.
echo  The following will be PRESERVED:
echo    - c:\Users\blackstone\Desktop\nse-bse-trading-terminal\dist-portable\*.exe (Portable applications)
echo    - Your database (database.db) and environment configuration
echo.

if "%~1"=="/y" goto do_clean
if "%~1"=="-y" goto do_clean

set /p CONFIRM="  Are you sure you want to clean the workspace? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo  Cleanup cancelled.
    pause
    exit /b 0
)

:do_clean
echo.
echo [*] Cleaning root node_modules...
if exist "node_modules" (
    rmdir /s /q "node_modules"
    echo  OK - Removed root node_modules.
)

echo [*] Cleaning api-server build and node_modules...
if exist "artifacts\api-server\node_modules" (
    rmdir /s /q "artifacts\api-server\node_modules"
    echo  OK - Removed api-server node_modules.
)
if exist "artifacts\api-server\dist" (
    rmdir /s /q "artifacts\api-server\dist"
    echo  OK - Removed api-server dist.
)

echo [*] Cleaning market-dashboard build and node_modules...
if exist "artifacts\market-dashboard\node_modules" (
    rmdir /s /q "artifacts\market-dashboard\node_modules"
    echo  OK - Removed market-dashboard node_modules.
)
if exist "artifacts\market-dashboard\dist" (
    rmdir /s /q "artifacts\market-dashboard\dist"
    echo  OK - Removed market-dashboard dist.
)

echo [*] Cleaning desktop-app build and node_modules...
if exist "artifacts\desktop-app\node_modules" (
    rmdir /s /q "artifacts\desktop-app\node_modules"
    echo  OK - Removed desktop-app node_modules.
)
if exist "artifacts\desktop-app\app-dist" (
    rmdir /s /q "artifacts\desktop-app\app-dist"
    echo  OK - Removed desktop-app app-dist.
)

echo [*] Cleaning unpacked portable folder...
if exist "dist-portable\win-unpacked" (
    rmdir /s /q "dist-portable\win-unpacked"
    echo  OK - Removed dist-portable\win-unpacked.
)

echo [*] Cleaning temporary scratch file...
if exist "scratch\test-screener.js" (
    del /f /q "scratch\test-screener.js"
    echo  OK - Removed test-screener.js.
)

echo.
echo ============================================================
echo   Cleanup complete!
echo   All build caches and node_modules have been removed.
echo   The portable applications in dist-portable\ are preserved.
echo ============================================================
echo.
if "%~1"=="" pause
