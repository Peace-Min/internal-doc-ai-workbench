@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-desktop.ps1" %*
exit /b %ERRORLEVEL%
