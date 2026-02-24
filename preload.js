const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAgents: () => ipcRenderer.invoke('get-agents'),
    addAgent: (data) => ipcRenderer.invoke('add-agent', data),
    deleteAgent: (agentId) => ipcRenderer.invoke('delete-agent', agentId),
    openDashboard: (agentId) => ipcRenderer.send('open-dashboard', agentId),
    openAddAgent: () => ipcRenderer.send('open-add-agent'),
    openMeetingRoom: () => ipcRenderer.send('open-meeting'),
    openSettings: () => ipcRenderer.send('open-settings'),
    hideWidget: () => ipcRenderer.send('hide-widget'),
    quitApp: () => ipcRenderer.send('quit-app'),
    startMeeting: (topic, participantIds, maxRounds) =>
        ipcRenderer.invoke('start-meeting', { topic, participantIds, maxRounds }),
    stopMeeting: () => ipcRenderer.invoke('stop-meeting'),
    getMeetingState: () => ipcRenderer.invoke('get-meeting-state'),
    sendMessage: (agentId, content) => ipcRenderer.invoke('send-message', { agentId, content }),
    getAgent: (agentId) => ipcRenderer.invoke('get-agent', agentId),
    getChatHistory: (agentId) => ipcRenderer.invoke('get-chat-history', agentId),
    clearHistory: (agentId) => ipcRenderer.invoke('clear-history', agentId),
    updateAgentPersona: (agentId, persona) =>
        ipcRenderer.invoke('update-agent-persona', { agentId, persona }),
    aiImprovePersona: (agentId, instruction) =>
        ipcRenderer.invoke('ai-improve-persona', { agentId, instruction }),
    saveApiKey: (provider, key) => ipcRenderer.invoke('save-api-key', { provider, key }),
    loadApiKeys: () => ipcRenderer.invoke('load-api-keys'),
    onStreamChunk: (callback) => {
        ipcRenderer.on('stream-chunk', (_event, data) => {
            if (typeof callback === 'function') {
                callback(data);
            }
        });
    },
    onStreamEnd: (callback) => {
        ipcRenderer.on('stream-end', () => {
            if (typeof callback === 'function') {
                callback();
            }
        });
    },
    onStreamError: (callback) => {
        ipcRenderer.on('stream-error', (_event, data) => {
            if (typeof callback === 'function') {
                callback(data);
            }
        });
    },
    onPersonaStreamChunk: (callback) => {
        ipcRenderer.on('persona-stream-chunk', (_event, data) => {
            if (typeof callback === 'function') {
                callback(data);
            }
        });
    },
    onPersonaStreamEnd: (callback) => {
        ipcRenderer.on('persona-stream-end', () => {
            if (typeof callback === 'function') {
                callback();
            }
        });
    },
    onPersonaStreamError: (callback) => {
        ipcRenderer.on('persona-stream-error', (_event, data) => {
            if (typeof callback === 'function') {
                callback(data);
            }
        });
    },
    removeStreamListeners: () => {
        ipcRenderer.removeAllListeners('stream-chunk');
        ipcRenderer.removeAllListeners('stream-end');
        ipcRenderer.removeAllListeners('stream-error');
        ipcRenderer.removeAllListeners('persona-stream-chunk');
        ipcRenderer.removeAllListeners('persona-stream-end');
        ipcRenderer.removeAllListeners('persona-stream-error');
    },
    onMeetingSpeakerStart: (callback) => {
        ipcRenderer.on('meeting-speaker-start', (_event, data) => {
            if (typeof callback === 'function') {
                callback(data);
            }
        });
    },
    onMeetingChunk: (callback) => {
        ipcRenderer.on('meeting-chunk', (_event, data) => {
            if (typeof callback === 'function') {
                callback(data);
            }
        });
    },
    onMeetingSpeakerEnd: (callback) => {
        ipcRenderer.on('meeting-speaker-end', (_event, data) => {
            if (typeof callback === 'function') {
                callback(data);
            }
        });
    },
    onMeetingEnded: (callback) => {
        ipcRenderer.on('meeting-ended', () => {
            if (typeof callback === 'function') {
                callback();
            }
        });
    },
    onAgentsUpdated: (callback) => {
        ipcRenderer.on('agents-updated', (_event, payload) => {
            if (typeof callback === 'function') {
                callback(payload);
            }
        });
    },
    removeMeetingListeners: () => {
        ['meeting-speaker-start', 'meeting-chunk', 'meeting-speaker-end', 'meeting-ended', 'agents-updated'].forEach((channel) => {
            ipcRenderer.removeAllListeners(channel);
        });
    },
});
