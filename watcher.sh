#!/bin/bash

git config --global --add safe.directory /app

# Konfiguracja adresu z tokenem (zmienne pobierane z docker-compose)
if [ -z "$GIT_USER" ]; then
    GIT_AUTH_URL="https://${GIT_TOKEN}@${GIT_REPO_URL#https://}"
else
    GIT_AUTH_URL="https://${GIT_USER}:${GIT_TOKEN}@${GIT_REPO_URL#https://}"
fi

# Ustawienie remote, aby używał tokena i sprawdzanie zmian tylko na starcie
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git remote set-url origin "$GIT_AUTH_URL" >/dev/null 2>&1 || true

    echo "Sprawdzanie aktualizacji..."
    git fetch origin

    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse origin/main 2>/dev/null)

    if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
        echo "Zmiany wykryte! Aktualizacja..."
        git reset --hard origin/main
        git pull origin main
        npm install
    else
        echo "Brak zmian. Kod jest aktualny."
    fi
fi

echo "Uruchamianie aplikacji..."
exec npm start
