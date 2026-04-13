const Builder = require('@discordjs/builders');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

module.exports = {
    name: 'datmu',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('datmu')
            .setDescription(client.intlGet(guildId, 'commandsDatmuDesc'))
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

        const steamid = interaction.options.getString('steamid');

        const existingIndex = instance.discordMuteMappings.findIndex(m => m.steamId === steamid);

        let str = '';
        let successful = 0;

        if (existingIndex !== -1) {
            instance.discordMuteMappings.splice(existingIndex, 1);
            client.setInstance(guildId, instance);

            str = client.intlGet(guildId, 'discordMuteDeauthorized') + ` (${steamid})`;
            successful = 0;
        } else {
            str = client.intlGet(guildId, 'discordMuteMappingNotFound');
            successful = 1;
        }

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value: `datmu, ${steamid}`
        }));

        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(successful, str));
        client.log(client.intlGet(null, 'infoCap'), str);
        return;
    },
};
