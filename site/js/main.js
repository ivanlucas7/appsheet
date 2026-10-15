// ============================================================
// Orquestração do portal: carrega materiais, busca/filtros,
// acordeões, downloads, README sob demanda e inicializa o uploader.
// ============================================================
import { loadMaterials, githubRepoUrl } from './github.js';
import { normalizeTree } from './tree-model.js';
import { debounce, TYPE_FILTERS, zipNameFor } from './utils.js';
import { escapeHtml, renderMarkdown } from './markdown.js';
import { downloadFile, downloadFolderZip } from './downloads.js';
import {
  renderSummary,
  renderSkeletons,
  renderNormal,
  renderResults,
  filterFiles,
  renderError,
} from './render.js';
import { initUploader, fillWeeks } from './uploader.js';

const $ = (id) => document.getElementById(id);

const state = {
  model: null,
  byPath: new Map(), // path -> { file, folder }
  byFolder: new Map(), // folderPath -> folder (+ pseudopasta 'raiz')
  query: '',
  type: 'todos',
};

const els = {};

/* ---------- carregamento ---------- */

function indexModel(model) {
  state.byPath.clear();
  state.byFolder.clear();
  for (const f of model.folders) {
    state.byFolder.set(f.path, f);
    for (const file of f.files) state.byPath.set(file.path, { file, folder: f });
  }
  if (model.rootFiles?.length) {
    const pseudo = {
      path: '',
      label: 'Arquivos avulsos na raiz',
      files: model.rootFiles,
      fileCount: model.rootFiles.length,
      totalBytes: model.rootFiles.reduce((s, f) => s + (f.size || 0), 0),
    };
    state.byFolder.set('', pseudo);
    for (const file of model.rootFiles) state.byPath.set(file.path, { file, folder: pseudo });
  }
}

async function load() {
  els.erro.hidden = true;
  els.erro.innerHTML = '';
  els.semanasSec.hidden = true;
  els.extrasSec.hidden = true;
  els.resultadosSec.hidden = true;
  els.blocoLoading.hidden = false;
  renderSkeletons(els.semanasLista, 3);
  renderSkeletons(els.extrasLista, 2);

  try {
    const data = await loadMaterials();
    const model = {
      folders: data.folders,
      rootFiles: data.rootFiles || [],
      stats: data.stats,
    };
    // Defesa extra: se o proxy algum dia devolver outro formato,
    // reconstruímos a árvore bruta — nunca quebra a página.
    if (!model.folders && data.tree) {
      const norm = normalizeTree(data.tree, { lastCommits: {} });
      model.folders = norm.folders;
      model.rootFiles = norm.rootFiles;
      model.stats = norm.stats;
    }
    state.model = model;
    indexModel(model);

    renderSummary(els.resumo, model.stats, data.fetchedAt);
    fillWeeks(model);
    applyView();

    if (data.truncated) {
      announce(
        'Atenção: a lista de arquivos veio incompleta do GitHub. ' +
          'A maioria dos materiais está visível.',
      );
    }
  } catch (err) {
    renderError(els.erro, githubRepoUrl(), err?.message);
    els.erro.hidden = false;
    els.blocoLoading.hidden = true;
    els.resumo.innerHTML =
      `<div class="stat"><span class="stat__num">—</span>` +
      `<span class="stat__lbl">falha ao carregar</span></div>`;
  } finally {
    if (state.model) els.blocoLoading.hidden = true;
  }
}

/* ---------- busca + filtros ---------- */

function searching() {
  return state.query.trim() !== '' || state.type !== 'todos';
}

function applyView() {
  if (!state.model) return;
  if (searching()) {
    const results = filterFiles(state.model, state.query, state.type);
    els.semanasSec.hidden = true;
    els.extrasSec.hidden = true;
    els.resultadosSec.hidden = false;
    renderResults(
      { container: els.resultadosLista, countEl: els.resultadosCount },
      results,
    );
  } else {
    els.resultadosSec.hidden = true;
    els.semanasSec.hidden = false;
    els.extrasSec.hidden = false;
    renderNormal(
      { semanasEl: els.semanasLista, extrasEl: els.extrasLista, headings: els.headings },
      state.model,
    );
  }
  updateSearchCount();
}

function updateSearchCount() {
  const el = $('busca-count');
  if (!el) return;
  if (!searching()) {
    el.textContent = '';
    return;
  }
  const n = filterFiles(state.model, state.query, state.type).length;
  el.textContent = n === 1 ? '1 arquivo encontrado' : `${n} arquivos encontrados`;
}

/* ---------- acordeão + README sob demanda ---------- */

function toggleCard(btn) {
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  if (!panel) return;
  const open = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!open));
  panel.hidden = open;
  if (!open) loadReadme(panel);
}

async function loadReadme(panel) {
  const desc = panel.querySelector('[data-readme]');
  if (!desc || desc.dataset.loaded) return;
  const url = desc.getAttribute('data-readme-url');
  if (!url) return; // pasta sem README: nada a fazer
  desc.dataset.loaded = '1';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const html = renderMarkdown(text).trim();
    if (!html) return;
    desc.innerHTML = html;
    desc.hidden = false;
  } catch {
    desc.hidden = true; // falha silenciosa: a lista de arquivos continua ok
  }
}

/* ---------- downloads ---------- */

function btnBusy(btn, label) {
  btn.dataset.label = btn.textContent;
  btn.textContent = label;
  btn.disabled = true;
}
function btnRestore(btn, label, ms = 2500) {
  const original = label || btn.dataset.label || 'Baixar';
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, ms);
}

async function handleDownload(btn) {
  const rec = state.byPath.get(btn.getAttribute('data-path'));
  if (!rec) return;
  btnBusy(btn, 'Baixando…');
  const res = await downloadFile(rec.file);
  if (res.ok) {
    btn.textContent = '✔ Salvo!';
    btnRestore(btn, null);
  } else {
    btn.textContent = 'Aberto em nova aba ↗';
    btnRestore(btn, 'Baixar', 4000);
  }
}

function zipProgressText(p) {
  if (p.phase === 'files') return `Baixando ${p.done}/${p.total}…`;
  if (p.phase === 'zip') return 'Gerando ZIP…';
  return p.failed ? `Pronto! (${p.failed} arquivo(s) falharam)` : 'Pronto! ZIP salvo ✔';
}

async function handleZip(btn) {
  const folder = state.byFolder.get(btn.getAttribute('data-folder') ?? '');
  if (!folder || !folder.files.length) return;
  const article = btn.closest('article');
  const prog = article ? article.querySelector('.zip-progress') : null;
  btn.disabled = true;
  if (prog) {
    prog.hidden = false;
    prog.textContent = 'Preparando…';
  }
  try {
    await downloadFolderZip(folder, zipNameFor(folder.path || folder.label), (p) => {
      if (prog) prog.textContent = zipProgressText(p);
    });
  } catch (err) {
    if (prog) prog.textContent = `Erro: ${err?.message || 'tente de novo.'}`;
    btn.disabled = false;
    return;
  }
  setTimeout(() => {
    btn.disabled = false;
    if (prog) prog.hidden = true;
  }, 5000);
}

/* ---------- mensagens ---------- */

function announce(msg) {
  const el = $('status-global');
  if (el) el.textContent = msg;
}

/* ---------- filtros (chips) ---------- */

function buildChips() {
  const wrap = $('filtros-tipo');
  if (!wrap) return;
  wrap.innerHTML = TYPE_FILTERS.map(
    (t) =>
      `<button type="button" class="chip" data-type="${t.id}" ` +
      `aria-pressed="${t.id === 'todos'}">${escapeHtml(t.label)}</button>`,
  ).join('');
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    state.type = btn.getAttribute('data-type');
    wrap
      .querySelectorAll('.chip')
      .forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
    applyView();
  });
}

/* ---------- boot ---------- */

function cacheEls() {
  els.resumo = $('resumo-bar');
  els.blocoLoading = $('bloco-carregando');
  els.erro = $('erro-carregamento');
  els.semanasSec = $('semanas-sec');
  els.extrasSec = $('extras-sec');
  els.resultadosSec = $('resultados-sec');
  els.semanasLista = $('semanas-lista');
  els.extrasLista = $('extras-lista');
  els.resultadosLista = $('resultados-lista');
  els.resultadosCount = $('resultados-count');
  els.headings = { semanas: $('h-semanas'), extras: $('h-extras') };
  els.busca = $('busca');
}

function wireEvents() {
  const onSearch = debounce(() => {
    state.query = els.busca.value || '';
    applyView();
  }, 150);
  els.busca.addEventListener('input', onSearch);

  $('materiais').addEventListener('click', (e) => {
    const toggle = e.target.closest('.card__toggle');
    if (toggle) {
      toggleCard(toggle);
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'download') handleDownload(btn);
    else if (action === 'zip') handleZip(btn);
    else if (action === 'retry') load();
  });
}

cacheEls();
buildChips();
wireEvents();
load();
initUploader();

// Rodapé e links: apontam para o repositório configurado (sem hardcode no HTML).
document
  .querySelectorAll('[data-repo-link]')
  .forEach((a) => a.setAttribute('href', githubRepoUrl()));
const ano = $('ano-atual');
if (ano) ano.textContent = String(new Date().getFullYear());
