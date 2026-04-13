const fs = require('fs');
const path = require('path');

const langDir = path.join(__dirname, 'src', 'languages');
const files = fs.readdirSync(langDir).filter(f => f.endsWith('.json'));

const newStrings = {
    "commandSyntaxAtmu": "atmu",
    "commandSyntaxDatmu": "datmu",
    "commandSyntaxMuteDiscord": "mutediscord",
    "commandSyntaxUnmuteDiscord": "unmutediscord",
    "commandsAtmuDesc": "Authorize a user to mute Discord voice channels from in-game.",
    "commandsDatmuDesc": "Deauthorize a user from muting Discord voice channels from in-game.",
    "commandsMuteDiscordDiscordUserDesc": "The Discord user.",
    "commandsMuteDiscordSteamidDesc": "The Steam ID of the user.",
    "discordMuteAuthorized": "User authorized to mute Discord from in-game.",
    "discordMuteDeauthorized": "User deauthorized from muting Discord from in-game.",
    "discordMuteMappingExists": "This mapping already exists.",
    "discordMuteMappingNotFound": "No mapping found for this user.",
    "discordMuteNotAuthorized": "You are not authorized to use this command.",
    "discordMuteNoVoiceChannel": "You are not in a voice channel.",
    "discordMutedInGame": "Discord voice channel muted.",
    "discordUnmutedInGame": "Discord voice channel unmuted."
};

for (const file of files) {
    const filePath = path.join(langDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const [key, value] of Object.entries(newStrings)) {
        if (!data.hasOwnProperty(key)) {
            data[key] = value;
        }
    }

    // sorting the keys as in original file to keep it tidy, though JSON doesn't enforce order
    const sortedData = {};
    Object.keys(data).sort((a, b) => a.localeCompare(b)).forEach(k => {
        sortedData[k] = data[k];
    });

    fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 4));
}

console.log("Updated language files.");
