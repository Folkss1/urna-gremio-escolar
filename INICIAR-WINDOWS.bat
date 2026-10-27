@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
echo ===========================================
echo      URNA DO GREMIO - SERVIDOR LOCAL
echo ===========================================
set "NODE_EXE=node"
where node >nul 2>nul
if not errorlevel 1 goto validar_node
if exist "%ProgramFiles%\nodejs\node.exe" (
 set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
 goto validar_node
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
 set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
 goto validar_node
)
if exist "%LocalAppData%\Programs\nodejs\node.exe" (
 set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
 goto validar_node
)
echo Node.js nao encontrado. Instale Node.js 20 ou superior e execute novamente.
pause
exit /b 1

:validar_node
"%NODE_EXE%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
 echo Esta instalacao precisa do Node.js 20 ou superior. Atualize o Node.js.
 pause
 exit /b 1
)
set "ADMIN_PASSWORD="
:pedir_senha
set /p ADMIN_PASSWORD=Crie/digite a senha administrativa (minimo 8 caracteres): 
"%NODE_EXE%" -e "process.exit((process.env.ADMIN_PASSWORD || '').length >= 8 ? 0 : 1)"
if errorlevel 1 (
 echo A senha precisa ter pelo menos 8 caracteres. Tente novamente.
 goto pedir_senha
)
"%NODE_EXE%" server.js
if errorlevel 1 echo O servidor nao iniciou ou foi interrompido. Confira a mensagem acima.
pause
endlocal
