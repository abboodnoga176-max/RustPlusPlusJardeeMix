const Builder = require('@discordjs/builders');
const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

module.exports = {
    name: 'checkop',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('checkop')
            .setDescription('Check for arbitrage opportunities in vending machines')
            ;
    },

async execute(client, interaction) {
        const rustplus = client.getRustplus(interaction.guildId);

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        const embedResponse = rustplus.getCommandCheckop();

        if (typeof embedResponse === 'string') {
            const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, embedResponse));
            return;
        }

        await client.interactionEditReply(interaction, { content: null, embeds: [embedResponse] });
    }
};
