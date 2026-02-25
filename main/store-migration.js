const { cloneAgent, mergeWithDefaults } = require('./store-utils');

function seedDefaultAgents(store, defaultAgents) {
    const seeded = defaultAgents.map(cloneAgent);
    store.set('agents', seeded);
    return seeded;
}

function loadAndMigrateAgents(store, defaultAgents) {
    const agents = store.get('agents');
    if (!Array.isArray(agents)) {
        return seedDefaultAgents(store, defaultAgents);
    }

    const merged = mergeWithDefaults(agents, defaultAgents);
    if (merged.length !== agents.length || JSON.stringify(merged) !== JSON.stringify(agents)) {
        store.set('agents', merged);
    }

    return merged;
}

module.exports = {
    seedDefaultAgents,
    loadAndMigrateAgents,
};
