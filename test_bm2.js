const axios = require('axios');
axios.get('https://api.battlemetrics.com/players/1191801649?include=server').then(res => {
    const included = res.data.included || [];
    for(const inc of included) {
        if(inc.type === 'server' && inc.meta && inc.meta.online === true) {
            console.log("Online on server: ", inc.attributes.name);
        }
    }
}).catch(console.error);
