const fs = require('fs');
const rustlabsRecycleData = JSON.parse(fs.readFileSync('src/staticFiles/rustlabsRecycleData.json'));

const getRecycleYield = (itemId) => {
    const data = rustlabsRecycleData[itemId];
    if (!data) return null;
    const safeZoneData = data['safe-zone-recycler'];
    if (!safeZoneData || !safeZoneData.yield || safeZoneData.yield.length === 0) return null;
    return safeZoneData.yield;
}

console.log(getRecycleYield('-912360814')); // Try an item like 'metal pipe' maybe? I don't know the ID
