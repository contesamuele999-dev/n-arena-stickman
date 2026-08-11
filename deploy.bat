@echo off
setlocal enabledelayedexpansion
title Deploy N+ Arena Stickman to GitHub Pages

echo ========================================================
echo   N+ Arena Stickman - GitHub ^& GitHub Pages Auto Deployer
echo ========================================================
echo.

:: 1. Assicura che index.html sia sincronizzato con n_arena_stickman.html
if exist "n_arena_stickman.html" (
    echo [1/5] Sincronizzazione di index.html...
    copy /Y "n_arena_stickman.html" "index.html" >nul
)

:: 2. Inizializza Git se non presente
if not exist ".git" (
    echo [2/5] Inizializzazione repository Git locale...
    git init
    git branch -M main
) else (
    echo [2/5] Repository Git locale presente.
)

:: 3. Aggiunge i file in stage
echo [3/5] Aggiunta file al commit...
git add .

:: 4. Imposta o richiede un messaggio di commit
set "COMMIT_MSG=%~1"
if "!COMMIT_MSG!"=="" (
    set /p "COMMIT_MSG=Inserisci il messaggio di commit (premi Invio per predefinito): "
)

:: Sanificazione messaggio se vuoto
if "!COMMIT_MSG!"=="" set "COMMIT_MSG=Auto update - %date% %time%"
:: Rimuove eventuali virgolette extra
set "COMMIT_MSG=!COMMIT_MSG:"=!"

echo Effettuando commit: "!COMMIT_MSG!"
git commit -m "!COMMIT_MSG!"

:: 5. Gestione Remote e Push
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo [4/5] Creazione della repository pubblica su GitHub via GitHub CLI...
    gh repo create n-arena-stickman --public --source=. --remote=origin --push
    if %errorlevel% neq 0 (
        echo [ERRORE] Impossibile creare la repository. Verifica che GitHub CLI sia autenticato ^(gh auth login^).
        pause
        exit /b 1
    )
    echo Abilitazione di GitHub Pages sulla repository...
    FOR /F "tokens=*" %%g IN ('gh api user -q .login') DO SET GH_USER=%%g
    if defined GH_USER (
        gh api repos/!GH_USER!/n-arena-stickman/pages -X POST -f "source[branch]=main" -f "source[path]=/" >nul 2>&1
    )
) else (
    echo [4/5] Push dei cambiamenti su GitHub...
    git push origin main
)

:: Recupero informazioni utente e repository per i link finali
FOR /F "tokens=*" %%g IN ('gh api user -q .login 2^>nul') DO SET GH_USER=%%g
if "!GH_USER!"=="" set "GH_USER=contesamuele999-dev"

echo.
echo ========================================================
echo    DEPLOY COMPLETATO CON SUCCESSO!
echo ========================================================
echo Repository GitHub:
echo https://github.com/!GH_USER!/n-arena-stickman
echo.
echo Gioco Online su GitHub Pages:
echo https://!GH_USER!.github.io/n-arena-stickman/
echo ========================================================
echo.
pause
