class DiscordBot extends Discord.Client {
    constructor(props) {
        super(props);

        this.logger = new Logger(Path.join(__dirname, '..', '..', 'logs/discordBot.log'), 'default');

        this.commands = new Discord.Collection();
        this.fcmListeners = new Object();
        this.fcmListenersLite = new Object();
        this.instances = {};

        // Load commands
        const commandFiles = Fs.readdirSync(Path.join(__dirname, '..', 'commands'))
            .filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`../commands/${file}`);
            this.commands.set(command.name, command);
        }
    }

    // ... rest of the code ...

    async handleInGameCommand(message) {
        const args = message.split(' ');
        const commandName = args.shift().toLowerCase();

        const command = this.commands.get(commandName);
        if (command) {
            try {
                await command.execute(message, args);
            } catch (error) {
                this.log(this.intlGet(null, 'errorCap'), `Error executing command ${commandName}: ${error}`, 'error');
            }
        } else {
            this.log(this.intlGet(null, 'errorCap'), `Unknown command: ${commandName}`, 'error');
        }
    }
}
