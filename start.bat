@echo off
title SHARANYA PARKING - Smart Parking Management System
cls
echo =======================================================================
echo   SHARANYA PARKING - Smart Parking Management System
echo   B.Tech Computer Science and Engineering Capstone Mini-Project
echo =======================================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected on your system PATH.
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Check if node_modules exist
if not exist "node_modules\" (
    echo Installing project dependencies (express, mysql2, cors, dotenv)...
    call npm install
)

echo.
echo Launching browser at: http://localhost:3000 ...
timeout /t 2 >nul
start "" "http://localhost:3000"

echo.
echo Starting Express & MySQL Server...
npm start

pause

