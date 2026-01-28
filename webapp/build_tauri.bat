@echo off
REM Build Tauri app using x86 host tools (to work around c2.dll issue with x64 host)
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x86

REM Limit parallel jobs to avoid resource exhaustion
set CARGO_BUILD_JOBS=2

REM Clean vswhom-sys cache to force rebuild with correct compiler
echo Cleaning vswhom-sys build cache...
if exist src-tauri\target\release\build\vswhom-sys-bbf88ee8750ca2cf rmdir /s /q src-tauri\target\release\build\vswhom-sys-bbf88ee8750ca2cf 2>nul
if exist src-tauri\target\release\build\vswhom-sys-e8c57ebb05a396e4 rmdir /s /q src-tauri\target\release\build\vswhom-sys-e8c57ebb05a396e4 2>nul

echo.
echo Building Tauri app with x86 host tools targeting x64...
echo.

npm run tauri:build

if %ERRORLEVEL% == 0 (
    echo.
    echo ========================================
    echo Build successful!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Build failed with error code %ERRORLEVEL%
    echo ========================================
)
