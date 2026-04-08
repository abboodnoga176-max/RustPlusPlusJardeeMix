#!/bin/bash

# Konfiguracja adresu z tokenem (zmienne pobierane z docker-compose)
GIT_AUTH_URL="https://${GIT_USER}:${GIT_TOKEN}@${GIT_REPO_URL#https://}"

# Ustawienie remote, aby używał tokena
git remote set-url origin "$GIT_AUTH_URL"

start_app() {
    echo "Uruchamianie aplikacji..."
    npm start &
    APP_PID=$!
}

stop_app() {
    echo "Zatrzymywanie aplikacji (PID: $APP_PID)..."
    kill $APP_PID
    wait $APP_PID 2>/dev/null
}

start_app

while true; do
    # Sprawdzanie zmian
    git fetch origin main > /dev/null 2>&1
    
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse @{u})

    if [ "$LOCAL" != "$REMOTE" ]; then
        echo "Zmiany wykryte! Aktualizacja..."
        stop_app
        git pull origin main
        npm install
        start_app
    fi

    sleep 60
done