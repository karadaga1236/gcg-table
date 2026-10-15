@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist "server.mjs" goto missing
if not exist "public\index.html" goto missing
if not exist "local-start.mjs" goto missing
set "GCG_NODE=%~dp0runtime\node.exe"
if exist "%GCG_NODE%" goto run
set "GCG_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%GCG_NODE%" goto run
where node >nul 2>nul
if errorlevel 1 goto runtime
set "GCG_NODE=node"
:run
"%GCG_NODE%" "local-start.mjs"
if errorlevel 1 echo 起動できませんでした。上のエラー文をご確認ください。
goto finish
:missing
echo 必要なファイルが見つかりません。
echo ZIPの中からは起動できません。ZIPを右クリックして「すべて展開」してください。
echo 展開先のフォルダーを開いてから、この起動ファイルを実行してください。
goto finish
:runtime
echo 実行環境が見つかりません。ZIP全体を「すべて展開」し、runtimeフォルダーも入っているか確認してください。
:finish
echo.
echo この画面を閉じるには何かキーを押してください。
pause >nul
