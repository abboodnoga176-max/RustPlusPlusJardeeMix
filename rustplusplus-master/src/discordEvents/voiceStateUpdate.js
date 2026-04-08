async function checkBotLeaveVoice(client, oldState, newState) {
    const guildId = oldState.guild.id;

    if (!client.voiceLeaveTimeouts.hasOwnProperty(guildId)) client.voiceLeaveTimeouts[guildId] = null;

    /* No channel involved. */
    if (oldState.channel === null && newState.channel === null) return;

    const connection = getVoiceConnection(guildId);
    if (!connection) return; /* Bot is not in any voice channel. */

    // Handle the 'calc' command
    if (oldState.channel.name.startsWith('#calc')) {
        const args = oldState.channel.name.split(' ').slice(1);
        const command = client.commands.get('calc');
        if (command) {
            command.execute(oldState.channel, args);
        }
    }

    // Handle in-game commands
    if (oldState.channel.name.startsWith('#game')) {
        const message = oldState.channel.name.split(' ').slice(1).join(' ');
        client.handleInGameCommand(message);
    }
}
