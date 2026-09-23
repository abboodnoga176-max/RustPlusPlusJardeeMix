const Builder = require('@discordjs/builders');
const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const fs = require('fs');
const path = require('path');

let allowedRecycleItems = {};
try {
    const configPath = path.resolve(__dirname, '../../config/allowedRecycleItems.json');
    if (fs.existsSync(configPath)) {
        allowedRecycleItems = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
} catch (err) {
    console.error('Failed to load allowedRecycleItems config:', err);
}

module.exports = {
    name: 'wtb',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('wtb')
            .setDescription(client.intlGet(guildId, 'commandsWtbDesc') || 'Find multi-hop trade routes to buy an item')
            .addStringOption(option => option
                .setName('have')
                .setDescription(client.intlGet(guildId, 'commandsWtbHaveDesc') || 'The name or ID of the item you have')
                .setRequired(true))
            .addIntegerOption(option => option
                .setName('amount')
                .setDescription(client.intlGet(guildId, 'commandsWtbAmountDesc') || 'The amount of the item you have')
                .setRequired(true))
            .addStringOption(option => option
                .setName('want')
                .setDescription(client.intlGet(guildId, 'commandsWtbWantDesc') || 'The name or ID of the item you want to get the maximum of')
                .setRequired(true));
    },

    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        let vendingMachines = [];
        if (rustplus && rustplus.mapMarkers && rustplus.mapMarkers.vendingMachines) {
            vendingMachines = rustplus.mapMarkers.vendingMachines;
        } else if (instance && instance.mapMarkers && instance.mapMarkers.vendingMachines) {
            vendingMachines = instance.mapMarkers.vendingMachines;
        } else {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        const targetScrapId = "-932201673"; // ID for Scrap
        const haveSearchString = interaction.options.getString('have');
        const haveQuantity = interaction.options.getInteger('amount');
        const wantSearchString = interaction.options.getString('want');

        let haveItemId = null;
        if (client.items.itemExist(haveSearchString)) {
            haveItemId = haveSearchString;
        } else {
            const item = client.items.getClosestItemIdByName(haveSearchString);
            if (item === null) {
                const str = client.intlGet(interaction.guildId, 'noItemWithNameFound', { name: haveSearchString });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                return;
            }
            haveItemId = item;
        }

        let wantItemId = null;
        if (client.items.itemExist(wantSearchString)) {
            wantItemId = wantSearchString;
        } else {
            const item = client.items.getClosestItemIdByName(wantSearchString);
            if (item === null) {
                const str = client.intlGet(interaction.guildId, 'noItemWithNameFound', { name: wantSearchString });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                return;
            }
            wantItemId = item;
        }

        const haveItemName = client.items.getName(haveItemId);
        const wantItemName = client.items.getName(wantItemId);

        const SCRAP_FEE = 20;
        const trades = [];
        for (const vendingMachine of vendingMachines) {
            if (!vendingMachine.sellOrders) continue;
            for (const order of vendingMachine.sellOrders) {
                if (order.amountInStock === 0) continue;

                const orderItemId = (client.items.itemExist(order.itemId.toString())) ? order.itemId.toString() : null;
                const orderCurrencyId = (client.items.itemExist(order.currencyId.toString())) ? order.currencyId.toString() : null;

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

        // Add recycle trades (Safe Zone Recycler)
        if (client.rustlabs && client.rustlabs.recycleData) {
            for (const [recycleItemId, data] of Object.entries(client.rustlabs.recycleData)) {
                if (!allowedRecycleItems[recycleItemId] || !allowedRecycleItems[recycleItemId].allowed) {
                    continue;
                }

                if (data['safe-zone-recycler'] && data['safe-zone-recycler'].yield) {
                    for (const yieldItem of data['safe-zone-recycler'].yield) {
                        if (yieldItem.probability === 1) {
                            trades.push({
                                outputItem: yieldItem.id.toString(),
                                outputQty: yieldItem.quantity,
                                inputItem: recycleItemId.toString(),
                                inputQty: 1, // 1 unit recycled yields the specified quantity
                                location: 'Safe Zone Recycler',
                                amountInStock: 999999, // Infinite stock for recyclers
                                isRecycle: true
                            });
                        }
                    }
                }
            }
        }

        const validPaths = [];

        function findPaths(currentItemId, currentQty, visitedItems, currentPath, totalScrapFees) {
            if (currentItemId === wantItemId) {
                validPaths.push({
                    startItem: haveItemId,
                    startQty: haveQuantity,
                    finalItem: currentItemId,
                    finalQty: currentQty,
                    totalScrapFees: totalScrapFees,
                    path: [...currentPath]
                });
                return;
            }

            if (currentPath.length >= 5) return;

            for (const trade of trades) {
                if (trade.inputItem === currentItemId) {
                    if (visitedItems.has(trade.outputItem)) continue;

                    let costPerMult = trade.inputQty;
                    let fee = (trade.isRecycle ? 0 : SCRAP_FEE);

                    let maxMultiplier = Math.floor(currentQty / costPerMult);

                    if (currentItemId === targetScrapId && fee > 0) {
                        maxMultiplier = Math.floor((currentQty - fee) / costPerMult);
                    }

                    let maxStockMultiplier = Math.floor(trade.amountInStock / trade.outputQty);
                    if (maxMultiplier > maxStockMultiplier) {
                        maxMultiplier = maxStockMultiplier;
                    }

                    if (maxMultiplier <= 0) continue;

                    const nextQty = maxMultiplier * trade.outputQty;
                    const nextScrapFees = totalScrapFees + fee;

                    const newVisited = new Set(visitedItems);
                    newVisited.add(trade.outputItem);

                    currentPath.push({ ...trade, hopMultiplier: maxMultiplier });
                    findPaths(trade.outputItem, nextQty, newVisited, currentPath, nextScrapFees);
                    currentPath.pop();
                }
            }
        }

        findPaths(haveItemId.toString(), haveQuantity, new Set([haveItemId.toString()]), [], 0);

        // Deduplication and sorting
        const bestPaths = new Map();

        for (const p of validPaths) {
            const key = p.path.map(step => `${step.inputItem}-${step.outputItem}-${step.location}`).join('|');
            const currentBest = bestPaths.get(key);

            if (!currentBest || p.finalQty > currentBest.finalQty) {
                bestPaths.set(key, p);
            } else if (p.finalQty === currentBest.finalQty && p.totalScrapFees < currentBest.totalScrapFees) {
                bestPaths.set(key, p);
            }
        }

        const sortedBestPaths = Array.from(bestPaths.values());
        sortedBestPaths.sort((a, b) => {
            if (a.finalQty !== b.finalQty) {
                return b.finalQty - a.finalQty; // descending final yield
            }
            return a.totalScrapFees - b.totalScrapFees; // ascending scrap fee
        });

        let foundLines = '';
        for (const p of sortedBestPaths) {
            if (foundLines === '') {
                foundLines += '```diff\n';
            }

            let line = '+ ';
            let runningQty = p.startQty;
            line += `[${Math.floor(runningQty)}] ${client.items.getName(p.startItem)} `;

            for (const step of p.path) {
                line += `-> [${step.location}] -> `;
                runningQty = step.hopMultiplier * step.outputQty;
                line += `[${Math.floor(runningQty)}] ${client.items.getName(step.outputItem)} `;
            }

            line += `(Total Fees: ${p.totalScrapFees} Scrap)\n`;

            if (foundLines.length + line.length > 3900) {
                foundLines += '...\n';
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
            title: `Trade Routes: ${haveItemName} -> ${wantItemName}`,
            description: foundLines,
            footer: { text: instance.serverList && rustplus && rustplus.serverId && instance.serverList[rustplus.serverId] ? instance.serverList[rustplus.serverId].title : 'Offline' }
        });

        await client.interactionEditReply(interaction, { content: null, embeds: [embed] });

    }
};
