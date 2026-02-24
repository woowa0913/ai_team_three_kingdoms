function createDeleteButton(agent) {
    if (agent.id === 'agent-1') {
        return null;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'delete-btn';
    button.title = `${agent.name} 삭제`;
    button.textContent = '×';

    button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const confirmed = window.confirm(`${agent.name} 에이전트를 삭제할까요?`);
        if (!confirmed) {
            return;
        }

        try {
            const result = await window.electronAPI.deleteAgent(agent.id);
            if (!result?.ok) {
                throw new Error(result?.error || '삭제 실패');
            }
            await renderAgents();
        } catch (error) {
            console.error('에이전트 삭제 실패:', error);
            window.alert(error.message || '에이전트 삭제에 실패했습니다.');
        }
    });

    return button;
}

function buildAgentItem(agent) {
    const agentWrapper = document.createElement('div');
    agentWrapper.className = 'agent-item';

    const agentIcon = document.createElement('div');
    agentIcon.className = 'agent-icon';
    agentIcon.title = agent.name;

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'emoji';
    emojiSpan.textContent = agent.emoji || '🤖';

    const badgeSpan = document.createElement('div');
    badgeSpan.className = 'status-badge';
    badgeSpan.textContent = '⚫ 대기 중';

    const deleteBtn = createDeleteButton(agent);
    if (deleteBtn) {
        agentIcon.appendChild(deleteBtn);
    }
    agentIcon.appendChild(emojiSpan);
    agentIcon.appendChild(badgeSpan);

    const agentInfo = document.createElement('div');
    agentInfo.className = 'agent-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'agent-name';
    nameDiv.textContent = agent.name;

    const roleDiv = document.createElement('div');
    roleDiv.className = 'agent-role';
    roleDiv.textContent = agent.expertise ? agent.expertise.split(',')[0].trim() : '에이전트';

    agentInfo.appendChild(nameDiv);
    agentInfo.appendChild(roleDiv);
    agentWrapper.appendChild(agentIcon);
    agentWrapper.appendChild(agentInfo);

    agentWrapper.addEventListener('click', () => {
        badgeSpan.textContent = '🟢 업무 중';
        badgeSpan.classList.add('active');
        window.electronAPI.openDashboard(agent.id);
    });

    return agentWrapper;
}

async function renderAgents() {
    const agentListEl = document.getElementById('agent-list');
    if (!agentListEl) {
        return;
    }

    try {
        const agents = await window.electronAPI.getAgents();
        agentListEl.innerHTML = '';
        agents.forEach((agent) => {
            agentListEl.appendChild(buildAgentItem(agent));
        });
    } catch (error) {
        console.error('Failed to load agents:', error);
        agentListEl.innerHTML = '<div class="error">Load Error</div>';
    }
}

function bindActions() {
    document.getElementById('btn-add-agent')?.addEventListener('click', () => {
        window.electronAPI.openAddAgent?.();
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        window.electronAPI.openSettings?.();
    });

    document.getElementById('btn-hide-widget')?.addEventListener('click', () => {
        window.electronAPI.hideWidget?.();
    });

    document.getElementById('btn-meeting')?.addEventListener('click', () => {
        window.electronAPI.openMeetingRoom?.();
    });

    document.getElementById('btn-quit')?.addEventListener('click', () => {
        window.electronAPI.quitApp?.();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    bindActions();
    await renderAgents();
    if (window.electronAPI?.onAgentsUpdated) {
        window.electronAPI.onAgentsUpdated(() => {
            renderAgents();
        });
    }
});
