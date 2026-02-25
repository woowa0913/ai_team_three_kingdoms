const testStatusTimers = new Map();
function getProviderCard(provider) {
    return document.querySelector(`[data-provider="${provider}"]`);
}
function getProviderInput(provider) {
    return document.querySelector(`[data-provider="${provider}"] .api-key-input`);
}
function getTestButton(provider) {
    return document.querySelector(`[data-provider="${provider}"] .btn-test-api`);
}
function getStatusBadge(provider) {
    return document.querySelector(`[data-provider="${provider}"] .test-status`);
}
function getAgentKeyInputs() {
    return document.querySelectorAll('.agent-api-key-input[data-agent-id]');
}
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.position = 'fixed';
        toast.style.left = '50%';
        toast.style.bottom = '24px';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '10px 16px';
        toast.style.borderRadius = '8px';
        toast.style.background = 'rgba(0, 0, 0, 0.8)';
        toast.style.color = '#fff';
        toast.style.fontSize = '13px';
        toast.style.zIndex = '9999';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.2s ease';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    window.setTimeout(() => {
        toast.style.opacity = '0';
    }, 1500);
}
function isMaskedValue(value) {
    if (!value) {
        return false;
    }
    return /(\*{4,})/.test(value);
}
function setProviderTestStatus(provider, ok, message) {
    const badge = getStatusBadge(provider);
    const card = getProviderCard(provider);
    if (!badge || !card) {
        return;
    }
    const previousTimer = testStatusTimers.get(provider);
    if (previousTimer) {
        window.clearTimeout(previousTimer);
    }
    badge.textContent = ok ? `✅ ${message || '연결 성공'}` : `❌ ${message || '연결 실패'}`;
    badge.style.marginLeft = '8px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '700';
    badge.style.color = ok ? '#22c55e' : '#ef4444';
    card.dataset.testStatus = ok ? 'ok' : 'error';
    const timerId = window.setTimeout(() => {
        badge.textContent = '';
        card.dataset.testStatus = '';
        testStatusTimers.delete(provider);
    }, 2000);
    testStatusTimers.set(provider, timerId);
}
function setActiveThemeButton(mode) {
    document.querySelectorAll('.theme-btn').forEach((button) => {
        const isActive = button.dataset.themeMode === mode;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}
async function bindThemeSelector() {
    if (!window.electronAPI?.getTheme || !window.electronAPI?.setTheme) {
        return;
    }
    try {
        const current = await window.electronAPI.getTheme();
        setActiveThemeButton(current?.saved || 'system');
    } catch (error) {
        console.error('현재 테마 로드 실패:', error);
    }
    document.querySelectorAll('.theme-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const mode = button.dataset.themeMode;
            if (!mode) {
                return;
            }
            try {
                const result = await window.electronAPI.setTheme(mode);
                if (!result?.ok) {
                    throw new Error(result?.error || '테마 적용 실패');
                }
                setActiveThemeButton(result.saved || mode);
            } catch (error) {
                showToast(error.message || '테마 변경 실패');
            }
        });
    });
    if (window.electronAPI.onSystemThemeChanged) {
        window.electronAPI.onSystemThemeChanged((payload) => {
            setActiveThemeButton(payload?.saved || 'system');
        });
    }
}
async function loadMaskedApiKeys() {
    try {
        const keys = await window.electronAPI.loadApiKeys();
        ['anthropic', 'openai', 'google'].forEach((provider) => {
            const input = getProviderInput(provider);
            if (!input) {
                return;
            }
            input.value = keys?.[provider] || '';
        });
    } catch (error) {
        console.error('API 키 로드 실패:', error);
        showToast('API 키를 불러오지 못했습니다.');
    }
}
async function renderAgentKeySection() {
    const container = document.getElementById('agent-key-list');
    if (!container || !window.electronAPI?.getAgents || !window.electronAPI?.loadAgentApiKeys) {
        return;
    }
    try {
        const [agents, agentKeyMap] = await Promise.all([
            window.electronAPI.getAgents(),
            window.electronAPI.loadAgentApiKeys(),
        ]);
        const rows = Array.isArray(agents) ? agents : [];
        container.innerHTML = '';
        rows.forEach((agent) => {
            const card = document.createElement('div');
            card.className = 'agent-card';
            card.dataset.agentId = agent.id;
            card.dataset.provider = agent.provider || '';
            const header = document.createElement('div');
            header.className = 'agent-header';
            const emoji = document.createElement('div');
            emoji.className = 'agent-emoji-bg';
            emoji.textContent = agent.emoji || '🤖';
            const info = document.createElement('div');
            info.className = 'agent-info';
            const name = document.createElement('div');
            name.className = 'agent-name';
            name.textContent = agent.name || '에이전트';
            const provider = document.createElement('div');
            provider.className = 'agent-provider-badge';
            provider.textContent = agent.provider || 'unknown';
            info.appendChild(name);
            info.appendChild(provider);
            header.appendChild(emoji);
            header.appendChild(info);
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            const input = document.createElement('input');
            input.type = 'password';
            input.className = 'api-key-input agent-api-key-input';
            input.setAttribute('data-agent-id', agent.id);
            input.placeholder = '캐릭터 전용 API 키 (선택)';
            input.value = agentKeyMap?.[agent.id] || '';
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'btn-toggle-visibility';
            toggle.title = '비밀번호 보이기';
            toggle.textContent = '👁️';
            inputGroup.appendChild(input);
            inputGroup.appendChild(toggle);
            card.appendChild(header);
            card.appendChild(inputGroup);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('캐릭터별 API 키 섹션 렌더 실패:', error);
        showToast('캐릭터별 API 키를 불러오지 못했습니다.');
    }
}
async function saveApiKeys() {
    const providers = ['anthropic', 'openai', 'google'];
    try {
        for (const provider of providers) {
            const input = getProviderInput(provider);
            if (!input) {
                continue;
            }
            const value = input.value.trim();
            if (!value || isMaskedValue(value)) {
                continue;
            }
            await window.electronAPI.saveApiKey(provider, value);
        }
        if (window.electronAPI?.saveAgentApiKey) {
            const agentKeyInputs = getAgentKeyInputs();
            for (const input of agentKeyInputs) {
                const agentId = input.getAttribute('data-agent-id');
                const value = input.value.trim();
                if (!agentId || isMaskedValue(value)) {
                    continue;
                }
                await window.electronAPI.saveAgentApiKey(agentId, value);
            }
        }
        showToast('저장 완료');
        window.setTimeout(() => window.close(), 400);
    } catch (error) {
        console.error('API 키 저장 실패:', error);
        showToast(error.message || '저장 중 오류가 발생했습니다.');
    }
}
async function saveProviderKeyIfNeeded(provider) {
    const input = getProviderInput(provider);
    if (!input) {
        return;
    }
    const value = input.value.trim();
    if (!value || isMaskedValue(value)) {
        return;
    }
    await window.electronAPI.saveApiKey(provider, value);
}
async function testProviderConnection(provider) {
    const button = getTestButton(provider);
    if (!button || !window.electronAPI?.testApiKey) {
        return;
    }
    button.disabled = true;
    const prevText = button.textContent;
    button.textContent = '테스트 중...';
    try {
        await saveProviderKeyIfNeeded(provider);
        const result = await window.electronAPI.testApiKey(provider);
        if (!result?.ok) {
            setProviderTestStatus(provider, false, result?.error || '연결 실패');
            return;
        }
        setProviderTestStatus(provider, true, '연결됨');
    } catch (error) {
        setProviderTestStatus(provider, false, error.message || '연결 실패');
    } finally {
        button.disabled = false;
        button.textContent = prevText;
    }
}
function bindToggleVisibility() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-toggle-visibility');
        if (!button) {
            return;
        }
        const input = button.closest('.input-group')?.querySelector('.api-key-input');
        if (!input) {
            return;
        }
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(isPassword));
        button.textContent = isPassword ? '🙈' : '👁️';
    });
}
function bindActions() {
    const saveButton = document.querySelector('.btn-save');
    const cancelButton = document.querySelector('.btn-cancel');
    if (saveButton) {
        saveButton.addEventListener('click', saveApiKeys);
    }
    if (cancelButton) {
        cancelButton.addEventListener('click', () => window.close());
    }
    ['anthropic', 'openai', 'google'].forEach((provider) => {
        const testButton = getTestButton(provider);
        if (!testButton) {
            return;
        }
        testButton.addEventListener('click', () => {
            testProviderConnection(provider).catch((error) => {
                showToast(error.message || '연결 테스트 실패');
            });
        });
    });
}
function init() {
    if (!window.electronAPI) {
        console.error('electronAPI가 로드되지 않았습니다.');
        return;
    }
    bindToggleVisibility();
    bindActions();
    bindThemeSelector();
    loadMaskedApiKeys();
    renderAgentKeySection();
}
document.addEventListener('DOMContentLoaded', init);
