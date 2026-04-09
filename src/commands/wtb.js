const Builder = require('@discordjs/builders');
const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

module.exports = {
    name: 'wtb',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('wtb')
            .setDescription(client.intlGet(guildId, 'commandsWtbDesc') || 'Find multi-hop trade routes to buy an item')
            .addStringOption(option => option
                .setName('name')
                .setDescription(client.intlGet(guildId, 'commandsWtbNameDesc') || 'The name or ID of the item you want to buy')
                .setRequired(true));
    },

    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        if (!rustplus || (rustplus && !rustplus.isOperational)) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        const targetSearchString = interaction.options.getString('name');

        let targetItemId = null;
        if (client.items.itemExist(targetSearchString)) {
            targetItemId = targetSearchString;
        } else {
            const item = client.items.getClosestItemIdByName(targetSearchString);
            if (item === null) {
                const str = client.intlGet(interaction.guildId, 'noItemWithNameFound', { name: targetSearchString });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                return;
            }
            targetItemId = item;
        }

        const targetItemName = client.items.getName(targetItemId);


        const targetScrapId = "-932201673"; // ID for Scrap

        const SCRAP_FEE = 20;
        const trades = [];
        for (const vendingMachine of rustplus.mapMarkers.vendingMachines) {
            if (!vendingMachine.hasOwnProperty('sellOrders')) continue;
            for (const order of vendingMachine.sellOrders) {
                if (order.amountInStock === 0) continue;

                const orderItemId = (Object.keys(client.items.items).includes(order.itemId.toString())) ? order.itemId.toString() : null;
                const orderCurrencyId = (Object.keys(client.items.items).includes(order.currencyId.toString())) ? order.currencyId.toString() : null;

                if (!orderItemId || !orderCurrencyId) continue;

                trades.push({
                    outputItem: orderItemId,
                    outputQty: order.quantity,
                    inputItem: orderCurrencyId,
                    inputQty: order.costPerItem,
                    location: vendingMachine.location.string,
                    amountInStock: order.amountInStock
                });
            }
        }

        const validPaths = [];

        function findPaths(currentItemId, qtyNeeded, visitedItems, currentPath, totalScrapFees) {
            if (currentPath.length > 0) {
                validPaths.push({
                    startItem: currentItemId,
                    normalizedQty: qtyNeeded,
                    totalScrapFees: totalScrapFees,
                    path: [...currentPath]
                });
            }

            if (currentPath.length >= 5) return;

            for (const trade of trades) {
                if (trade.outputItem === currentItemId) {
                    if (visitedItems.has(trade.inputItem)) continue;

                    const multiplier = qtyNeeded / trade.outputQty;
                    const nextQtyNeeded = multiplier * trade.inputQty;
                    const nextScrapFees = totalScrapFees + SCRAP_FEE;

                    const newVisited = new Set(visitedItems);
                    newVisited.add(trade.inputItem);

                    currentPath.push({ ...trade, hopMultiplier: multiplier });
                    findPaths(trade.inputItem, nextQtyNeeded, newVisited, currentPath, nextScrapFees);
                    currentPath.pop();
                }
            }
        }

        const initialVisited = new Set([targetItemId.toString()]);
        findPaths(targetItemId.toString(), 1, initialVisited, [], 0);


        // Debug output
        console.log(`Found ${validPaths.length} paths.`);

        // Filtering and Deduplication
        const bestPaths = new Map();

        for (const p of validPaths) {
            // How do we calculate cost?
            // The total cost to get 1 target item is:
            // p.normalizedQty of p.startItem + p.totalScrapFees

            // To compare apples to apples, we shouldn't convert start items to scrap implicitly unless we have an exchange rate.
            // But the rule is: "Do not return multiple results starting with the same item type.
            // If multiple paths start with High Quality Metal, only return the single most efficient path."
            //
            // If paths start with the SAME item, the one with the smallest p.normalizedQty is better.
            // However, scrap fees matter. Wait, can we just use a heuristic to value the total cost?
            // The prompt says: "The bot must calculate the total cost of the target item by normalizing the value of input items."
            // But wait, "normalize the value of input items": If you need 10 Scrap + 40 fees vs 5 Scrap + 20 fees, it's obvious.
            // But if you need 5 HQM + 40 Scrap vs 6 HQM + 20 Scrap, you can't easily compare unless HQM has a Scrap value.
            // Wait, the prompt implies deduplicating for the *same starting item type*. So if both start with HQM, we need a way to compare.
            // Let's assume we can't reliably convert HQM to Scrap. We can just sort by `normalizedQty` as the primary driver,
            // or we could convert Scrap fees to an equivalent cost if startItem is Scrap.
            // But actually, we just need to compare them. Let's create a score for the path:
            // Score = normalizedQty. If they are the same start item, lower normalizedQty is better.
            // What if normalizedQty is the same? Then lower totalScrapFees is better.

            const currentBest = bestPaths.get(p.startItem);

            if (!currentBest) {
                bestPaths.set(p.startItem, p);
            } else {
                // If they are the same start item, we compare them.
                // We don't have a universal currency conversion for all items.
                // But wait! We could evaluate the entire cost in terms of Scrap if we trace back to Scrap.
                // However, the prompt says "unique starting item rule".
                // Let's compare by normalizedQty first, then totalScrapFees.
                if (p.normalizedQty < currentBest.normalizedQty) {
                    bestPaths.set(p.startItem, p);
                } else if (p.normalizedQty === currentBest.normalizedQty && p.totalScrapFees < currentBest.totalScrapFees) {
                    bestPaths.set(p.startItem, p);
                }
            }
        }

        const sortedBestPaths = Array.from(bestPaths.values());

        let foundLines = '';
        for (const p of sortedBestPaths) {
            if (foundLines === '') {
                foundLines += '```diff\n';
            }

            // Format: [Qty] [Start Item] -> [Grid] -> [Qty] [Intermediate] -> [Grid] -> [Qty] [Target]
            // We want to format the path from start to end (forward direction)
            // p.path is currently stored backwards (from target to start).
            // Let's reverse it.
            const forwardPath = [...p.path].reverse();

            let line = `+ `;

            let runningQty = p.normalizedQty;
            line += `[${runningQty.toFixed(2)}] ${client.items.getName(p.startItem)} `;

            for (const step of forwardPath) {
                line += `-> [${step.location}] -> `;
                // To display what happens after this step:
                // output of this step = (runningQty / step.inputQty) * step.outputQty
                runningQty = (runningQty / step.inputQty) * step.outputQty;
                line += `[${runningQty.toFixed(2)}] ${client.items.getName(step.outputItem)} `;
            }

            line += `(Total Fees: ${p.totalScrapFees} Scrap)\n`;

            if (foundLines.length + line.length > 3900) {
                foundLines += `...\n`;
                break;
            } else {
                foundLines += line;
            }
        }

        if (foundLines === '') {
            foundLines = client.intlGet(interaction.guildId, 'noItemFound') || 'No trades found...';
        } else {
            foundLines += '```';
        }

        const embed = DiscordEmbeds.getEmbed({
            color: Constants.COLOR_DEFAULT,
            title: `Trade Routes for ${targetItemName}`,
            description: foundLines,
            footer: { text: `${instance.serverList[rustplus.serverId].title}` }
        });

        await client.interactionEditReply(interaction, { content: null, embeds: [embed] });

    }
};
