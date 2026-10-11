@echo off
cd /d "%~dp0"
echo Keep both server windows open while playing.
start "WuWa Game Server" cmd /k npm start
call npm run dev
pause
