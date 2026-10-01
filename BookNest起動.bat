@echo off
chcp 65001 >nul
title BookNest
cd /d "%~dp0"
echo.
echo  ==========================================
echo    BookNest を起動しています...
echo    このウィンドウを閉じると BookNest は止まります。
echo    （最小化して開いたままにしてください）
echo  ==========================================
echo.
if not exist ".next\BUILD_ID" (
  echo 初回の準備をしています。数分かかります...
  call npm run build
)
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000"
call npm run start
pause
