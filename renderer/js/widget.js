const statusBadgeByAgentId = new Map();

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

async function reorderAgent(agentId, direction) {
    try {
        const result = await window.electronAPI.reorderAgent?.(agentId, direction);
        if (!result?.ok) {
            throw new Error(result?.error || '순서 변경 실패');
        }
    } catch (error) {
        console.error('에이전트 순서 변경 실패:', error);
        window.alert(error.message || '에이전트 순서 변경에 실패했습니다.');
    }
}

function createReorderControls(agent) {
    const controls = document.createElement('div');
    controls.className = 'reorder-controls';
    controls.style.display = 'none';
    controls.style.marginTop = '4px';
    controls.style.gap = '4px';

    const leftButton = document.createElement('button');
    leftButton.type = 'button';
    leftButton.className = 'reorder-btn reorder-left';
    leftButton.textContent = '◀';
    leftButton.title = `${agent.name} 왼쪽으로 이동`;
    leftButton.style.fontSize = '10px';
    leftButton.style.padding = '1px 4px';
    leftButton.style.cursor = 'pointer';

    const rightButton = document.createElement('button');
    rightButton.type = 'button';
    rightButton.className = 'reorder-btn reorder-right';
    rightButton.textContent = '▶';
    rightButton.title = `${agent.name} 오른쪽으로 이동`;
    rightButton.style.fontSize = '10px';
    rightButton.style.padding = '1px 4px';
    rightButton.style.cursor = 'pointer';

    leftButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        reorderAgent(agent.id, 'left');
    });
    rightButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        reorderAgent(agent.id, 'right');
    });

    controls.appendChild(leftButton);
    controls.appendChild(rightButton);
    return controls;
}

function setAgentBadgeStatus(agentId, isActive) {
    const badgeEl = statusBadgeByAgentId.get(agentId);
    if (!badgeEl) {
        return;
    }
    badgeEl.textContent = isActive ? '🟢 업무 중' : '⚫ 대기 중';
    badgeEl.classList.toggle('active', isActive);
}

function buildAgentItem(agent) {
    const agentWrapper = document.createElement('div');
    agentWrapper.className = 'agent-item';

    const agentIcon = document.createElement('div');
    agentIcon.className = 'agent-icon';
    agentIcon.title = agent.name;

    const iconNode = agent.image
        ? (() => {
            const image = document.createElement('img');
            image.className = 'agent-img';
            image.src = agent.image;
            image.alt = agent.name || 'agent';
            return image;
        })()
        : (() => {
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'emoji';
            emojiSpan.textContent = agent.emoji || '🤖';
            return emojiSpan;
        })();

    const badgeSpan = document.createElement('div');
    badgeSpan.className = 'status-badge';
    badgeSpan.textContent = '⚫ 대기 중';
    statusBadgeByAgentId.set(agent.id, badgeSpan);

    const deleteBtn = createDeleteButton(agent);
    if (deleteBtn) {
        agentIcon.appendChild(deleteBtn);
    }
    agentIcon.appendChild(iconNode);
    agentIcon.appendChild(badgeSpan);

    const agentInfo = document.createElement('div');
    agentInfo.className = 'agent-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'agent-name';
    nameDiv.textContent = agent.name;

    const roleDiv = document.createElement('div');
    roleDiv.className = 'agent-role';
    roleDiv.textContent = agent.expertise ? agent.expertise.split(',')[0].trim() : '에이전트';

    const reorderControls = createReorderControls(agent);

    agentInfo.appendChild(nameDiv);
    agentInfo.appendChild(roleDiv);
    agentInfo.appendChild(reorderControls);
    agentWrapper.appendChild(agentIcon);
    agentWrapper.appendChild(agentInfo);

    agentWrapper.addEventListener('click', () => {
        setAgentBadgeStatus(agent.id, true);
        window.electronAPI.openDashboard(agent.id);
    });

    agentWrapper.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.electronAPI.openAddAgent?.(agent.id);
    });

    agentWrapper.addEventListener('mouseenter', () => {
        reorderControls.style.display = 'flex';
    });
    agentWrapper.addEventListener('mouseleave', () => {
        reorderControls.style.display = 'none';
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
        statusBadgeByAgentId.clear();
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

function bindRealtimeListeners() {
    if (window.electronAPI?.onAgentsUpdated) {
        window.electronAPI.onAgentsUpdated(() => {
            renderAgents();
        });
    }
    if (window.electronAPI?.onDashboardClosed) {
        window.electronAPI.onDashboardClosed((payload) => {
            setAgentBadgeStatus(payload?.agentId, false);
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    bindActions();
    await renderAgents();
    bindRealtimeListeners();
});
