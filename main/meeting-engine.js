const initialState = () => ({
    status: 'IDLE',
    topic: '',
    participants: [],
    history: [],
    currentRound: 0,
    maxRounds: 3,
    currentSpeakerIndex: 0,
});

const state = initialState();
let stopRequested = false;

function cloneState() {
    return {
        status: state.status,
        topic: state.topic,
        participants: [...state.participants],
        history: state.history.map((item) => ({ ...item })),
        currentRound: state.currentRound,
        maxRounds: state.maxRounds,
        currentSpeakerIndex: state.currentSpeakerIndex,
    };
}

function getTotalTurns() {
    return state.participants.length * state.maxRounds;
}

function isEnded() {
    return state.history.length >= getTotalTurns() || stopRequested || state.status === 'ENDED';
}

function startMeeting(topic, participantIds, maxRounds = 3) {
    const safeTopic = typeof topic === 'string' ? topic.trim() : '';
    const uniqueParticipants = Array.isArray(participantIds)
        ? [...new Set(participantIds.filter((id) => typeof id === 'string' && id.trim()))]
        : [];
    const safeMaxRounds = Math.min(10, Math.max(1, Number.parseInt(maxRounds, 10) || 3));

    if (!safeTopic) {
        throw new Error('회의 주제를 입력해주세요.');
    }
    if (uniqueParticipants.length < 2) {
        throw new Error('참여자는 최소 2명 이상이어야 합니다.');
    }

    state.status = 'STARTED';
    state.topic = safeTopic;
    state.participants = uniqueParticipants;
    state.history = [];
    state.currentRound = 0;
    state.maxRounds = safeMaxRounds;
    state.currentSpeakerIndex = 0;
    stopRequested = false;

    return cloneState();
}

function stopMeeting() {
    stopRequested = true;
    state.status = 'ENDED';
    return cloneState();
}

function buildContextMessages(speakerId) {
    const messages = [{ role: 'user', content: `회의 주제: ${state.topic}` }];

    state.history.forEach((speech) => {
        if (speech.agentId === speakerId) {
            messages.push({ role: 'assistant', content: speech.content });
        } else {
            messages.push({ role: 'user', content: `${speech.agentName}: ${speech.content}` });
        }
    });

    return messages;
}

function getNextTurnContext() {
    if (state.status === 'IDLE' || state.status === 'ENDED' || isEnded()) {
        state.status = 'ENDED';
        return null;
    }

    const turnIndex = state.history.length;
    const speakerIndex = turnIndex % state.participants.length;
    const round = Math.floor(turnIndex / state.participants.length) + 1;
    const agentId = state.participants[speakerIndex];

    state.currentSpeakerIndex = speakerIndex;
    state.currentRound = round;
    state.status = 'SPEAKING';

    return {
        agentId,
        round,
        messages: buildContextMessages(agentId),
    };
}

function appendSpeech(agent, content) {
    const safeContent = typeof content === 'string' ? content.trim() : '';
    const speech = {
        id: `speech-${Date.now()}-${state.history.length}`,
        agentId: agent?.id || 'unknown',
        agentName: agent?.name || '알 수 없는 화자',
        content: safeContent || '(응답 없음)',
        round: state.currentRound,
        timestamp: Date.now(),
    };

    state.history.push(speech);

    if (isEnded()) {
        state.status = 'ENDED';
    } else {
        state.status = 'WAITING';
    }

    return speech;
}

function getState() {
    return cloneState();
}

module.exports = {
    startMeeting,
    stopMeeting,
    getState,
    getNextTurnContext,
    appendSpeech,
};
