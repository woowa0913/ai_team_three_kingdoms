function $(id) {
    return document.getElementById(id);
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.position = 'fixed';
        toast.style.left = '50%';
        toast.style.bottom = '16px';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(0, 0, 0, 0.82)';
        toast.style.color = '#fff';
        toast.style.padding = '8px 12px';
        toast.style.borderRadius = '8px';
        toast.style.fontSize = '12px';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.2s ease';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    window.setTimeout(() => {
        toast.style.opacity = '0';
    }, 1700);
}

function getFormData() {
    return {
        name: $('agent-name')?.value.trim() || '',
        emoji: $('agent-emoji')?.value.trim() || '🤖',
        provider: $('agent-provider')?.value || 'anthropic',
        model: $('agent-model')?.value.trim() || '',
        persona: $('agent-persona')?.value.trim() || '',
        expertise: $('agent-expertise')?.value.trim() || '',
    };
}

async function submitAgent() {
    if (!window.electronAPI?.addAgent) {
        showToast('앱 API를 찾을 수 없습니다.');
        return;
    }

    const payload = getFormData();
    if (!payload.name || !payload.model) {
        showToast('이름과 모델은 필수입니다.');
        return;
    }

    try {
        const result = await window.electronAPI.addAgent(payload);
        if (!result?.ok) {
            throw new Error(result?.error || '에이전트 추가 실패');
        }
        window.close();
    } catch (error) {
        console.error('에이전트 추가 실패:', error);
        showToast(error.message || '에이전트 추가 실패');
    }
}

function bindEvents() {
    $('btn-close')?.addEventListener('click', () => window.close());
    $('btn-cancel')?.addEventListener('click', () => window.close());
    $('btn-submit')?.addEventListener('click', submitAgent);

    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            submitAgent();
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            window.close();
        }
    });
}

document.addEventListener('DOMContentLoaded', bindEvents);
