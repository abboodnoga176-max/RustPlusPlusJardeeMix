1. **Add new language strings for Discord mute commands:**
   - In all `src/languages/*.json` files, add:
     - `"commandSyntaxMuteDiscord": "mutediscord"`
     - `"commandSyntaxUnmuteDiscord": "unmutediscord"`
     - `"inGameDiscordMuted": "Discord muted."`
     - `"inGameDiscordUnmuted": "Discord unmuted."`
     - `"discordMuted": "You muted the voice channel."`
     - `"discordUnmuted": "You unmuted the voice channel."`
     - `"discordMuteNoVoiceChannel": "You are not in a voice channel."`
     - `"discordMuteNotAuthorized": "You are not authorized to use discord mute commands."`
     - `"commandsMutediscordDesc": "Commands to manage Discord Voice channel muting."`
     - `"commandsMutediscordAuthorizeDesc": "Authorize a user to mute/unmute discord from in-game."`
     - `"commandsMutediscordDeauthorizeDesc": "Deauthorize a user from muting/unmuting discord from in-game."`
     - `"commandsMutediscordDiscordUserDesc": "The Discord User."`
     - `"commandsMutediscordSteamidDesc": "The Steam ID of the user."`
     - `"commandsMutediscordShowDesc": "Show authorized users."`

2. **Update `src/util/CreateInstanceFile.js` with new instance config:**
   - Add a configuration object to manage authorized users for muting:
     `instance.discordMuteAuthorized = { discordIds: [], steamIds: [] };`
   - Handle migrations for existing instances to include this new property.

3. **Add Discord Mute commands (`/atmu` / `/datmu` equivalent) to a new command file (`src/commands/mutediscord.js`):**
   - Implement slash commands to `authorize`, `deauthorize`, and `show` users authorized to use the in-game `#mutediscord` and `#unmutediscord` commands.
   - Restrict this slash command to administrators.

4. **Add handling for in-game commands `#mutediscord` and `#unmutediscord`:**
   - In `src/handlers/inGameCommandHandler.js`:
     - Add `rustplus.getCommandMuteDiscord(callerSteamId)`
     - Add `rustplus.getCommandUnmuteDiscord(callerSteamId)`
   - In `src/structures/RustPlus.js`, implement `getCommandMuteDiscord` and `getCommandUnmuteDiscord`.
     - These functions will verify if the caller is authorized (using `callerSteamId`).
     - If authorized, they will find the voice channel the user is currently in (using Discord `client` and their linked discord account or via iterating all voice channels to find them, actually we can find all Discord users mapped to that steamId by checking if they are in the server and in a voice channel).
     - Or a simpler way: find the discord user(s) matching the authorized steamId, find which voice channel they are in, and mute/unmute everyone else in that channel.
