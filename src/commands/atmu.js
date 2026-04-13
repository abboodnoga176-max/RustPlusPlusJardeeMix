const Builder = require('@discordjs/builders');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

module.exports = {
    name: 'atmu',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('atmu')
            .setDescription(client.intlGet(guildId, 'commandsAtmuDesc'))
            .addUserOption(option => option
                .setName('discord_user')
                .setDescription(client.intlGet(guildId, 'commandsMuteDiscordDiscordUserDesc'))
                .setRequired(true))
            .addStringOption(option => option
                .setName('steamid')
                .setDescription(client.intlGet(guildId, 'commandsMuteDiscordSteamidDesc'))
                .setRequired(true));
    },

    async execute(client, interaction) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;

        if (!client.isAdministrator(interaction)) {
            const str = client.intlGet(guildId, 'missingPermission');
            await client.interactionReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const discordUser = interaction.options.getUser('discord_user');
        const steamid = interaction.options.getString('steamid');

        const existing = instance.discordMuteMappings.find(m => m.steamId === steamid || m.discordId === discordUser.id);

        let str = '';
        let successful = 0;

        if (existing) {
            str = client.intlGet(guildId, 'discordMuteMappingExists');
            successful = 1;
        } else {
            instance.discordMuteMappings.push({
                steamId: steamid,
                discordId: discordUser.id
            });
            client.setInstance(guildId, instance);

            str = client.intlGet(guildId, 'discordMuteAuthorized') + ` (${discordUser.username} - ${steamid})`;
            successful = 0;
        }

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value: `atmu, ${discordUser.id}, ${steamid}`
        }));

        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(successful, str));
        client.log(client.intlGet(null, 'infoCap'), str);
        return;
    },
};
