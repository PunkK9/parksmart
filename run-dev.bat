@echo off
title Orbit Spatial Parking Servers
echo ========================================================
echo        Starting Orbit (Backend API + Spatial Web UI)
echo ========================================================
echo.
echo [1/2] Orbit API starting on http://localhost:5000
echo [2/2] Orbit Spatial UI starting on http://localhost:5173
echo.
call npm run dev
pause
