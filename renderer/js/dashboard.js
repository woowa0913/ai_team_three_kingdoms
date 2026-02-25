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

async function loadAgentMeta(agentId) {
    const agent = await window.electronAPI.getAgent(agentId);
    if (!agent) {
        throw new Error('에이전트 정보를 찾을 수 없습니다.');
    }

    state.agent = agent;
    document.title = agent.name || 'AI Orchestra Dashboard';

    const agentName = ui.agentName();
    const agentEmoji = ui.agentEmoji();
    const agentModel = ui.agentModel();
    const agentIntro = ui.agentIntro();

    /* "제갈량 (오케스트레이터)" → "제갈량" + "오케스트레이터" 분리 */
    const nameParts = (agent.name || '').match(/^(.+?)\s*[(\(](.+?)[)\)]$/);
    const displayName = nameParts ? nameParts[1].trim() : (agent.name || '');
    const roleLabel = nameParts ? nameParts[2].trim() : '';

    if (agentName) {
        agentName.textContent = displayName;
        const wrap = agentName.closest('.agent-switcher');
        if (wrap && roleLabel && !wrap.parentElement.querySelector('.agent-role-label')) {
            const roleEl = document.createElement('div');
            roleEl.className = 'agent-role-label';
            roleEl.textContent = roleLabel;
            wrap.after(roleEl);
        }
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

    const personaName = document.getElementById('persona-name');
    const personaDesc = document.getElementById('persona-desc');
    const personaTextarea = document.getElementById('persona-textarea');
    const expertiseText = document.getElementById('expertise-text');

    if (personaName) {
        personaName.textContent = agent.name || '';
    }
    if (personaDesc) {
        personaDesc.textContent = agent.persona || '';
    }
    if (personaTextarea) {
        personaTextarea.value = agent.persona || '';
    }
    if (expertiseText) {
        expertiseText.textContent = agent.expertise || '';
    }

    if (window.electronAPI.loadApiKeys) {
        const keys = await window.electronAPI.loadApiKeys();
        const warning = document.getElementById('api-key-warning');
        if (warning && agent) {
            const providerKey = keys[agent.provider] || '';
            const hasKey = providerKey.length > 0 && providerKey !== '****';
            warning.style.display = hasKey ? 'none' : 'flex';
            const button = warning.querySelector('.btn-open-settings');
            if (button) {
                button.addEventListener('click', () => window.electronAPI.openSettings());
            }
        }
    }
}

function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((item) => item.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            const content = document.getElementById(`tab-${button.dataset.tab}`);
            if (content) {
                content.classList.add('active');
            }
        });
    });
}

function bindOpacitySlider(chat) {
    const slider = document.getElementById('opacity-slider');
    if (!slider || typeof window.electronAPI?.setWindowOpacity !== 'function') {
        return;
    }

    slider.addEventListener('input', async () => {
        const ratio = Number(slider.value) / 100;
        const opacity = Math.min(1, Math.max(0.2, ratio));
        try {
            await window.electronAPI.setWindowOpacity(opacity);
        } catch (error) {
            console.error('투명도 설정 실패:', error);
            chat.showToast(error.message || '투명도 설정에 실패했습니다.');
        }
    });
}

async function init() {
    if (!window.electronAPI) {
        console.error('electronAPI가 로드되지 않았습니다.');
        return;
    }

    const chat = window.createDashboardChatController?.({ state, ui });
    if (!chat) {
        console.error('dashboard chat controller 초기화 실패');
        return;
    }
    const persona = window.createDashboardPersonaController?.({ state, showToast: chat.showToast });
    if (!persona) {
        console.error('dashboard persona controller 초기화 실패');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    state.agentId = params.get('agentId');
    if (!state.agentId) {
        chat.showToast('agentId가 없습니다.');
        return;
    }

    try {
        await loadAgentMeta(state.agentId);
        await chat.loadChatHistory(state.agentId);
        await persona.bindAgentSwitcher(state.agentId);
    } catch (error) {
        chat.showToast(error.message || '초기화에 실패했습니다.');
    }

    bindTabs();
    bindOpacitySlider(chat);
    persona.bindPersonaEditor();
    persona.setPersonaEditMode(false);
    persona.setPersonaAiStreaming(false);
    persona.resetPersonaSuggestion();

    const messageInput = ui.messageInput();
    const sendButton = ui.sendButton();
    const clearButton = ui.clearButton();
    const exportButton = document.querySelector('.btn-export');
    const closeButton = ui.closeButton();
    const settingsButton = document.getElementById('btn-settings-header');
    const addAgentButton = document.getElementById('btn-add-agent-header');
    const deleteAgentButton = document.getElementById('btn-delete-agent-header');

    if (messageInput) {
        messageInput.addEventListener('input', chat.updateSendButtonState);
        messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                chat.submitMessage();
            }
        });
    }
    if (sendButton) {
        sendButton.addEventListener('click', chat.submitMessage);
    }
    if (clearButton) {
        clearButton.addEventListener('click', chat.clearHistory);
    }
    if (exportButton) {
        exportButton.addEventListener('click', chat.exportChat);
    }
    if (closeButton) {
        closeButton.addEventListener('click', () => window.close());
    }
    if (settingsButton) {
        settingsButton.addEventListener('click', () => window.electronAPI.openSettings());
    }
    if (addAgentButton) {
        addAgentButton.addEventListener('click', () => window.electronAPI.openAddAgent());
    }
    if (deleteAgentButton && state.agentId !== 'agent-1') {
        deleteAgentButton.hidden = false;
        deleteAgentButton.addEventListener('click', async () => {
            const name = state.agent?.name || state.agentId;
            if (!window.confirm(`${name} 에이전트를 삭제할까요?`)) {
                return;
            }
            try {
                const result = await window.electronAPI.deleteAgent(state.agentId);
                if (!result?.ok) {
                    throw new Error(result?.error || '삭제 실패');
                }
                window.close();
            } catch (error) {
                chat.showToast(error.message || '에이전트 삭제에 실패했습니다.');
            }
        });
    }

    window.electronAPI.onStreamChunk(chat.handleStreamChunk);
    window.electronAPI.onStreamEnd(chat.handleStreamEnd);
    window.electronAPI.onStreamError(chat.handleStreamError);
    window.electronAPI.onPersonaStreamChunk(persona.handlePersonaStreamChunk);
    window.electronAPI.onPersonaStreamEnd(persona.handlePersonaStreamEnd);
    window.electronAPI.onPersonaStreamError(persona.handlePersonaStreamError);
    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeStreamListeners();
    });

    chat.updateSendButtonState();
}

document.addEventListener('DOMContentLoaded', init);
