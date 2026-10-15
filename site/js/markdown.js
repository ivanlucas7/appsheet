// ============================================================
// Mini-renderizador de Markdown + sanitização.
// Estratégia de segurança: o HTML é ESCAPADO primeiro e só depois são
// aplicadas as regras de formatação; links aceitam apenas http(s).
// Cobre o básico dos READMEs (títulos, listas, negrito, itálico, código,
// links, citações simples). Sem dependências.
// ============================================================

/** Escapa os 5 caracteres que permitem injeção de HTML. */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function inline(text) {
  return (
    text
      // `código`
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      // **negrito**
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // *itálico* (sem quebrar o negrito já convertido)
      .replace(/(^|[^*>])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      // [texto](https://...) — somente http(s)
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)"']+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      )
  );
}

export function renderMarkdown(src) {
  const lines = escapeHtml(String(src || '').replace(/\r\n?/g, '\n')).split('\n');
  let html = '';
  let inList = null; // 'ul' | 'ol' | null
  let inCode = false;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html += `<p>${inline(para.join('<br>'))}</p>`;
      para = [];
    }
  };
  const closeList = () => {
    if (inList) {
      html += inList === 'ol' ? '</ol>' : '</ul>';
      inList = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (/^```/.test(line)) {
      flushPara();
      closeList();
      inCode = !inCode;
      html += inCode ? '<pre><code>' : '</code></pre>';
      continue;
    }
    if (inCode) {
      html += `${line}\n`;
      continue;
    }
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      closeList();
      html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      continue;
    }
    if (/^([-*_])\1{2,}\s*$/.test(line.trim())) {
      flushPara();
      closeList();
      html += '<hr>';
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inList !== 'ul') {
        closeList();
        html += '<ul>';
        inList = 'ul';
      }
      html += `<li>${inline(ul[1])}</li>`;
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inList !== 'ol') {
        closeList();
        html += '<ol>';
        inList = 'ol';
      }
      html += `<li>${inline(ol[1])}</li>`;
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushPara();
      closeList();
      html += `<blockquote>${inline(quote[1])}</blockquote>`;
      continue;
    }

    closeList();
    para.push(line);
  }

  flushPara();
  closeList();
  if (inCode) html += '</code></pre>';
  return html;
}
