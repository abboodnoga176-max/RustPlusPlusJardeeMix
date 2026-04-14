/*
	Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.

	https://github.com/alexemanuelol/rustplusplus

*/

const Builder = require('@discordjs/builders');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const DiscordButtons = require('../discordTools/discordButtons.js');

module.exports = {
	name: 'coderaid',

	getData(client, guildId) {
		return new Builder.SlashCommandBuilder()
			.setName('coderaid')
			.setDescription('Sets the current channel as the Code Raiding channel.');
	},

	async execute(client, interaction) {
		const verifyId = Math.floor(100000 + Math.random() * 900000);
		client.logInteraction(interaction, verifyId, 'slashCommand');

		if (!await client.validatePermissions(interaction)) return;
		if (!client.isAdministrator(interaction)) {
			await client.interactionReply(interaction, {
				content: client.intlGet(interaction.guildId, 'missingAdministratorPermissions'),
				ephemeral: true
			});
			return;
		}

		const instance = client.getInstance(interaction.guildId);
		instance.channelId.codeRaid = interaction.channelId;
		client.setInstance(interaction.guildId, instance);

		await client.interactionReply(interaction, {
			content: 'Code Raiding channel set successfully.',
			ephemeral: true
		});

		const DiscordMessages = require('../discordTools/discordMessages.js');
		await DiscordMessages.sendUpdateCodeRaidDashboardMessage(interaction.guildId);
	},
};
