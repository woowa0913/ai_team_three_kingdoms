const crypto = require('crypto');
const path = require('path');
const os = require('os');

function buildFallbackEncryptionKey() {
    return crypto
        .createHash('sha256')
        .update(`ai-orchestra:${os.hostname()}:${os.userInfo().username}`)
        .digest('hex');
}

function getStoreEncryptionKey() {
    const fromEnv = typeof process.env.AI_ORCHESTRA_STORE_KEY === 'string'
        ? process.env.AI_ORCHESTRA_STORE_KEY.trim()
        : '';
    return fromEnv || buildFallbackEncryptionKey();
}

function getStoreOptions() {
    const options = {
        encryptionKey: getStoreEncryptionKey(),
    };
    const customCwd = typeof process.env.AI_ORCHESTRA_STORE_CWD === 'string'
        ? process.env.AI_ORCHESTRA_STORE_CWD.trim()
        : '';
    if (customCwd) {
        options.cwd = path.resolve(customCwd);
    }
    return options;
}

module.exports = {
    getStoreOptions,
    getStoreEncryptionKey,
};
