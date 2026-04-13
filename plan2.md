We need to implement discord muting logic and commands in-game (`#mutediscord`, `#unmutediscord`) and Discord slash commands to manage authorization (`/atmu`, `/datmu`).

1. **Add new configuration to `CreateInstanceFile.js`**:
   - `discordMuteAuthorized: { discordIds: [], steamIds: [] }` (same format as `blacklist`)
   - Handle backwards compatibility in `readInstanceFile`.

2. **Add a new slash command `mutediscord` (`/mutediscord`)**:
   - Since the user wants to "authorize players through command in discord something like /atmu [steamid] [discordid] and deauthorize /datmu [steamid]", I will create a command `mutediscord` with subcommands `authorize`, `deauthorize`, `show`.
   - File `src/commands/mutediscord.js`.
   - The user specified `steamid` and `discord_user` parameters. We will mirror the `blacklist.js` logic here.

3. **In-game chat handling**:
   - Add `#mutediscord` and `#unmutediscord` to `src/handlers/inGameCommandHandler.js` and `src/structures/RustPlus.js`.
   - Before executing, verify if the `callerSteamId` is in `instance.discordMuteAuthorized.steamIds`. If not, we might check if they have linked discord ID? Wait, Rust++ doesn't natively map steamId to discord ID unless they use something like discord link, but let's check how the discord ID is used.
   - Ah, if they authorize a `discord_user`, how does the in-game bot know the `steamid`? Actually, if they authorize a `discord_user`, the bot can check the discord user's voice state.
   - Let's look at what the user wants: "muting all players in the channel except for the player that used it".
   - How do we know which voice channel the in-game user is in?
   - If they authorized their `steamId`, we don't know their discord ID! Wait, in the user's description they say `/atmu [steamid] [discordid]`. This means they want to MAP the `steamid` to the `discordid` in the command!
   - So the configuration should be something like:
     `discordMuteAuthorized: [{ steamId: "...", discordId: "..." }]`
   - Command `/atmu`: `discord_user` (required), `steamid` (required).
   - Command `/datmu`: `steamid` or `discord_user` to remove the mapping.

4. **Implementation details for `#mutediscord` / `#unmutediscord`**:
   - When `#mutediscord` is typed:
     - Check `instance.discordMuteAuthorized` for `callerSteamId`.
     - If mapped, get the `discordId`.
     - Find the Discord user by `discordId` in the guild.
     - Get their voice state: `member.voice.channel`.
     - If they are in a voice channel, loop through all other members in that voice channel (`channel.members`), and mute them: `otherMember.voice.setMute(true, "Muted via in-game command")`.
     - Remember, the bot must have the "Mute Members" permission in Discord.
     - Reply in game: "Discord channel muted." or "Discord voice channel muted."
   - When `#unmutediscord` is typed:
     - Same logic, but `setMute(false)`.

5. **Let's review the language additions**:
   - Add localized strings to ALL language files.
   - `commandSyntaxMuteDiscord` -> `"mutediscord"`
   - `commandSyntaxUnmuteDiscord` -> `"unmutediscord"`
