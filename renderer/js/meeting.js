const meetingState = { agents: [], streamingItemEl: null, streamingContentEl: null, running: false, paused: false };
let speechController = null;

function find(selector) {
    return document.querySelector(selector);
}

function showToast(message) {
    let toast = find('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        Object.assign(toast.style, {
            position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.82)', color: '#fff', padding: '10px 14px',
            borderRadius: '8px', opacity: '0', transition: 'opacity 0.2s ease', zIndex: '9999',
        });
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    window.setTimeout(() => {
        toast.style.opacity = '0';
    }, 1800);
}

function findAgent(agentId) {
    return meetingState.agents.find((agent) => agent.id === agentId) || null;
}

function selectedParticipantIds() {
    const checkboxes = document.querySelectorAll('.participant-list input[type="checkbox"][data-agent-id]');
    return Array.from(checkboxes).filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.getAttribute('data-agent-id')).filter(Boolean);
}

function renderMeetingStatus() {
    const badge = find('.meeting-status-badge');
    if (!badge) return;
    if (meetingState.paused) {
        badge.textContent = '⏸ 일시정지';
        badge.classList.add('active', 'paused');
        return;
    }
    if (meetingState.running) {
        badge.textContent = '🔴 회의 진행 중';
        badge.classList.add('active');
        badge.classList.remove('paused');
        return;
    }
    badge.textContent = '⚫ 대기 중';
    badge.classList.remove('active', 'paused');
}

function updateUserInputActions() {
    const input = find('#meeting-user-input');
    const sendButton = find('.btn-send-user-message');
    const resumeButton = find('.btn-resume-meeting');
    const content = input ? input.value.trim() : '';
    if (sendButton) sendButton.disabled = !meetingState.paused || !content;
    if (resumeButton) resumeButton.disabled = !meetingState.paused;
}

function setPausePanelVisible(visible) {
    const panel = find('#meeting-user-input-panel');
    if (panel) panel.hidden = !visible;
    updateUserInputActions();
}

function updateControlButtons() {
    const startButton = find('.btn-start-meeting');
    const pauseButton = find('.btn-pause-meeting');
    const stopButton = find('.btn-stop-meeting');
    if (startButton) startButton.disabled = meetingState.running;
    if (pauseButton) pauseButton.disabled = !meetingState.running || meetingState.paused;
    if (stopButton) stopButton.disabled = !meetingState.running;
}

function setRunning(isRunning) {
    meetingState.running = isRunning;
    if (!isRunning) meetingState.paused = false;
    renderMeetingStatus();
    updateControlButtons();
    setPausePanelVisible(meetingState.paused);
}

function setPaused(isPaused) {
    meetingState.paused = Boolean(isPaused && meetingState.running);
    renderMeetingStatus();
    updateControlButtons();
    setPausePanelVisible(meetingState.paused);
}

function renderParticipants() {
    const list = find('.participant-list');
    if (!list) return;
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

async function startMeeting() {
    const topic = find('.meeting-topic-input')?.value.trim() || '';
    const participantIds = selectedParticipantIds();
    const maxRounds = Number.parseInt(find('.round-input')?.value || '3', 10) || 3;

    if (!topic) return showToast('회의 주제를 입력해주세요.');
    if (participantIds.length < 2) return showToast('참여자는 최소 2명 이상 선택해주세요.');

    speechController.resetSpeechLog();
    setRunning(true);
    try {
        const result = await window.electronAPI.startMeeting(topic, participantIds, maxRounds);
        if (!result?.ok) throw new Error(result?.error || '회의 시작 실패');
    } catch (error) {
        console.error('회의 시작 실패:', error);
        setRunning(false);
        showToast(error.message || '회의 시작 실패');
    }
}

async function stopMeeting() {
    try {
        const result = await window.electronAPI.stopMeeting();
        if (!result?.ok) throw new Error(result?.error || '회의 중단 실패');
        setRunning(false);
        showToast('중단 요청 완료');
    } catch (error) {
        console.error('회의 중단 실패:', error);
        showToast(error.message || '회의 중단 실패');
    }
}

async function pauseMeeting() {
    if (!meetingState.running || meetingState.paused) return;
    try {
        const result = await window.electronAPI.pauseMeeting();
        if (!result?.ok) throw new Error(result?.error || '일시정지 실패');
        showToast('일시정지 요청 완료');
    } catch (error) {
        showToast(error.message || '일시정지 실패');
    }
}

function handleMeetingPaused() {
    setPaused(true);
    showToast('회의가 일시정지되었습니다.');
}

async function sendUserMessage() {
    if (!meetingState.paused) return;
    const input = find('#meeting-user-input');
    const content = input ? input.value.trim() : '';
    if (!content) return showToast('전달할 메시지를 입력해주세요.');

    try {
        const result = await window.electronAPI.sendMeetingMessage(content);
        if (!result?.ok) throw new Error(result?.error || '메시지 전달 실패');
        speechController.appendUserSpeechItem(result?.speech || { content, agentName: '사용자' });
        if (input) input.value = '';
        updateUserInputActions();
        showToast('사용자 발언이 기록되었습니다.');
    } catch (error) {
        showToast(error.message || '메시지 전달 실패');
    }
}

async function resumeMeeting() {
    if (!meetingState.paused) return;
    try {
        const result = await window.electronAPI.resumeMeeting();
        if (!result?.ok) throw new Error(result?.error || '회의 재개 실패');
        setPaused(false);
        showToast('회의를 재개했습니다.');
    } catch (error) {
        showToast(error.message || '회의 재개 실패');
    }
}

async function exportMeeting() {
    if (!window.electronAPI?.exportMeeting) return;
    try {
        const result = await window.electronAPI.exportMeeting();
        if (!result?.ok) {
            if (result?.canceled) return;
            throw new Error(result?.error || '회의록 저장 실패');
        }
        showToast('회의록을 저장했습니다.');
    } catch (error) {
        showToast(error.message || '회의록 저장 실패');
    }
}

function handleMeetingEnded() {
    speechController.closeStreamingState();
    setRunning(false);
    speechController.syncEmptyStateVisibility();
    showToast('회의 종료');
}

function bindEvents() {
    find('.btn-start-meeting')?.addEventListener('click', startMeeting);
    find('.btn-stop-meeting')?.addEventListener('click', stopMeeting);
    find('.btn-pause-meeting')?.addEventListener('click', pauseMeeting);
    find('.btn-send-user-message')?.addEventListener('click', sendUserMessage);
    find('.btn-resume-meeting')?.addEventListener('click', resumeMeeting);
    find('.btn-export')?.addEventListener('click', exportMeeting);
    find('.btn-close')?.addEventListener('click', () => window.close());

    const userInput = find('#meeting-user-input');
    if (!userInput) return;
    userInput.addEventListener('input', updateUserInputActions);
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendUserMessage();
        }
    });
}

async function init() {
    if (!window.electronAPI) {
        console.error('electronAPI가 로드되지 않았습니다.');
        return;
    }

    speechController = window.createMeetingSpeechController?.({ state: meetingState, find, findAgent });
    if (!speechController) {
        console.error('meeting speech controller 초기화 실패');
        return;
    }

    bindEvents();
    await loadAgents();

    window.electronAPI.onMeetingSpeakerStart((data) => {
        setRunning(true);
        setPaused(false);
        speechController.handleSpeakerStart(data);
    });
    window.electronAPI.onMeetingChunk(speechController.handleMeetingChunk);
    window.electronAPI.onMeetingSpeakerEnd(speechController.handleSpeakerEnd);
    window.electronAPI.onMeetingPaused(handleMeetingPaused);
    window.electronAPI.onMeetingEnded(handleMeetingEnded);

    setRunning(false);
    speechController.syncEmptyStateVisibility();

    window.addEventListener('beforeunload', () => {
        window.electronAPI.removeMeetingListeners();
    });
}

document.addEventListener('DOMContentLoaded', init);
