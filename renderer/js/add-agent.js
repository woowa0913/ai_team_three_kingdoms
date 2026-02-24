function $(id) {
    return document.getElementById(id);
}

const DEFAULT_MODEL_PLACEHOLDER = '예: claude-3-7-sonnet-20250219';
const OLLAMA_EMPTY_PLACEHOLDER = 'ollama pull로 모델을 먼저 받아주세요';

const formState = {
    mode: 'create',
    agentId: '',
    modelFetchSeq: 0,
};

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

function getModelInput() {
    return $('agent-model');
}

function getModelSelect() {
    return $('agent-model-select');
}

function readCurrentModelValue() {
    const modelInput = getModelInput();
    const modelSelect = getModelSelect();

    if (modelSelect && !modelSelect.hidden && modelSelect.value.trim()) {
        return modelSelect.value.trim();
    }
    return modelInput?.value.trim() || '';
}

function setModelFieldMode(mode, models = [], preferredModel = '') {
    const modelInput = getModelInput();
    const modelSelect = getModelSelect();
    if (!modelInput || !modelSelect) {
        return;
    }

    if (mode === 'select') {
        const list = Array.from(new Set(models.filter((model) => typeof model === 'string' && model.trim())))
            .map((model) => model.trim());

        modelSelect.innerHTML = '';
        list.forEach((model) => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });

        if (list.length > 0) {
            const selected = list.includes(preferredModel) ? preferredModel : list[0];
            modelSelect.value = selected;
            modelInput.value = selected;
        }

        modelInput.hidden = true;
        modelInput.disabled = true;
        modelSelect.hidden = false;
        modelSelect.disabled = false;
        return;
    }

    modelInput.hidden = false;
    modelInput.disabled = false;
    modelSelect.hidden = true;
    modelSelect.disabled = true;

    if (preferredModel) {
        modelInput.value = preferredModel;
    }
}

function getFormData() {
    return {
        name: $('agent-name')?.value.trim() || '',
        emoji: $('agent-emoji')?.value.trim() || '🤖',
        provider: $('agent-provider')?.value || 'anthropic',
        model: readCurrentModelValue(),
        persona: $('agent-persona')?.value.trim() || '',
        expertise: $('agent-expertise')?.value.trim() || '',
    };
}

function applyModeUI() {
    const isEditMode = formState.mode === 'edit';
    const titleEl = $('modal-title');
    const submitButton = $('btn-submit');
    const providerField = $('agent-provider');
    const personaField = $('agent-persona');

    if (titleEl) {
        titleEl.textContent = isEditMode ? '에이전트 수정' : '새 에이전트 추가';
    }
    if (submitButton) {
        submitButton.textContent = isEditMode ? '저장하기' : '추가하기';
    }
    if (providerField) {
        providerField.disabled = isEditMode;
    }
    if (personaField) {
        personaField.disabled = isEditMode;
        if (isEditMode) {
            personaField.placeholder = '페르소나는 대시보드에서 수정할 수 있습니다.';
        }
    }
    document.title = isEditMode ? '에이전트 수정' : '새 에이전트 추가';
}

function fillForm(agent) {
    $('agent-name').value = agent?.name || '';
    $('agent-emoji').value = agent?.emoji || '🤖';
    $('agent-provider').value = agent?.provider || 'anthropic';
    $('agent-model').value = agent?.model || '';
    $('agent-persona').value = agent?.persona || '';
    $('agent-expertise').value = agent?.expertise || '';
}

async function syncModelFieldForProvider(preferredModel = '') {
    const provider = $('agent-provider')?.value || 'anthropic';
    const modelInput = getModelInput();
    if (!modelInput) {
        return;
    }

    if (provider !== 'ollama') {
        modelInput.placeholder = DEFAULT_MODEL_PLACEHOLDER;
        setModelFieldMode('input', [], preferredModel || readCurrentModelValue());
        return;
    }

    const requestId = ++formState.modelFetchSeq;
    let models = [];
    if (window.electronAPI?.getOllamaModels) {
        try {
            models = await window.electronAPI.getOllamaModels();
        } catch (error) {
            models = [];
        }
    }

    if (requestId !== formState.modelFetchSeq) {
        return;
    }

    const validModels = Array.isArray(models)
        ? models.filter((model) => typeof model === 'string' && model.trim())
        : [];

    if (validModels.length > 0) {
        setModelFieldMode('select', validModels, preferredModel || readCurrentModelValue());
        return;
    }

    modelInput.placeholder = OLLAMA_EMPTY_PLACEHOLDER;
    setModelFieldMode('input', [], preferredModel || readCurrentModelValue());
}

async function initializeMode() {
    const params = new URLSearchParams(window.location.search);
    const agentId = (params.get('agentId') || '').trim();
    if (!agentId) {
        applyModeUI();
        await syncModelFieldForProvider();
        return;
    }

    if (!window.electronAPI?.getAgent) {
        throw new Error('앱 API를 찾을 수 없습니다.');
    }

    const agent = await window.electronAPI.getAgent(agentId);
    if (!agent) {
        throw new Error('수정할 에이전트를 찾을 수 없습니다.');
    }

    formState.mode = 'edit';
    formState.agentId = agentId;
    fillForm(agent);
    applyModeUI();
    await syncModelFieldForProvider(agent.model || '');
}

async function submitAgent() {
    if (!window.electronAPI) {
        showToast('앱 API를 찾을 수 없습니다.');
        return;
    }

    const payload = getFormData();
    if (!payload.name || !payload.model) {
        showToast('이름과 모델은 필수입니다.');
        return;
    }

    try {
        const result = formState.mode === 'edit'
            ? await window.electronAPI.updateAgent(formState.agentId, {
                name: payload.name,
                emoji: payload.emoji,
                model: payload.model,
                expertise: payload.expertise,
            })
            : await window.electronAPI.addAgent(payload);

        if (!result?.ok) {
            throw new Error(result?.error || (formState.mode === 'edit' ? '에이전트 수정 실패' : '에이전트 추가 실패'));
        }
        window.close();
    } catch (error) {
        console.error('에이전트 저장 실패:', error);
        showToast(error.message || '에이전트 저장 실패');
    }
}

function bindEvents() {
    $('btn-close')?.addEventListener('click', () => window.close());
    $('btn-cancel')?.addEventListener('click', () => window.close());
    $('btn-submit')?.addEventListener('click', submitAgent);

    $('agent-provider')?.addEventListener('change', () => {
        syncModelFieldForProvider().catch(() => {
            showToast('모델 목록을 불러오지 못했습니다.');
        });
    });

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

document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    try {
        await initializeMode();
    } catch (error) {
        console.error('에이전트 폼 초기화 실패:', error);
        showToast(error.message || '폼 초기화 실패');
    }
});
