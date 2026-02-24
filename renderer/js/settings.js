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
    const buttons = document.querySelectorAll('.btn-toggle-visibility');
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const provider = button.closest('[data-provider]')?.getAttribute('data-provider');
            if (!provider) {
                return;
            }

            const input = getProviderInput(provider);
            if (!input) {
                return;
            }

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(isPassword));
            button.textContent = isPassword ? '🙈' : '👁️';
        });
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
    loadMaskedApiKeys();
}

document.addEventListener('DOMContentLoaded', init);
