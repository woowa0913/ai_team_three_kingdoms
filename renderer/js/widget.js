const statusBadgeByAgentId = new Map();

/* "제갈량 (오케스트레이터)" → { display: "제갈량", role: "오케스트레이터" } */
function parseAgentName(fullName) {
    const match = fullName.match(/^(.+?)\s*[(\(](.+?)[)\)]$/);
    if (match) {
        return { display: match[1].trim(), role: match[2].trim() };
    }
    return { display: fullName, role: '' };
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

    const leftButton = document.createElement('button');
    leftButton.type = 'button';
    leftButton.className = 'reorder-btn';
    leftButton.textContent = '❮';
    leftButton.title = `${agent.name} 왼쪽으로`;

    const rightButton = document.createElement('button');
    rightButton.type = 'button';
    rightButton.className = 'reorder-btn';
    rightButton.textContent = '❯';
    rightButton.title = `${agent.name} 오른쪽으로`;

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

    agentIcon.appendChild(iconNode);
    agentIcon.appendChild(badgeSpan);

    const agentInfo = document.createElement('div');
    agentInfo.className = 'agent-info';

    const { display, role } = parseAgentName(agent.name);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'agent-name';
    nameDiv.textContent = display;

    const roleDiv = document.createElement('div');
    roleDiv.className = 'agent-role';
    roleDiv.textContent = role || (agent.expertise ? agent.expertise.split(',')[0].trim() : '');

    const reorderControls = createReorderControls(agent);

    agentInfo.appendChild(nameDiv);
    if (roleDiv.textContent) {
        agentInfo.appendChild(roleDiv);
    }
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

function buildTentItem() {
    const wrapper = document.createElement('div');
    wrapper.className = 'agent-item tent-item';

    const icon = document.createElement('div');
    icon.className = 'agent-icon';
    icon.title = '본진 (회의실)';

    const image = document.createElement('img');
    image.className = 'agent-img';
    image.src = 'assets/fortress.png';
    image.alt = '본진';
    icon.appendChild(image);

    const info = document.createElement('div');
    info.className = 'agent-info';

    const name = document.createElement('div');
    name.className = 'agent-name';
    name.textContent = '본진';

    info.appendChild(name);
    wrapper.appendChild(icon);
    wrapper.appendChild(info);

    wrapper.addEventListener('click', () => {
        window.electronAPI.openMeetingRoom?.();
    });

    return wrapper;
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
        agentListEl.appendChild(buildTentItem());
    } catch (error) {
        console.error('Failed to load agents:', error);
        agentListEl.innerHTML = '<div class="error">Load Error</div>';
    }
}

function bindActions() {
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

function bindMousePassthrough() {
    const container = document.querySelector('.widget-container');
    if (!container || !window.electronAPI?.setIgnoreMouseEvents) {
        return;
    }
    /* 콘텐츠 위에 마우스 → 클릭 활성화, 벗어나면 → 클릭 투과 */
    container.addEventListener('mouseenter', () => {
        window.electronAPI.setIgnoreMouseEvents(false);
    });
    container.addEventListener('mouseleave', () => {
        window.electronAPI.setIgnoreMouseEvents(true);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    bindActions();
    bindMousePassthrough();
    await renderAgents();
    bindRealtimeListeners();
});
