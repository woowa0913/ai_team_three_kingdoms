const { contextBridge, ipcRenderer } = require('electron');

function addSingleListener(channel, callback) {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_event, payload) => {
        if (typeof callback === 'function') {
            callback(payload);
        }
    });
}

function addSingleVoidListener(channel, callback) {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, () => {
        if (typeof callback === 'function') {
            callback();
        }
    });
}

contextBridge.exposeInMainWorld('electronAPI', {
    getAgents: () => ipcRenderer.invoke('get-agents'),
    addAgent: (data) => ipcRenderer.invoke('add-agent', data),
    updateAgent: (agentId, data) => ipcRenderer.invoke('update-agent', { agentId, data }),
    reorderAgent: (agentId, direction) => ipcRenderer.invoke('reorder-agent', { agentId, direction }),
    deleteAgent: (agentId) => ipcRenderer.invoke('delete-agent', agentId),
    openDashboard: (agentId) => ipcRenderer.send('open-dashboard', agentId),
    openAddAgent: (agentId) => ipcRenderer.send('open-add-agent', agentId),
    openMeetingRoom: () => ipcRenderer.send('open-meeting'),
    openSettings: () => ipcRenderer.send('open-settings'),
    hideWidget: () => ipcRenderer.send('hide-widget'),
    quitApp: () => ipcRenderer.send('quit-app'),
    setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),
    startMeeting: (topic, participantIds, maxRounds) =>
        ipcRenderer.invoke('start-meeting', { topic, participantIds, maxRounds }),
    pauseMeeting: () => ipcRenderer.invoke('pause-meeting'),
    resumeMeeting: () => ipcRenderer.invoke('resume-meeting'),
    sendMeetingMessage: (content) => ipcRenderer.invoke('send-meeting-message', { content }),
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
    testApiKey: (provider) => ipcRenderer.invoke('test-api-key', provider),
    loadApiKeys: () => ipcRenderer.invoke('load-api-keys'),
    saveAgentApiKey: (agentId, key) => ipcRenderer.invoke('save-agent-api-key', { agentId, key }),
    loadAgentApiKeys: () => ipcRenderer.invoke('load-agent-api-keys'),
    getOllamaModels: () => ipcRenderer.invoke('get-ollama-models'),
    exportChat: (agentId) => ipcRenderer.invoke('export-chat', { agentId }),
    exportMeeting: () => ipcRenderer.invoke('export-meeting'),
    setWindowOpacity: (opacity) => ipcRenderer.invoke('set-window-opacity', opacity),
    getTheme: () => ipcRenderer.invoke('get-theme'),
    setTheme: (mode) => ipcRenderer.invoke('set-theme', mode),
    onStreamChunk: (callback) => addSingleListener('stream-chunk', callback),
    onStreamEnd: (callback) => addSingleVoidListener('stream-end', callback),
    onStreamError: (callback) => addSingleListener('stream-error', callback),
    onPersonaStreamChunk: (callback) => addSingleListener('persona-stream-chunk', callback),
    onPersonaStreamEnd: (callback) => addSingleVoidListener('persona-stream-end', callback),
    onPersonaStreamError: (callback) => addSingleListener('persona-stream-error', callback),
    removeStreamListeners: () => {
        ipcRenderer.removeAllListeners('stream-chunk');
        ipcRenderer.removeAllListeners('stream-end');
        ipcRenderer.removeAllListeners('stream-error');
        ipcRenderer.removeAllListeners('persona-stream-chunk');
        ipcRenderer.removeAllListeners('persona-stream-end');
        ipcRenderer.removeAllListeners('persona-stream-error');
    },
    onMeetingSpeakerStart: (callback) => addSingleListener('meeting-speaker-start', callback),
    onMeetingChunk: (callback) => addSingleListener('meeting-chunk', callback),
    onMeetingSpeakerEnd: (callback) => addSingleListener('meeting-speaker-end', callback),
    onMeetingPaused: (callback) => addSingleListener('meeting-paused', callback),
    onMeetingEnded: (callback) => addSingleVoidListener('meeting-ended', callback),
    onAgentsUpdated: (callback) => addSingleListener('agents-updated', callback),
    onDashboardClosed: (callback) => addSingleListener('dashboard-closed', callback),
    onSystemThemeChanged: (callback) => addSingleListener('system-theme-changed', callback),
    removeMeetingListeners: () => {
        [
            'meeting-speaker-start',
            'meeting-chunk',
            'meeting-speaker-end',
            'meeting-paused',
            'meeting-ended',
            'agents-updated',
            'dashboard-closed',
            'system-theme-changed',
        ].forEach((channel) => {
            ipcRenderer.removeAllListeners(channel);
        });
    },
});
