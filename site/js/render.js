// ============================================================
// Renderização das seções de materiais (sem framework).
// Todo texto vindo do repositório passa por escapeHtml antes de ir ao HTML.
// ============================================================
import { escapeHtml } from './markdown.js';
import { formatBytes, formatDate, typeOf } from './utils.js';
import { githubFolderUrl } from './github.js';

function fileRow(file, folder) {
  const t = typeOf(file.ext);
  const sub = (file.subdirParts || []).join(' / ');
  const meta = [sub, formatBytes(file.size), t.label].filter(Boolean).join(' · ');
  return (
    `<li class="file">` +
    `<span class="file__icon" aria-hidden="true">${t.icon}</span>` +
    `<span class="file__info">` +
    `<span class="file__name">${escapeHtml(file.name)}</span>` +
    `<span class="file__meta">${escapeHtml(meta)}</span>` +
    `</span>` +
    `<button type="button" class="btn btn--dl" data-action="download" ` +
    `data-path="${escapeHtml(file.path)}"` +
    (folder ? ` data-folder="${escapeHtml(folder.path)}"` : '') +
    `>Baixar</button>` +
    `</li>`
  );
}

/** Agrupa arquivos por subpasta aninhada (1º nível de aninhamento). */
function groupedFileList(folder) {
  const groups = new Map();
  for (const f of folder.files) {
    const key = (f.subdirParts || []).join('/');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  let html = '';
  for (const key of keys) {
    const files = groups.get(key);
    if (key) {
      const label = key.split('/').join(' / ');
      html += `<li class="subfolder" aria-label="Subpasta ${escapeHtml(label)}">` +
        `<span class="subfolder__name">🗂️ ${escapeHtml(label)}</span></li>`;
    }
    html += files.map((f) => fileRow(f, folder)).join('');
  }
  return `<ul class="file-list">${html}</ul>`;
}

function novasBadge(folder) {
  return folder.isNew
    ? `<span class="badge badge--new" title="Atualizada nos últimos 7 dias">Novo</span>`
    : '';
}

function card(folder, idx) {
  const qtd = folder.fileCount === 1 ? '1 arquivo' : `${folder.fileCount} arquivos`;
  const meta = `${qtd} · ${formatBytes(folder.totalBytes)}`;
  const btnId = `btn-painel-${idx}`;
  const panelId = `painel-${idx}`;
  const readmeAttrs = folder.readme
    ? ` data-readme-path="${escapeHtml(folder.readme.path)}"` +
      ` data-readme-url="${escapeHtml(folder.readme.url)}"`
    : '';
  const ghLink = folder.path
    ? `<a class="link-discreto" href="${githubFolderUrl(folder.path)}" target="_blank" ` +
      `rel="noopener noreferrer">Ver no GitHub ↗</a>`
    : '';

  return (
    `<article class="card" data-folder="${escapeHtml(folder.path || 'raiz')}">` +
    `<h3 class="card__title">` +
    `<button type="button" class="card__toggle" id="${btnId}" ` +
    `aria-expanded="false" aria-controls="${panelId}">` +
    `<span class="card__icon" aria-hidden="true">${folder.isWeek ? '📘' : '📁'}</span>` +
    `<span class="card__name">${escapeHtml(folder.label)}</span>` +
    novasBadge(folder) +
    `<span class="card__meta">${escapeHtml(meta)}</span>` +
    `<span class="card__chevron" aria-hidden="true">▾</span>` +
    `</button></h3>` +
    `<div class="card__panel" id="${panelId}" role="region" aria-labelledby="${btnId}" hidden>` +
    `<div class="card__desc markdown" data-readme${readmeAttrs} hidden></div>` +
    `<div class="card__actions">` +
    `<button type="button" class="btn btn--zip" data-action="zip" ` +
    `data-folder="${escapeHtml(folder.path || '')}">⬇ Baixar pasta inteira (.zip)</button>` +
    `<span class="zip-progress" role="status" aria-live="polite" hidden></span>` +
    `${ghLink}</div>` +
    groupedFileList(folder) +
    `</div></article>`
  );
}

export function renderSummary(el, stats, fetchedAt) {
  el.innerHTML =
    `<div class="stat"><span class="stat__num" data-stat="files">${stats.fileCount}</span>` +
    `<span class="stat__lbl">arquivos</span></div>` +
    `<div class="stat"><span class="stat__num" data-stat="folders">${stats.folderCount}</span>` +
    `<span class="stat__lbl">pastas</span></div>` +
    `<div class="stat"><span class="stat__num">${formatBytes(stats.totalBytes)}</span>` +
    `<span class="stat__lbl">tamanho total</span></div>` +
    `<div class="stat"><span class="stat__num stat__num--date">${
      stats.lastUpdate ? formatDate(stats.lastUpdate) : formatDate(fetchedAt)
    }</span><span class="stat__lbl">última atualização</span></div>`;
}

export function renderSkeletons(el, n = 3) {
  el.innerHTML = Array.from(
    { length: n },
    () =>
      `<div class="card skeleton" aria-hidden="true">` +
      `<div class="sk sk--title"></div><div class="sk sk--line"></div>` +
      `<div class="sk sk--line sk--short"></div></div>`,
  ).join('');
}

export function renderNormal({ semanasEl, extrasEl, headings }, model) {
  const weeks = model.folders.filter((f) => f.isWeek);
  const extras = model.folders.filter((f) => !f.isWeek);

  semanasEl.innerHTML = weeks.length
    ? weeks.map((f, i) => card(f, `w${i}`)).join('')
    : `<p class="empty">Nenhuma pasta de semana encontrada.</p>`;
  headings.semanas.textContent = `Semanas (${weeks.length})`;

  let extrasHtml = extras.map((f, i) => card(f, `e${i}`)).join('');
  if (model.rootFiles && model.rootFiles.length) {
    const pseudo = {
      path: '',
      label: 'Arquivos avulsos na raiz',
      files: model.rootFiles,
      fileCount: model.rootFiles.length,
      totalBytes: model.rootFiles.reduce((s, f) => s + (f.size || 0), 0),
      isNew: false,
      isWeek: false,
      readme: null,
    };
    extrasHtml += card(pseudo, 'root');
  }
  extrasEl.innerHTML = extrasHtml || `<p class="empty">Nenhum material complementar.</p>`;
  const n = extras.length + (model.rootFiles && model.rootFiles.length ? 1 : 0);
  headings.extras.textContent = `Materiais complementares (${n})`;
}

export function filterFiles(model, query, type) {
  const q = String(query || '').trim().toLowerCase();
  const out = [];
  const push = (file, folderLabel) => {
    if (type !== 'todos' && typeOf(file.ext).id !== type) return;
    if (
      q &&
      !(
        file.name.toLowerCase().includes(q) ||
        file.path.toLowerCase().includes(q) ||
        String(folderLabel).toLowerCase().includes(q)
      )
    ) {
      return;
    }
    out.push({ file, folderLabel });
  };
  for (const f of model.folders) for (const file of f.files) push(file, f.label);
  for (const file of model.rootFiles || []) push(file, 'Arquivos avulsos na raiz');
  return out;
}

export function renderResults({ container, countEl }, results) {
  countEl.textContent = results.length === 1 ? '(1 arquivo)' : `(${results.length} arquivos)`;
  if (!results.length) {
    container.innerHTML =
      `<p class="empty">Nenhum arquivo encontrado. Tente outra palavra ou filtro.</p>`;
    return;
  }
  const groups = new Map();
  for (const r of results) {
    if (!groups.has(r.folderLabel)) groups.set(r.folderLabel, []);
    groups.get(r.folderLabel).push(r.file);
  }
  container.innerHTML = [...groups.entries()]
    .map(
      ([label, files]) =>
        `<h4 class="results__group">${escapeHtml(label)} ` +
        `<span class="results__n">(${files.length})</span></h4>` +
        `<ul class="file-list">${files.map((f) => fileRow(f)).join('')}</ul>`,
    )
    .join('');
}

export function renderError(el, repoUrl, message) {
  el.innerHTML =
    `<div class="error-box" role="alert">` +
    `<p><strong>Não foi possível carregar os materiais.</strong></p>` +
    `<p>${escapeHtml(message || 'Verifique sua conexão com a internet.')}</p>` +
    `<p class="error-box__actions">` +
    `<button type="button" class="btn" data-action="retry">🔄 Tentar de novo</button> ` +
    `<a class="btn btn--ghost" href="${repoUrl}" target="_blank" ` +
    `rel="noopener noreferrer">Abrir repositório ↗</a>` +
    `</p></div>`;
}
