const state = {
    agentId: null,
    isStreaming: false,
    streamingMessageEl: null,
    streamingContentEl: null,
};
function qs(selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
    }
    return null;
}
const ui = {
    chatMessages: () => qs(['.chat-messages']),
    messageInput: () => qs(['.message-input']),
    sendButton: () => qs(['.btn-send']),
    clearButton: () => qs(['.btn-clear', '.btn-reset', '.btn-clear-history']),
    closeButton: () => qs(['.btn-close']),
    statusLabel: () => qs(['.response-status', '.typing-status']),
    agentName: () => qs(['[data-agent-name]', '.agent-name']),
    agentEmoji: () => qs(['[data-agent-emoji]', '.agent-emoji']),
    agentModel: () => qs(['[data-agent-model]', '.agent-model']),
    agentIntro: () => qs(['[data-agent-intro]', '.agent-intro']),
};
function formatTimestamp(timestamp) {
    return new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(timestamp));
}
function scrollToBottom() {
    const container = ui.chatMessages();
    if (!container) {
        return;
    }
    container.scrollTop = container.scrollHeight;
}
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    window.setTimeout(() => {
        toast.classList.remove('visible');
    }, 2600);
}
function createMessageElement(message, options = {}) {
    const messageEl = document.createElement('article');
    messageEl.className = `message ${message.role}`;
    if (options.streaming) {
        messageEl.classList.add('streaming');
    }
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = message.content || '';
    messageEl.appendChild(contentEl);
    const timestampEl = document.createElement('time');
    timestampEl.className = 'message-timestamp';
    timestampEl.textContent = formatTimestamp(message.timestamp || Date.now());
    messageEl.appendChild(timestampEl);
    return { messageEl, contentEl };
}
function appendMessage(message, options = {}) {
    const container = ui.chatMessages();
    if (!container) {
        return null;
    }
    const { messageEl, contentEl } = createMessageElement(message, options);
    container.appendChild(messageEl);
    scrollToBottom();
    return { messageEl, contentEl };
}
function renderHistory(history) {
    const container = ui.chatMessages();
    if (!container) {
        return;
    }
    container.innerHTML = '';
    history.forEach((message) => {
        appendMessage(message);
    });
}
function setStreamingState(isStreaming) {
    state.isStreaming = isStreaming;
    const messageInput = ui.messageInput();
    const sendButton = ui.sendButton();
    const statusLabel = ui.statusLabel();
    const hasInput = messageInput ? messageInput.value.trim().length > 0 : false;
    if (messageInput) {
        messageInput.disabled = isStreaming;
    }
    if (sendButton) {
        sendButton.disabled = isStreaming || !hasInput;
    }
    if (statusLabel) {
        statusLabel.textContent = isStreaming ? 'AI가 응답 중...' : '';
    }
}
function updateSendButtonState() {
    if (state.isStreaming) {
        return;
    }
    const messageInput = ui.messageInput();
    const sendButton = ui.sendButton();
    if (!messageInput || !sendButton) {
        return;
    }
    sendButton.disabled = messageInput.value.trim().length === 0;
}
async function loadAgentMeta(agentId) {
    const agent = await window.electronAPI.getAgent(agentId);
    if (!agent) {
        throw new Error('에이전트 정보를 찾을 수 없습니다.');
    }
    const agentName = ui.agentName();
    const agentEmoji = ui.agentEmoji();
    const agentModel = ui.agentModel();
    const agentIntro = ui.agentIntro();
    if (agentName) {
        agentName.textContent = agent.name || '';
    }
    if (agentEmoji) {
        agentEmoji.textContent = agent.emoji || '🤖';
    }
    if (agentModel) {
        agentModel.textContent = agent.model || '';
    }
    if (agentIntro) {
        agentIntro.textContent = agent.expertise || agent.persona || '';
    }

    // 새 로직: 페르소나 및 능력/스킬 탭 채우기
    const personaName = document.getElementById('persona-name');
    const personaDesc = document.getElementById('persona-desc');
    const expertiseText = document.getElementById('expertise-text');
    if (personaName) personaName.textContent = agent.name || '';
    if (personaDesc) personaDesc.textContent = agent.persona || '';
    if (expertiseText) expertiseText.textContent = agent.expertise || '';

    // API 키 상태 확인
    if (window.electronAPI.loadApiKeys) {
        const keys = await window.electronAPI.loadApiKeys();
        const warning = document.getElementById('api-key-warning');
        if (warning && agent) {
            const providerKey = keys[agent.provider] || '';
            const hasKey = providerKey.length > 0 && providerKey !== '****';
            warning.style.display = hasKey ? 'none' : 'flex';
            const btn = warning.querySelector('.btn-open-settings');
            if (btn) btn.addEventListener('click', () => window.electronAPI.openSettings());
        }
    }
}
async function loadChatHistory(agentId) {
    const history = await window.electronAPI.getChatHistory(agentId);
    renderHistory(Array.isArray(history) ? history : []);
}
function finalizeStreamingMessage() {
    if (state.streamingMessageEl) {
        state.streamingMessageEl.classList.remove('streaming');
    }
    state.streamingMessageEl = null;
    state.streamingContentEl = null;
    setStreamingState(false);
}
function handleStreamChunk(data) {
    const chunk = typeof data?.chunk === 'string' ? data.chunk : '';
    if (!chunk) {
        return;
    }
    if (!state.streamingMessageEl || !state.streamingContentEl) {
        const inserted = appendMessage(
            {
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
            },
            { streaming: true }
        );
        state.streamingMessageEl = inserted?.messageEl || null;
        state.streamingContentEl = inserted?.contentEl || null;
    }
    if (state.streamingContentEl) {
        state.streamingContentEl.textContent += chunk;
        scrollToBottom();
    }
}
function handleStreamEnd() {
    finalizeStreamingMessage();
}
function handleStreamError(data) {
    const message = data?.message || '응답 생성 중 오류가 발생했습니다.';
    finalizeStreamingMessage();
    showToast(message);
}
async function submitMessage() {
    if (state.isStreaming) {
        return;
    }
    const messageInput = ui.messageInput();
    if (!messageInput) {
        return;
    }
    const content = messageInput.value.trim();
    if (!content) {
        return;
    }
    appendMessage({
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        agentId: state.agentId,
    });
    messageInput.value = '';
    setStreamingState(true);
    const inserted = appendMessage(
        {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            agentId: state.agentId,
        },
        { streaming: true }
    );
    state.streamingMessageEl = inserted?.messageEl || null;
    state.streamingContentEl = inserted?.contentEl || null;
    try {
        await window.electronAPI.sendMessage(state.agentId, content);
    } catch (error) {
        finalizeStreamingMessage();
        showToast(error.message || '메시지 전송에 실패했습니다.');
    }
}
async function clearHistory() {
    if (!state.agentId) {
        return;
    }
    const confirmed = window.confirm('해당 에이전트의 대화 기록을 모두 삭제할까요?');
    if (!confirmed) {
        return;
    }
    try {
        await window.electronAPI.clearHistory(state.agentId);
        renderHistory([]);
        showToast('대화 기록을 초기화했습니다.');
    } catch (error) {
        showToast(error.message || '대화 기록 초기화에 실패했습니다.');
    }
}

function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const content = document.getElementById(`tab-${btn.dataset.tab}`);
            if (content) content.classList.add('active');
        });
    });
}

async function init() {
    if (!window.electronAPI) {
        console.error('electronAPI가 로드되지 않았습니다.');
        return;
    }
    const params = new URLSearchParams(window.location.search);
    state.agentId = params.get('agentId');
    if (!state.agentId) {
        showToast('agentId가 없습니다.');
        return;
    }
    try {
        await loadAgentMeta(state.agentId);
        await loadChatHistory(state.agentId);
    } catch (error) {
        showToast(error.message || '초기화에 실패했습니다.');
    }

    bindTabs();

    const messageInput = ui.messageInput();
    const sendButton = ui.sendButton();
    const clearButton = ui.clearButton();
    const closeButton = ui.closeButton();
    if (messageInput) {
        messageInput.addEventListener('input', updateSendButtonState);
        messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
            }
        });
    }
    if (sendButton) {
        sendButton.addEventListener('click', submitMessage);
    }
    if (clearButton) {
        clearButton.addEventListener('click', clearHistory);
    }
    if (closeButton) {
        closeButton.addEventListener('click', () => window.close());
    }
    window.electronAPI.onStreamChunk(handleStreamChunk);
    window.electronAPI.onStreamEnd(handleStreamEnd);
    window.electronAPI.onStreamError(handleStreamError);
    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeStreamListeners();
    });
    updateSendButtonState();
}
document.addEventListener('DOMContentLoaded', init);
