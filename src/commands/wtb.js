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



        const SCRAP_FEE = 20;
        const trades = [];
        for (const vendingMachine of vendingMachines) {
            if (!vendingMachine.hasOwnProperty('sellOrders')) continue;
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
                if (data['safe-zone-recycler'] && data['safe-zone-recycler'].yield) {
                    for (const yieldItem of data['safe-zone-recycler'].yield) {
                        // Only consider guaranteed yields for reliable trade paths
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

                    const multiplier = Math.ceil(qtyNeeded / trade.outputQty);
                    const nextQtyNeeded = multiplier * trade.inputQty;
                    const nextScrapFees = totalScrapFees + (trade.isRecycle ? 0 : SCRAP_FEE);

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
            const currentBest = bestPaths.get(p.startItem);

            if (!currentBest) {
                bestPaths.set(p.startItem, p);
            } else {
                const pYield = p.path[0].hopMultiplier * p.path[0].outputQty;
                const currentBestYield = currentBest.path[0].hopMultiplier * currentBest.path[0].outputQty;

                const pRatio = p.normalizedQty / pYield;
                const currentBestRatio = currentBest.normalizedQty / currentBestYield;

                if (pRatio < currentBestRatio) {
                    bestPaths.set(p.startItem, p);
                } else if (pRatio === currentBestRatio) {
                    const pScrapFeePerYield = p.totalScrapFees / pYield;
                    const currentBestScrapFeePerYield = currentBest.totalScrapFees / currentBestYield;

                    if (pScrapFeePerYield < currentBestScrapFeePerYield) {
                        bestPaths.set(p.startItem, p);
                    } else if (pScrapFeePerYield === currentBestScrapFeePerYield) {
                        if (pYield > currentBestYield) {
                            bestPaths.set(p.startItem, p);
                        }
                    }
                }
            }
        }

        const sortedBestPaths = Array.from(bestPaths.values());

        sortedBestPaths.sort((a, b) => {
            const aYield = a.path[0].hopMultiplier * a.path[0].outputQty;
            const bYield = b.path[0].hopMultiplier * b.path[0].outputQty;

            const aScrapCost = a.totalScrapFees + (a.startItem === targetScrapId ? a.normalizedQty : 0);
            const bScrapCost = b.totalScrapFees + (b.startItem === targetScrapId ? b.normalizedQty : 0);

            const aScrapCostPerYield = aScrapCost / aYield;
            const bScrapCostPerYield = bScrapCost / bYield;

            if (aScrapCostPerYield !== bScrapCostPerYield) {
                return aScrapCostPerYield - bScrapCostPerYield;
            }

            if (aYield !== bYield) {
                return bYield - aYield; // descending yield
            }

            return a.normalizedQty - b.normalizedQty; // ascending input qty
        });

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
            line += `[${Math.ceil(runningQty)}] ${client.items.getName(p.startItem)} `;

            for (const step of forwardPath) {
                line += `-> [${step.location}] -> `;
                // To display what happens after this step:
                // output of this step = hopMultiplier * step.outputQty
                runningQty = step.hopMultiplier * step.outputQty;
                line += `[${Math.ceil(runningQty)}] ${client.items.getName(step.outputItem)} `;
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
            footer: { text: instance.serverList && rustplus && rustplus.serverId && instance.serverList[rustplus.serverId] ? instance.serverList[rustplus.serverId].title : 'Offline' }
        });

        await client.interactionEditReply(interaction, { content: null, embeds: [embed] });

    }
};
