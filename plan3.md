So in `src/discordEvents/ready.js`:
We can add:
```javascript
        client.crossServerStatus = new Object();
        client.crossServerIndex = 0;
        client.crossServerIntervalId = setInterval(require('../handlers/crossServerHandler').handler, 10000, client);
```
And create `src/handlers/crossServerHandler.js`:
```javascript
const Axios = require('axios');
const DiscordMessages = require('../discordTools/discordMessages.js');

module.exports = {
    handler: async function (client) {
        let playerIdsToUpdate = new Set();
        let trackersToUpdate = {}; // mapping playerId to list of { guildId, trackerId }

        for (const guildItem of client.guilds.cache) {
            const guildId = guildItem[0];
            const instance = client.getInstance(guildId);
            if (!instance || !instance.trackers) continue;

            for (const [trackerId, tracker] of Object.entries(instance.trackers)) {
                const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

                for (const player of tracker.players) {
                    if (player.playerId) {
                        if (bmInstance && bmInstance.players[player.playerId] && bmInstance.players[player.playerId]['status'] === true) {
                            // online on tracked server, skip
                            continue;
                        }

                        playerIdsToUpdate.add(player.playerId);
                        if (!trackersToUpdate[player.playerId]) trackersToUpdate[player.playerId] = [];
                        trackersToUpdate[player.playerId].push({ guildId, trackerId });
                    }
                }
            }
        }

        const players = Array.from(playerIdsToUpdate);
        if (players.length === 0) return;

        client.crossServerIndex = client.crossServerIndex % players.length;
        const playerId = players[client.crossServerIndex];
        client.crossServerIndex++;

        try {
            const res = await Axios.get(`https://api.battlemetrics.com/players/${playerId}?include=server`);
            const included = res.data.included || [];
            let onlineServer = null;
            for (const inc of included) {
                if (inc.type === 'server' && inc.meta && inc.meta.online === true) {
                    onlineServer = inc.attributes.name;
                    break;
                }
            }

            const currentStatus = client.crossServerStatus[playerId];
            client.crossServerStatus[playerId] = onlineServer;

            if (currentStatus !== onlineServer) {
                // state changed, update embeds
                if (trackersToUpdate[playerId]) {
                    for (const trackerRef of trackersToUpdate[playerId]) {
                        await DiscordMessages.sendTrackerMessage(trackerRef.guildId, trackerRef.trackerId);
                    }
                }
            }

        } catch(e) {
            // ignore network errors
        }
    }
}
```

Then in `src/discordTools/discordEmbeds.js`:
```javascript
<<<<<<< SEARCH
            if (!bmInstance.players.hasOwnProperty(player.playerId) || !successful) {
                status += `${Constants.NOT_FOUND_EMOJI}\n`;
            }
            else {
                let time = null;
                if (bmInstance.players[player.playerId]['status']) {
                    time = bmInstance.getOnlineTime(player.playerId);
                    status += `${Constants.ONLINE_EMOJI}`;
                }
                else {
                    time = bmInstance.getOfflineTime(player.playerId);
                    status += `${Constants.OFFLINE_EMOJI}`;
                }
                status += time !== null ? ` [${time[1]}]\n` : '\n';
            }
=======
            let crossServerOnline = Client.client.crossServerStatus && player.playerId ? Client.client.crossServerStatus[player.playerId] : null;

            if (bmInstance.players.hasOwnProperty(player.playerId) && successful && bmInstance.players[player.playerId]['status']) {
                let time = bmInstance.getOnlineTime(player.playerId);
                status += `${Constants.ONLINE_EMOJI}`;
                status += time !== null ? ` [${time[1]}]\n` : '\n';
            } else if (crossServerOnline) {
                status += `🟡\n`;
            } else {
                if (!bmInstance.players.hasOwnProperty(player.playerId) || !successful) {
                    status += `${Constants.NOT_FOUND_EMOJI}\n`;
                } else {
                    let time = bmInstance.getOfflineTime(player.playerId);
                    status += `${Constants.OFFLINE_EMOJI}`;
                    status += time !== null ? ` [${time[1]}]\n` : '\n';
                }
            }
>>>>>>> REPLACE
```

Wait, `Axios` should be imported.
Does `src/handlers/crossServerHandler.js` need to export anything else? No.

Let's test this logic.
