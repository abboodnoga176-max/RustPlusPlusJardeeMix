const Builder = require('@discordjs/builders');
const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const utils = require('../util/utils.js');

module.exports = {
    name: 'checkop',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('checkop')
            .setDescription('Check for arbitrage opportunities in vending machines')
            ;
    },

async execute(client, interaction) {
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = utils.getRandomInt(100000, 1000000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        if (!rustplus || !rustplus.isOperational) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToServer');
            await client.interactionEditReply(interaction, { content: str, ephemeral: true });
            return;
        }

        const embedResponse = rustplus.getCommandCheckop();

        if (typeof embedResponse === 'string') {
            const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, embedResponse));
            return;
        }

        await client.interactionEditReply(interaction, { content: null, embeds: [embedResponse] });
    }
};
