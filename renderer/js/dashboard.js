const state = {
    agentId: null,
    agent: null,
    agents: [],
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

function renderAssistantMarkdown(content) {
    if (typeof content !== 'string') {
        return '';
    }
    if (typeof window.renderMarkdown === 'function') {
        return window.renderMarkdown(content);
    }
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function applyAssistantContent(contentEl, content) {
    if (!contentEl) {
        return;
    }
    contentEl.innerHTML = renderAssistantMarkdown(content);
}

function createMessageElement(message, options = {}) {
    const messageEl = document.createElement('article');
    messageEl.className = `message ${message.role}`;
    if (options.streaming) {
        messageEl.classList.add('streaming');
    }
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    const safeContent = message.content || '';
    if (message.role === 'assistant' && !options.streaming) {
        applyAssistantContent(contentEl, safeContent);
    } else {
        contentEl.textContent = safeContent;
    }
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
    state.agent = agent;
    const agentName = ui.agentName();
    const agentEmoji = ui.agentEmoji();
    const agentModel = ui.agentModel();
    const agentIntro = ui.agentIntro();
    if (agentName) {
        agentName.textContent = agent.name || '';
    }
    if (agentEmoji) {
        if (agent.image) {
            agentEmoji.innerHTML = '';
            const headerImg = document.createElement('img');
            headerImg.className = 'agent-header-img';
            headerImg.src = agent.image;
            headerImg.alt = agent.name || 'agent';
            agentEmoji.appendChild(headerImg);
        } else {
            agentEmoji.innerHTML = '';
            agentEmoji.textContent = agent.emoji || '🤖';
        }
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
    const personaTextarea = document.getElementById('persona-textarea');
    const expertiseText = document.getElementById('expertise-text');
    if (personaName) personaName.textContent = agent.name || '';
    if (personaDesc) personaDesc.textContent = agent.persona || '';
    if (personaTextarea) personaTextarea.value = agent.persona || '';
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

function closeAgentSwitcherDropdown() {
    const dropdown = document.getElementById('agent-switcher-dropdown');
    const switchButton = document.getElementById('btn-agent-switch');
    if (!dropdown || !switchButton) {
        return;
    }
    dropdown.hidden = true;
    switchButton.classList.remove('open');
}

function openAgentSwitcherDropdown() {
    const dropdown = document.getElementById('agent-switcher-dropdown');
    const switchButton = document.getElementById('btn-agent-switch');
    if (!dropdown || !switchButton) {
        return;
    }
    dropdown.hidden = false;
    switchButton.classList.add('open');
}

function renderAgentSwitcherItems(currentAgentId) {
    const dropdown = document.getElementById('agent-switcher-dropdown');
    if (!dropdown) {
        return;
    }
    dropdown.innerHTML = '';

    state.agents.forEach((agent) => {
        const item = document.createElement('li');
        item.className = 'agent-switcher-item';
        if (agent.id === currentAgentId) {
            item.classList.add('current');
        }
        item.innerHTML = `
            <span class="agent-switcher-label">${agent.emoji || '🤖'} ${agent.name}</span>
            <span class="agent-switcher-check">${agent.id === currentAgentId ? '✓' : ''}</span>
        `;
        item.addEventListener('click', () => {
            if (agent.id === currentAgentId) {
                closeAgentSwitcherDropdown();
                return;
            }
            const next = new URL(window.location.href);
            next.searchParams.set('agentId', agent.id);
            window.location.href = next.toString();
        });
        dropdown.appendChild(item);
    });
}

async function bindAgentSwitcher(currentAgentId) {
    const switchButton = document.getElementById('btn-agent-switch');
    const dropdown = document.getElementById('agent-switcher-dropdown');
    if (!switchButton || !dropdown) {
        return;
    }

    try {
        const agents = await window.electronAPI.getAgents();
        state.agents = Array.isArray(agents) ? agents : [];
        renderAgentSwitcherItems(currentAgentId);
    } catch (error) {
        console.error('에이전트 목록 로드 실패:', error);
        state.agents = [];
        dropdown.innerHTML = '<li class="agent-switcher-item disabled">에이전트 목록을 불러오지 못했습니다.</li>';
    }

    switchButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const nextHidden = !dropdown.hidden;
        if (nextHidden) {
            closeAgentSwitcherDropdown();
        } else {
            openAgentSwitcherDropdown();
        }
    });

    dropdown.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', () => {
        closeAgentSwitcherDropdown();
    });
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
    if (state.streamingContentEl) {
        const finalContent = state.streamingContentEl.textContent || '';
        applyAssistantContent(state.streamingContentEl, finalContent);
    }
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

async function exportChat() {
    if (!state.agentId || !window.electronAPI?.exportChat) {
        return;
    }
    try {
        const result = await window.electronAPI.exportChat(state.agentId);
        if (!result?.ok) {
            if (result?.canceled) {
                return;
            }
            throw new Error(result?.error || '내보내기에 실패했습니다.');
        }
        showToast('대화 기록을 저장했습니다.');
    } catch (error) {
        showToast(error.message || '대화 기록 저장 실패');
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

// ─── 페르소나 편집 ──────────────────────────────────────────────────────
const personaEditState = {
    aiSuggestion: '',
};

function setPersonaEditMode(isEditing) {
    const readonly = document.getElementById('persona-readonly');
    const editEl = document.getElementById('persona-edit');
    const btnEdit = document.getElementById('btn-edit-persona');
    if (!readonly || !editEl || !btnEdit) return;

    if (isEditing) {
        const textarea = document.getElementById('persona-textarea');
        if (textarea) textarea.value = (state.agent && state.agent.persona) ? state.agent.persona : '';
        readonly.hidden = true;
        editEl.hidden = false;
        btnEdit.textContent = '읽기 모드';
    } else {
        const aiPanel = document.getElementById('ai-help-panel');
        if (aiPanel) aiPanel.hidden = true;
        readonly.hidden = false;
        editEl.hidden = true;
        btnEdit.textContent = '✏️ 편집';
    }
}

function setPersonaAiStreaming(isStreaming) {
    const sendBtn = document.getElementById('btn-ai-send');
    if (sendBtn) sendBtn.disabled = isStreaming;
}

function resetPersonaSuggestion() {
    personaEditState.aiSuggestion = '';
    const responseEl = document.getElementById('ai-help-response');
    const applyBtn = document.getElementById('btn-apply-suggestion');
    if (responseEl) responseEl.textContent = '';
    if (applyBtn) applyBtn.disabled = true;
}

async function savePersona() {
    const textarea = document.getElementById('persona-textarea');
    if (!textarea || !state.agentId) return;
    const newPersona = textarea.value.trim();
    if (!newPersona) {
        showToast('페르소나 내용을 입력해주세요.');
        return;
    }
    try {
        const result = await window.electronAPI.updateAgentPersona(state.agentId, newPersona);
        if (!result?.ok) throw new Error(result?.error || '저장 실패');
        if (state.agent) state.agent.persona = newPersona;
        const descEl = document.getElementById('persona-desc');
        if (descEl) descEl.textContent = newPersona;
        setPersonaEditMode(false);
        showToast('페르소나를 저장했습니다.');
    } catch (error) {
        showToast(error.message || '페르소나 저장에 실패했습니다.');
    }
}

function handlePersonaStreamChunk(data) {
    const chunk = typeof data?.chunk === 'string' ? data.chunk : '';
    if (!chunk) return;
    const responseEl = document.getElementById('ai-help-response');
    if (responseEl) {
        if (!personaEditState.aiSuggestion) responseEl.textContent = '';
        personaEditState.aiSuggestion += chunk;
        responseEl.textContent = personaEditState.aiSuggestion;
        responseEl.scrollTop = responseEl.scrollHeight;
    }
}

function handlePersonaStreamEnd() {
    setPersonaAiStreaming(false);
    const applyBtn = document.getElementById('btn-apply-suggestion');
    if (applyBtn) applyBtn.disabled = !personaEditState.aiSuggestion;
}

function handlePersonaStreamError(data) {
    setPersonaAiStreaming(false);
    showToast(data?.message || 'AI 개선 중 오류가 발생했습니다.');
}

async function requestAiImprovePersona() {
    const input = document.getElementById('ai-help-input');
    const responseEl = document.getElementById('ai-help-response');
    if (!input || !state.agentId) return;
    const instruction = input.value.trim();
    if (!instruction) {
        showToast('제갈량에게 전달할 지시를 입력해주세요.');
        return;
    }
    resetPersonaSuggestion();
    if (responseEl) responseEl.textContent = '제갈량이 검토 중입니다...';
    setPersonaAiStreaming(true);
    try {
        await window.electronAPI.aiImprovePersona(state.agentId, instruction);
    } catch (error) {
        if (responseEl) responseEl.textContent = '';
        setPersonaAiStreaming(false);
        showToast(error.message || 'AI 개선 요청에 실패했습니다.');
    }
}

function bindPersonaEditor() {
    document.getElementById('btn-edit-persona')?.addEventListener('click', () => {
        const editEl = document.getElementById('persona-edit');
        const isCurrentlyEditing = editEl && !editEl.hidden;
        setPersonaEditMode(!isCurrentlyEditing);
    });
    document.getElementById('btn-save-persona')?.addEventListener('click', savePersona);
    document.getElementById('btn-cancel-persona')?.addEventListener('click', () => setPersonaEditMode(false));

    document.getElementById('btn-ai-help')?.addEventListener('click', () => {
        const panel = document.getElementById('ai-help-panel');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (!panel.hidden) document.getElementById('ai-help-input')?.focus();
    });

    document.getElementById('btn-close-ai-help')?.addEventListener('click', () => {
        const panel = document.getElementById('ai-help-panel');
        if (panel) panel.hidden = true;
    });

    const aiInput = document.getElementById('ai-help-input');
    const btnAiSend = document.getElementById('btn-ai-send');
    aiInput?.addEventListener('input', () => {
        if (btnAiSend) btnAiSend.disabled = !aiInput.value.trim();
    });
    aiInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            requestAiImprovePersona();
        }
    });
    btnAiSend?.addEventListener('click', requestAiImprovePersona);

    document.getElementById('btn-apply-suggestion')?.addEventListener('click', () => {
        if (!personaEditState.aiSuggestion) return;
        const textarea = document.getElementById('persona-textarea');
        if (textarea) textarea.value = personaEditState.aiSuggestion;
        const panel = document.getElementById('ai-help-panel');
        if (panel) panel.hidden = true;
        showToast('제안이 적용됐습니다. 저장 버튼으로 확정하세요.');
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
        await bindAgentSwitcher(state.agentId);
    } catch (error) {
        showToast(error.message || '초기화에 실패했습니다.');
    }

    bindTabs();
    bindPersonaEditor();
    setPersonaEditMode(false);
    setPersonaAiStreaming(false);
    resetPersonaSuggestion();

    const messageInput = ui.messageInput();
    const sendButton = ui.sendButton();
    const clearButton = ui.clearButton();
    const exportButton = document.querySelector('.btn-export');
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
    if (exportButton) {
        exportButton.addEventListener('click', exportChat);
    }
    if (closeButton) {
        closeButton.addEventListener('click', () => window.close());
    }
    window.electronAPI.onStreamChunk(handleStreamChunk);
    window.electronAPI.onStreamEnd(handleStreamEnd);
    window.electronAPI.onStreamError(handleStreamError);
    window.electronAPI.onPersonaStreamChunk(handlePersonaStreamChunk);
    window.electronAPI.onPersonaStreamEnd(handlePersonaStreamEnd);
    window.electronAPI.onPersonaStreamError(handlePersonaStreamError);
    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeStreamListeners();
    });
    updateSendButtonState();
}
document.addEventListener('DOMContentLoaded', init);
