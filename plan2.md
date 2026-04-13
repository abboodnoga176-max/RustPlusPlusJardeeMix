So, to find out if a player is online on another server, we call:
`https://api.battlemetrics.com/players/${playerId}?include=server`
And look for `inc.type === 'server'` and `inc.meta.online === true`.
If there's at least one, they are online somewhere else.

How to integrate this into the bot?
We can have a global queue: `client.playerCrossServerQueue = []`.
Every 10 seconds, we pop one `playerId` from the queue, make the request, and update `bmInstance.players[playerId]['crossServerOnline'] = serverName`.
Wait, `bmInstance` belongs to a server. If a player is offline, they might be in `bmInstance.offlinePlayers` (which means they have an entry in `bmInstance.players` with `status: false`).

Wait, the queue should just continuously loop over all offline players in all trackers?
If a player is in a tracker, and they are OFFLINE on the tracked server, we can query them.
Actually, if we just maintain a queue of ALL tracked players (who have a `playerId`), and query one every 10 seconds.
Where to do the setInterval?
In `index.ts` or somewhere, we can start a `setInterval` that runs every 10 seconds.
Wait, `tracker.players` contains `{ name, steamId, playerId }`.
If we iterate through all `client.guilds`, find all `trackers`, get all `playerId`s.
We can just maintain an index and fetch one player every 10 seconds.
```javascript
let crossServerIndex = 0;
setInterval(async () => {
    // gather all unique playerIds from all trackers that are offline
    let playerIdsToUpdate = new Set();
    for (const [guildId, instance] of client.instances.entries()) { // pseudo code
        for (const tracker of Object.values(instance.trackers)) {
            const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];
            if (!bmInstance) continue;
            for (const player of tracker.players) {
                if (player.playerId) {
                    if (bmInstance.players[player.playerId] && bmInstance.players[player.playerId]['status'] === true) {
                        // online on tracked server, skip
                    } else {
                        playerIdsToUpdate.add(player.playerId);
                    }
                }
            }
        }
    }
    const players = Array.from(playerIdsToUpdate);
    if (players.length === 0) return;
    crossServerIndex = crossServerIndex % players.length;
    const playerId = players[crossServerIndex];
    crossServerIndex++;

    try {
        const res = await axios.get(`https://api.battlemetrics.com/players/${playerId}?include=server`);
        const included = res.data.included || [];
        let onlineServer = null;
        for (const inc of included) {
            if (inc.type === 'server' && inc.meta && inc.meta.online === true) {
                onlineServer = inc.attributes.name;
                break;
            }
        }

        // update globally
        client.crossServerStatus[playerId] = onlineServer;
    } catch(e) { }
}, 10000);
```

Then in `discordEmbeds.js` `getTrackerEmbed`:
```javascript
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
                    const otherServer = Client.client.crossServerStatus[player.playerId];
                    if (otherServer) {
                        status += `🟡\n`; // Or some other emoji
                        // Wait, can we append the server name?
                        // The user said "X emoji idk what that mean", "we can add beside if player is nline but is on another server?"
                    } else {
                        time = bmInstance.getOfflineTime(player.playerId);
                        status += `${Constants.OFFLINE_EMOJI}`;
                    }
                }
                if (!otherServer) status += time !== null ? ` [${time[1]}]\n` : '\n';
                else status += `\n`; // Or something
            }
```
Wait, if `bmInstance.players.hasOwnProperty` is false, they might still be online on another server!
So:
```javascript
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
```

Wait, what emoji to use?
The user says "is on another server".
Maybe `🟡` (yellow circle) or `🌐` (globe)? 🟡 is good.
The user image shows: `CL I Smok1x` with X.
If we use `🟡`, they will know he is online somewhere else.
