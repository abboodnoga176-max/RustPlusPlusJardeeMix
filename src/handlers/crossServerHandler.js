const Axios = require('axios');
const DiscordMessages = require('../discordTools/discordMessages.js');

module.exports = {
    handler: async function (client) {
        let playerIdsToUpdate = new Set();
        let trackersToUpdate = {};

        for (const guildItem of client.guilds.cache) {
            const guildId = guildItem[0];
            const instance = client.getInstance(guildId);
            if (!instance || !instance.trackers) continue;

            for (const [trackerId, tracker] of Object.entries(instance.trackers)) {
                const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

                for (const player of tracker.players) {
                    if (player.playerId) {
                        if (bmInstance && bmInstance.players[player.playerId] && bmInstance.players[player.playerId]['status'] === true) {
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
                if (trackersToUpdate[playerId]) {
                    for (const trackerRef of trackersToUpdate[playerId]) {
                        await DiscordMessages.sendTrackerMessage(trackerRef.guildId, trackerRef.trackerId);
                    }
                }
            }

        } catch(e) {
        }
    }
}
