const Builder = require('@discordjs/builders');
const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const tradeUtils = require('../util/tradeUtils.js');

module.exports = {
    name: 'wtb',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('wtb')
            .setDescription(client.intlGet(guildId, 'commandsWtbDesc') || 'Find multi-hop trade routes to buy an item')
            .addStringOption(option => option
                .setName('name')
                .setDescription(client.intlGet(guildId, 'commandsWtbNameDesc') || 'The name or ID of the item you want to buy')
                .setRequired(true))
            .addIntegerOption(option => option
                .setName('quantity')
                .setDescription(client.intlGet(guildId, 'commandsWtbQtyDesc') || 'The minimum quantity of the item you want to buy')
                .setRequired(false));
    },

    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        const targetSearchString = interaction.options.getString('name');
        const targetQuantity = interaction.options.getInteger('quantity') || 1;

        const result = tradeUtils.getBestTradeRoutes(client, interaction.guildId, rustplus, targetSearchString, targetQuantity, true);

        if (result.error) {
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, result.error));
            if (result.error === (client.intlGet(interaction.guildId, 'notConnectedToRustServer') || "Not connected to a Rust server.")) {
                client.log(client.intlGet(null, 'warningCap'), result.error);
            }
            return;
        }

        const formattedLines = result.formattedLines;
        const targetItemName = result.targetItemName;

        if (formattedLines.length === 0) {
            const noItemFoundStr = client.intlGet(interaction.guildId, 'noItemFound') || 'No trades found...';
            const embed = DiscordEmbeds.getEmbed({
                color: Constants.COLOR_DEFAULT,
                title: `Trade Routes for ${targetItemName}`,
                description: '```diff\n' + noItemFoundStr + '\n```',
                footer: { text: instance.serverList && rustplus && rustplus.serverId && instance.serverList[rustplus.serverId] ? instance.serverList[rustplus.serverId].title : 'Offline' }
            });
            await client.interactionEditReply(interaction, { content: null, embeds: [embed] });
            return;
        }

        const embeds = [];
        let currentDescription = '```diff\n';
        const codeBlockEnd = '```';

        for (const line of formattedLines) {
            if (currentDescription.length + line.length + codeBlockEnd.length + 1 > 4000) {
                currentDescription += codeBlockEnd;
                embeds.push(DiscordEmbeds.getEmbed({
                    color: Constants.COLOR_DEFAULT,
                    title: `Trade Routes for ${targetItemName}`,
                    description: currentDescription,
                    footer: { text: instance.serverList && rustplus && rustplus.serverId && instance.serverList[rustplus.serverId] ? instance.serverList[rustplus.serverId].title : 'Offline' }
                }));
                currentDescription = '```diff\n' + line + '\n';
            } else {
                currentDescription += line + '\n';
            }
        }

        if (currentDescription !== '```diff\n') {
            currentDescription += codeBlockEnd;
            embeds.push(DiscordEmbeds.getEmbed({
                color: Constants.COLOR_DEFAULT,
                title: `Trade Routes for ${targetItemName}`,
                description: currentDescription,
                footer: { text: instance.serverList && rustplus && rustplus.serverId && instance.serverList[rustplus.serverId] ? instance.serverList[rustplus.serverId].title : 'Offline' }
            }));
        }



        // Simpler iteration
        let batches = [];
        let currentBatch = [];
        let currentLength = 0;

        for (let embed of embeds) {
            const embedLength = embed.title.length + embed.description.length + (embed.footer?.text?.length || 0);
            if (currentBatch.length >= 10 || currentLength + embedLength > Constants.EMBED_MAX_TOTAL_CHARACTERS) {
                batches.push(currentBatch);
                currentBatch = [embed];
                currentLength = embedLength;
            } else {
                currentBatch.push(embed);
                currentLength += embedLength;
            }
        }
        if (currentBatch.length > 0) batches.push(currentBatch);

        for (let i = 0; i < batches.length; i++) {
            if (i === 0) {
                await client.interactionEditReply(interaction, { content: null, embeds: batches[i] });
            } else {
                await interaction.followUp({ content: null, embeds: batches[i], ephemeral: true });
            }
        }

    }
};
