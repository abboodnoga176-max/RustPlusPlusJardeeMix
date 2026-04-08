FROM node:18

RUN apt-get update && apt-get install -y graphicsmagick git && apt-get clean

WORKDIR /app

COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm install
COPY . /app

RUN chmod +x /app/watcher.sh

VOLUME [ "/app/credentials" ]
VOLUME [ "/app/instances" ]
VOLUME [ "/app/logs" ]
VOLUME [ "/app/maps" ]

CMD ["./watcher.sh"]