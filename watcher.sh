#!/bin/bash

git config --global --add safe.directory /app

# Konfiguracja adresu z tokenem (zmienne pobierane z docker-compose)
if [ -z "$GIT_USER" ]; then
    GIT_AUTH_URL="https://${GIT_TOKEN}@${GIT_REPO_URL#https://}"
else
    GIT_AUTH_URL="https://${GIT_USER}:${GIT_TOKEN}@${GIT_REPO_URL#https://}"
fi

# Ustawienie remote, aby używał tokena
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git remote set-url origin "$GIT_AUTH_URL" || true
fi

kill_tree() {
    local _pid=$1
    for _child in $(pgrep -P $_pid 2>/dev/null); do
        kill_tree $_child
    done
    kill $_pid 2>/dev/null
}

start_app() {
    echo "Uruchamianie aplikacji..."
    npm start &
    APP_PID=$!
}

stop_app() {
    echo "Zatrzymywanie aplikacji (PID: $APP_PID)..."
    kill_tree $APP_PID
    wait $APP_PID 2>/dev/null
}

start_app

while true; do
    # Sprawdzanie zmian
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git fetch origin main

        LOCAL=$(git rev-parse HEAD 2>/dev/null)
        REMOTE=$(git rev-parse origin/main 2>/dev/null)

        if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
            echo "Zmiany wykryte! Aktualizacja..."
            stop_app
            git reset --hard origin/main
            git pull origin main
            npm install
            start_app
        fi
    fi

    sleep 60
done
