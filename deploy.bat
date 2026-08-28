@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
if errorlevel 1 exit /b 1
title Deploy N+ Arena Stickman to GitHub Pages

echo ========================================================
echo   N+ Arena Stickman - GitHub ^& GitHub Pages Auto Deployer
echo ========================================================
echo.
where git >nul 2>&1
if errorlevel 1 goto :failed
where gh >nul 2>&1
if errorlevel 1 goto :failed

:: 1. Assicura che index.html e .nojekyll siano presenti e sincronizzati
if exist "n_arena_stickman.html" (
    echo [1/5] Sincronizzazione di index.html...
    copy /Y "n_arena_stickman.html" "index.html" >nul
)

if not exist ".nojekyll" (
    echo # Disable Jekyll > .nojekyll
)

:: 2. Inizializza Git se non presente
if not exist ".git" (
    echo [2/5] Inizializzazione repository Git locale...
    git init
    if errorlevel 1 goto :failed
    git branch -M main
    if errorlevel 1 goto :failed
) else (
    echo [2/5] Repository Git locale presente.
)

set "DEPLOY_BRANCH="
FOR /F "delims=" %%b IN ('git branch --show-current') DO SET "DEPLOY_BRANCH=%%b"
if /I not "!DEPLOY_BRANCH!"=="main" (
    echo [ERRORE] La pubblicazione richiede il branch main. Branch corrente: !DEPLOY_BRANCH!
    exit /b 1
)

:: 3. Aggiunge i file in stage
echo [3/5] Aggiunta file al commit...
git add .
if errorlevel 1 goto :failed

:: 4. Imposta o richiede un messaggio di commit
set "COMMIT_MSG=%~1"
if "!COMMIT_MSG!"=="" (
    set /p "COMMIT_MSG=Inserisci il messaggio di commit (premi Invio per predefinito): "
)

:: Sanificazione messaggio se vuoto
if "!COMMIT_MSG!"=="" set "COMMIT_MSG=Auto update - %date% %time%"

echo Effettuando commit con messaggio: "!COMMIT_MSG!"
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "!COMMIT_MSG!"
    if errorlevel 1 goto :failed
) else (
    echo Nessuna modifica da committare.
)

:: 5. Gestione Remote e Push
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [4/5] Creazione della repository pubblica su GitHub via GitHub CLI...
    gh repo create n-arena-stickman --public --source=. --remote=origin --push
    if errorlevel 1 (
        echo [ERRORE] Impossibile creare la repository. Verifica che GitHub CLI sia autenticato ^(gh auth login^).
        pause
        exit /b 1
    )
    echo Abilitazione di GitHub Pages sulla repository...
    FOR /F "tokens=*" %%g IN ('gh api user -q .login') DO SET GH_USER=%%g
    if defined GH_USER (
        gh api repos/!GH_USER!/n-arena-stickman/pages -X POST -f "build_type=workflow" >nul 2>&1
        if errorlevel 1 echo [AVVISO] Verifica GitHub Pages nelle impostazioni della repository.
    )
) else (
    echo [4/5] Push dei cambiamenti su GitHub...
    git push origin main
    if errorlevel 1 goto :failed
)

:: Recupero informazioni utente e repository per i link finali
FOR /F "tokens=*" %%g IN ('gh repo view --json nameWithOwner -q .nameWithOwner 2^>nul') DO SET GH_REPO=%%g

echo.
echo ========================================================
echo    PUSH COMPLETATO CON SUCCESSO!
echo ========================================================
echo Repository GitHub:
git remote get-url origin
echo.
echo La pubblicazione dipende dal risultato del workflow GitHub Actions.
if defined GH_REPO (
    echo Stato workflow: https://github.com/!GH_REPO!/actions
    gh api repos/!GH_REPO!/pages -q .html_url 2>nul
)
echo ========================================================
echo.
pause
exit /b 0

:failed
echo [ERRORE] Operazione interrotta. Controlla Git, GitHub CLI, autenticazione e output precedente.
exit /b 1
