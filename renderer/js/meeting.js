const meetingState = {
    agents: [],
    streamingItemEl: null,
    streamingContentEl: null,
    running: false,
};

function find(selector) {
    return document.querySelector(selector);
}

function showToast(message) {
    let toast = find('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.position = 'fixed';
        toast.style.left = '50%';
        toast.style.bottom = '24px';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(0, 0, 0, 0.82)';
        toast.style.color = '#fff';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = '8px';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.2s ease';
        toast.style.zIndex = '9999';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    window.setTimeout(() => {
        toast.style.opacity = '0';
    }, 1800);
}

function setRunning(isRunning) {
    meetingState.running = isRunning;
    const startButton = find('.btn-start-meeting');
    const stopButton = find('.btn-stop-meeting');
    const statusBadge = find('.meeting-status-badge');

    if (startButton) {
        startButton.disabled = isRunning;
    }
    if (stopButton) {
        stopButton.disabled = !isRunning;
    }
    if (statusBadge) {
        statusBadge.textContent = isRunning ? '🔴 회의 진행 중' : '⚫ 대기 중';
    }
}

function selectedParticipantIds() {
    const checkboxes = document.querySelectorAll('.participant-list input[type="checkbox"][data-agent-id]');
    return Array.from(checkboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.getAttribute('data-agent-id'))
        .filter(Boolean);
}

function clearSpeechPlaceholder() {
    const emptyState = find('.empty-state');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

function syncEmptyStateVisibility() {
    const emptyState = find('.empty-state');
    const log = find('.speech-log');
    if (!emptyState || !log) {
        return;
    }

    const hasItems = log.querySelector('.speech-item');
    emptyState.style.display = hasItems ? 'none' : 'block';
}

function findAgent(agentId) {
    return meetingState.agents.find((agent) => agent.id === agentId) || null;
}

function appendSpeechItem(agentId, agentName, round, initialContent, streaming) {
    const log = find('.speech-log');
    if (!log) {
        return { item: null, content: null };
    }

    clearSpeechPlaceholder();
    const agent = findAgent(agentId);
    const title = `${agent?.emoji || '🤖'} ${agentName || agent?.name || '알 수 없는 화자'} · ${round}라운드`;

    const item = document.createElement('article');
    item.className = 'speech-item';
    if (streaming) {
        item.classList.add('streaming');
    }

    const header = document.createElement('div');
    header.className = 'speech-meta';
    header.textContent = title;

    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';

    const content = document.createElement('div');
    content.className = 'speech-content';
    content.textContent = initialContent || '';

    bubble.appendChild(content);
    item.appendChild(header);
    item.appendChild(bubble);
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;

    return { item, content };
}

function renderParticipants() {
    const list = find('.participant-list');
    if (!list) {
        return;
    }

    list.innerHTML = '';
    meetingState.agents.forEach((agent, index) => {
        const label = document.createElement('label');
        label.className = 'participant-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('data-agent-id', agent.id);
        checkbox.checked = index < 3;

        const text = document.createElement('span');
        text.textContent = `${agent.emoji || '🤖'} ${agent.name}`;

        label.appendChild(checkbox);
        label.appendChild(text);
        list.appendChild(label);
    });
}

async function loadAgents() {
    try {
        const agents = await window.electronAPI.getAgents();
        meetingState.agents = Array.isArray(agents) ? agents : [];
        renderParticipants();
    } catch (error) {
        console.error('회의 참여자 로드 실패:', error);
        showToast('에이전트 목록 로드 실패');
    }
}

function handleSpeakerStart(data) {
    const round = data?.round || 1;
    const agentId = data?.agentId || '';
    const agentName = data?.agentName || '알 수 없는 화자';
    const inserted = appendSpeechItem(agentId, agentName, round, '', true);
    meetingState.streamingItemEl = inserted.item;
    meetingState.streamingContentEl = inserted.content;
}

function handleMeetingChunk(data) {
    const chunk = typeof data?.chunk === 'string' ? data.chunk : '';
    if (!chunk || !meetingState.streamingContentEl) {
        return;
    }

    meetingState.streamingContentEl.textContent += chunk;
    const log = find('.speech-log');
    if (log) {
        log.scrollTop = log.scrollHeight;
    }
}

function handleSpeakerEnd(data) {
    if (!meetingState.streamingItemEl || !meetingState.streamingContentEl) {
        const inserted = appendSpeechItem(data?.agentId, '', 1, data?.content || '', false);
        meetingState.streamingItemEl = inserted.item;
        meetingState.streamingContentEl = inserted.content;
    } else if ((meetingState.streamingContentEl.textContent || '').trim() === '' && data?.content) {
        meetingState.streamingContentEl.textContent = data.content;
    }

    if (meetingState.streamingItemEl) {
        meetingState.streamingItemEl.classList.remove('streaming');
    }
    meetingState.streamingItemEl = null;
    meetingState.streamingContentEl = null;
}

function handleMeetingEnded() {
    if (meetingState.streamingItemEl) {
        meetingState.streamingItemEl.classList.remove('streaming');
    }
    meetingState.streamingItemEl = null;
    meetingState.streamingContentEl = null;
    setRunning(false);
    syncEmptyStateVisibility();
    showToast('회의 종료');
}

async function startMeeting() {
    const topicInput = find('.meeting-topic-input');
    const roundInput = find('.round-input');

    const topic = topicInput ? topicInput.value.trim() : '';
    const participantIds = selectedParticipantIds();
    const maxRounds = roundInput ? Number.parseInt(roundInput.value, 10) || 3 : 3;

    if (!topic) {
        showToast('회의 주제를 입력해주세요.');
        return;
    }
    if (participantIds.length < 2) {
        showToast('참여자는 최소 2명 이상 선택해주세요.');
        return;
    }

    setRunning(true);
    try {
        const result = await window.electronAPI.startMeeting(topic, participantIds, maxRounds);
        if (!result?.ok) {
            throw new Error(result?.error || '회의 시작 실패');
        }
    } catch (error) {
        console.error('회의 시작 실패:', error);
        setRunning(false);
        showToast(error.message || '회의 시작 실패');
    }
}

async function stopMeeting() {
    try {
        await window.electronAPI.stopMeeting();
        showToast('중단 요청 완료');
    } catch (error) {
        console.error('회의 중단 실패:', error);
        showToast(error.message || '회의 중단 실패');
    }
}

function bindEvents() {
    const startButton = find('.btn-start-meeting');
    const stopButton = find('.btn-stop-meeting');
    const closeButton = find('.btn-close');

    if (startButton) {
        startButton.addEventListener('click', startMeeting);
    }
    if (stopButton) {
        stopButton.addEventListener('click', stopMeeting);
    }
    if (closeButton) {
        closeButton.addEventListener('click', () => window.close());
    }
}

async function init() {
    if (!window.electronAPI) {
        console.error('electronAPI가 로드되지 않았습니다.');
        return;
    }

    bindEvents();
    await loadAgents();

    window.electronAPI.onMeetingSpeakerStart(handleSpeakerStart);
    window.electronAPI.onMeetingChunk(handleMeetingChunk);
    window.electronAPI.onMeetingSpeakerEnd(handleSpeakerEnd);
    window.electronAPI.onMeetingEnded(handleMeetingEnded);
    setRunning(false);
    syncEmptyStateVisibility();

    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeMeetingListeners();
    });
}

document.addEventListener('DOMContentLoaded', init);
