function getProviderInput(provider) {
    return document.querySelector(`[data-provider="${provider}"] .api-key-input`);
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
