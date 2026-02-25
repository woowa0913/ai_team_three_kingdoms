function createDashboardPersonaController({ state, showToast }) {
    const personaEditState = {
        aiSuggestion: '',
    };
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

    function setPersonaEditMode(isEditing) {
        const readonly = document.getElementById('persona-readonly');
        const editEl = document.getElementById('persona-edit');
        const btnEdit = document.getElementById('btn-edit-persona');
        if (!readonly || !editEl || !btnEdit) {
            return;
        }

        if (isEditing) {
            const textarea = document.getElementById('persona-textarea');
            if (textarea) {
                textarea.value = (state.agent && state.agent.persona) ? state.agent.persona : '';
            }
            readonly.hidden = true;
            editEl.hidden = false;
            btnEdit.textContent = '읽기 모드';
            return;
        }

        const aiPanel = document.getElementById('ai-help-panel');
        if (aiPanel) {
            aiPanel.hidden = true;
        }
        readonly.hidden = false;
        editEl.hidden = true;
        btnEdit.textContent = '✏️ 편집';
    }

    function setPersonaAiStreaming(isStreaming) {
        const sendBtn = document.getElementById('btn-ai-send');
        if (sendBtn) {
            sendBtn.disabled = isStreaming;
        }
    }

    function resetPersonaSuggestion() {
        personaEditState.aiSuggestion = '';
        const responseEl = document.getElementById('ai-help-response');
        const applyBtn = document.getElementById('btn-apply-suggestion');
        if (responseEl) {
            responseEl.textContent = '';
        }
        if (applyBtn) {
            applyBtn.disabled = true;
        }
    }

    async function savePersona() {
        const textarea = document.getElementById('persona-textarea');
        if (!textarea || !state.agentId) {
            return;
        }
        const newPersona = textarea.value.trim();
        if (!newPersona) {
            showToast('페르소나 내용을 입력해주세요.');
            return;
        }

        try {
            const result = await window.electronAPI.updateAgentPersona(state.agentId, newPersona);
            if (!result?.ok) {
                throw new Error(result?.error || '저장 실패');
            }
            if (state.agent) {
                state.agent.persona = newPersona;
            }
            const descEl = document.getElementById('persona-desc');
            if (descEl) {
                descEl.textContent = newPersona;
            }
            setPersonaEditMode(false);
            showToast('페르소나를 저장했습니다.');
        } catch (error) {
            showToast(error.message || '페르소나 저장에 실패했습니다.');
        }
    }

    function handlePersonaStreamChunk(data) {
        const chunk = typeof data?.chunk === 'string' ? data.chunk : '';
        if (!chunk) {
            return;
        }
        const responseEl = document.getElementById('ai-help-response');
        if (responseEl) {
            if (!personaEditState.aiSuggestion) {
                responseEl.textContent = '';
            }
            personaEditState.aiSuggestion += chunk;
            responseEl.textContent = personaEditState.aiSuggestion;
            responseEl.scrollTop = responseEl.scrollHeight;
        }
    }

    function handlePersonaStreamEnd() {
        setPersonaAiStreaming(false);
        const applyBtn = document.getElementById('btn-apply-suggestion');
        if (applyBtn) {
            applyBtn.disabled = !personaEditState.aiSuggestion;
        }
    }

    function handlePersonaStreamError(data) {
        setPersonaAiStreaming(false);
        showToast(data?.message || 'AI 개선 중 오류가 발생했습니다.');
    }

    async function requestAiImprovePersona() {
        const input = document.getElementById('ai-help-input');
        const responseEl = document.getElementById('ai-help-response');
        if (!input || !state.agentId) {
            return;
        }

        const instruction = input.value.trim();
        if (!instruction) {
            showToast('제갈량에게 전달할 지시를 입력해주세요.');
            return;
        }

        resetPersonaSuggestion();
        if (responseEl) {
            responseEl.textContent = '제갈량이 검토 중입니다...';
        }
        setPersonaAiStreaming(true);

        try {
            await window.electronAPI.aiImprovePersona(state.agentId, instruction);
        } catch (error) {
            if (responseEl) {
                responseEl.textContent = '';
            }
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
            if (!panel) {
                return;
            }
            panel.hidden = !panel.hidden;
            if (!panel.hidden) {
                document.getElementById('ai-help-input')?.focus();
            }
        });

        document.getElementById('btn-close-ai-help')?.addEventListener('click', () => {
            const panel = document.getElementById('ai-help-panel');
            if (panel) {
                panel.hidden = true;
            }
        });

        const aiInput = document.getElementById('ai-help-input');
        const btnAiSend = document.getElementById('btn-ai-send');

        aiInput?.addEventListener('input', () => {
            if (btnAiSend) {
                btnAiSend.disabled = !aiInput.value.trim();
            }
        });

        aiInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                requestAiImprovePersona();
            }
        });

        btnAiSend?.addEventListener('click', requestAiImprovePersona);

        document.getElementById('btn-apply-suggestion')?.addEventListener('click', () => {
            if (!personaEditState.aiSuggestion) {
                return;
            }
            const textarea = document.getElementById('persona-textarea');
            if (textarea) {
                textarea.value = personaEditState.aiSuggestion;
            }
            const panel = document.getElementById('ai-help-panel');
            if (panel) {
                panel.hidden = true;
            }
            showToast('제안이 적용됐습니다. 저장 버튼으로 확정하세요.');
        });
    }

    return {
        bindAgentSwitcher,
        bindPersonaEditor,
        setPersonaEditMode,
        setPersonaAiStreaming,
        resetPersonaSuggestion,
        handlePersonaStreamChunk,
        handlePersonaStreamEnd,
        handlePersonaStreamError,
    };
}
window.createDashboardPersonaController = createDashboardPersonaController;
