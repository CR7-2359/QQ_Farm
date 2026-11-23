@echo off
setlocal
pushd "%~dp0" || exit /b 1

if not exist ".env" (
    echo Missing .env. Copy .env.example to .env and fill in your settings.
    popd
    pause
    exit /b 1
)

node --env-file=".env" "core\client.js"
set "APP_EXIT_CODE=%ERRORLEVEL%"
popd
if not "%APP_EXIT_CODE%"=="0" pause
exit /b %APP_EXIT_CODE%
