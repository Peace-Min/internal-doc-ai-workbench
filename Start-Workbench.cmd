@echo off
setlocal
if exist "%~dp0runtime\node.exe" (
  "%~dp0runtime\node.exe" "%~dp0scripts\launch.mjs" %*
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js is missing. Use the Windows portable package or install Node.js 22.14.0 or later.
    if not "%~1"=="--check" pause
    exit /b 1
  )
  node "%~dp0scripts\launch.mjs" %*
)
set "WB_EXIT_CODE=%errorlevel%"
if not "%~1"=="--check" pause
exit /b %WB_EXIT_CODE%
