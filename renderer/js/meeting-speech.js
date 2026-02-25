function createMeetingSpeechController({ state, find, findAgent }) {
    function renderSpeechMarkdown(content) {
        if (typeof content !== 'string') {
            return '';
        }
        if (typeof window.renderMarkdown === 'function') {
            return window.renderMarkdown(content);
        }
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function applySpeechContent(contentEl, content) {
        if (!contentEl) {
            return;
        }
        contentEl.innerHTML = renderSpeechMarkdown(content);
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

    function resetSpeechLog() {
        const log = find('.speech-log');
        const emptyState = find('.empty-state');

        state.streamingItemEl = null;
        state.streamingContentEl = null;

        if (log) {
            log.innerHTML = '';
        }
        if (emptyState) {
            emptyState.style.display = 'block';
        }
    }

    function appendSpeechItem({ agentId, agentName, round, initialContent, streaming, isUser }) {
        const log = find('.speech-log');
        if (!log) {
            return { item: null, content: null };
        }

        clearSpeechPlaceholder();
        const agent = findAgent(agentId);
        const speakerName = agentName || agent?.name || '알 수 없는 화자';
        const speakerEmoji = agent?.emoji || (isUser ? '🧑' : '🤖');
        const roundLabel = typeof round === 'number' && round > 0 ? `${round}회차` : '발언';
        const title = `${speakerEmoji} ${speakerName} · ${roundLabel}`;

        const item = document.createElement('article');
        item.className = 'speech-item';
        if (streaming) {
            item.classList.add('streaming');
        }
        if (isUser) {
            item.classList.add('user');
        }

        const header = document.createElement('div');
        header.className = 'speech-meta';
        header.textContent = title;

        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';

        const content = document.createElement('div');
        content.className = 'speech-content';
        if (streaming) {
            content.textContent = initialContent || '';
        } else if (isUser) {
            content.textContent = initialContent || '';
        } else {
            applySpeechContent(content, initialContent || '');
        }

        bubble.appendChild(content);
        item.appendChild(header);
        item.appendChild(bubble);
        log.appendChild(item);
        log.scrollTop = log.scrollHeight;

        return { item, content };
    }

    function handleSpeakerStart(data) {
        const round = data?.round || 1;
        const agentId = data?.agentId || '';
        const agentName = data?.agentName || '알 수 없는 화자';
        const inserted = appendSpeechItem({
            agentId,
            agentName,
            round,
            initialContent: '',
            streaming: true,
            isUser: false,
        });
        state.streamingItemEl = inserted.item;
        state.streamingContentEl = inserted.content;
    }

    function handleMeetingChunk(data) {
        const chunk = typeof data?.chunk === 'string' ? data.chunk : '';
        if (!chunk || !state.streamingContentEl) {
            return;
        }

        state.streamingContentEl.textContent += chunk;
        const log = find('.speech-log');
        if (log) {
            log.scrollTop = log.scrollHeight;
        }
    }

    function handleSpeakerEnd(data) {
        if (!state.streamingItemEl || !state.streamingContentEl) {
            const inserted = appendSpeechItem({
                agentId: data?.agentId,
                agentName: data?.agentName,
                round: data?.round,
                initialContent: data?.content || '',
                streaming: false,
                isUser: false,
            });
            state.streamingItemEl = inserted.item;
            state.streamingContentEl = inserted.content;
        } else {
            const finalContent = typeof data?.content === 'string'
                ? data.content
                : (state.streamingContentEl.textContent || '');
            applySpeechContent(state.streamingContentEl, finalContent);
        }

        if (state.streamingItemEl) {
            state.streamingItemEl.classList.remove('streaming');
        }
        state.streamingItemEl = null;
        state.streamingContentEl = null;
    }

    function appendUserSpeechItem(data) {
        appendSpeechItem({
            agentId: 'user',
            agentName: data?.agentName || '사용자',
            round: data?.round,
            initialContent: data?.content || '',
            streaming: false,
            isUser: true,
        });
    }

    function closeStreamingState() {
        if (state.streamingItemEl) {
            state.streamingItemEl.classList.remove('streaming');
        }
        state.streamingItemEl = null;
        state.streamingContentEl = null;
    }

    return {
        resetSpeechLog,
        syncEmptyStateVisibility,
        handleSpeakerStart,
        handleMeetingChunk,
        handleSpeakerEnd,
        appendUserSpeechItem,
        closeStreamingState,
    };
}

window.createMeetingSpeechController = createMeetingSpeechController;
