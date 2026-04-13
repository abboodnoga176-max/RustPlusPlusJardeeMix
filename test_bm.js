const axios = require('axios');
axios.get('https://api.battlemetrics.com/players/1191801649').then(res => {
    console.log(JSON.stringify(res.data.data, null, 2));
}).catch(console.error);
