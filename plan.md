The user wants to see if an offline player on the tracked server is playing on a *different* server, and show a different icon or status if they are. They proposed checking one player every 10 seconds (so 6 players per minute) to stay well within rate limits.

This means we can queue players who are "offline" (or all players on the tracker), query their Battlemetrics profile (`https://api.battlemetrics.com/players/{playerId}?include=server`), find out if they are online on *any* server (`data.data.meta.online === true` or by parsing the included servers), and then save this state.

Wait! A player's profile query:
`https://api.battlemetrics.com/players/{playerId}?include=server`
In my earlier test output:
```json
      "meta": {
        "timePlayed": 225000,
        "firstSeen": "2026-01-08T09:04:08.557Z",
        "lastSeen": "2026-04-13T13:18:24.697Z",
        "online": true
      }
```
Wait, the `meta.online` is `true` for a specific server (in the `included` block where `type: "server"`), or `data.data.attributes`?
Let's see what a player GET request looks like.
