function formatExportDate(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function formatExportTime(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function buildChatExportText(agent, history) {
    const agentName = agent?.name || '에이전트';
    const lines = [
        `[${agentName}] 대화 기록 (${formatExportDate()})`,
        '───────────────────────',
    ];

    history.forEach((message) => {
        const roleLabel = message.role === 'assistant' ? agentName : 'User';
        lines.push(`[${roleLabel}] ${formatExportTime(message.timestamp)}`);
        lines.push(message.content || '');
        lines.push('');
    });

    lines.push('───────────────────────');
    return lines.join('\n');
}

function buildMeetingExportText(meetingState) {
    const topic = meetingState?.topic || '회의 주제 미기재';
    const lines = [
        `[작전 회의실] 회의 기록 (${formatExportDate()})`,
        `주제: ${topic}`,
        '───────────────────────',
    ];

    (meetingState?.history || []).forEach((speech) => {
        lines.push(`[${speech.agentName || '알 수 없는 화자'}] ${formatExportTime(speech.timestamp)}`);
        lines.push(speech.content || '');
        lines.push('');
    });

    lines.push('───────────────────────');
    return lines.join('\n');
}

module.exports = {
    buildChatExportText,
    buildMeetingExportText,
};
