(function attachMarkdownRenderer(globalScope) {
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function tokenize(text, pattern, tokenPrefix, renderToken) {
        const tokens = [];
        const replaced = text.replace(pattern, (...args) => {
            const token = `@@MD_${tokenPrefix}_${tokens.length}@@`;
            tokens.push(renderToken(...args));
            return token;
        });

        return { replaced, tokens };
    }

    function restoreTokens(text, tokenPrefix, tokens) {
        return tokens.reduce((result, tokenValue, index) => {
            const token = `@@MD_${tokenPrefix}_${index}@@`;
            return result.split(token).join(tokenValue);
        }, text);
    }

    function renderLists(text) {
        const lines = text.split('\n');
        const chunks = [];
        let listItems = [];

        const flushList = () => {
            if (listItems.length === 0) {
                return;
            }
            const listHtml = `<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`;
            chunks.push(listHtml);
            listItems = [];
        };

        lines.forEach((line) => {
            const match = line.match(/^\s*-\s+(.+)$/);
            if (match) {
                listItems.push(match[1]);
                return;
            }

            flushList();
            chunks.push(line);
        });

        flushList();
        return chunks.join('\n');
    }

    function renderMarkdown(text) {
        if (typeof text !== 'string' || text.length === 0) {
            return '';
        }

        let output = escapeHtml(text).replace(/\r\n?/g, '\n');

        const fenced = tokenize(output, /```([\s\S]*?)```/g, 'FENCE', (_match, code) => {
            const normalized = code.replace(/^\n/, '').replace(/\n$/, '');
            const lines = normalized.split('\n');
            if (lines.length > 1 && /^[a-z0-9_-]+$/i.test(lines[0].trim())) {
                lines.shift();
            }
            return `<pre><code>${lines.join('\n')}</code></pre>`;
        });
        output = fenced.replaced;

        const inlineCode = tokenize(output, /`([^`\n]+)`/g, 'INLINE', (_match, code) => {
            return `<code>${code}</code>`;
        });
        output = inlineCode.replaced;

        output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        output = output.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        output = renderLists(output);
        output = output.replace(/\n\n+/g, '<br>');
        output = output.replace(/\n/g, '<br>');

        output = restoreTokens(output, 'INLINE', inlineCode.tokens);
        output = restoreTokens(output, 'FENCE', fenced.tokens);

        return output;
    }

    globalScope.renderMarkdown = renderMarkdown;
})(window);
