// ============================================================
// Seção "Enviar tarefa" (Uploadcare File Uploader v1).
//
// Notas de implementação (conforme a documentação oficial v1):
// - As tags atuais são `uc-*` (`uc-config`, `uc-file-uploader-regular`,
//   `uc-upload-ctx-provider`). As antigas `lr-*` foram RENOMEADAS na v1
//   (breaking change) e não funcionam mais.
// - `metadata` é propriedade DOM APENAS (objeto não cabe em atributo HTML):
//   config.metadata = () => ({ aluno, turma_email, semana_atividade, ... })
//   Assim o professor identifica e filtra os envios no dashboard.
// - Idioma pt: defineLocale('pt', ...) ANTES de defineComponents.
// - Eventos ouvidos no <uc-upload-ctx-provider>: file-upload-success e
//   file-upload-failed (e.detail = OutputFileEntry: name, size, cdnUrl...).
// ============================================================
import { UPLOADCARE } from './config.js';
import { formatDateTime } from './utils.js';
import { escapeHtml } from './markdown.js';

const HISTORY_KEY = 'appsheet-envios';
const MAX_HISTORY = 20;
const PLACEHOLDER = '992fcf498c96049b6971';

const $ = (id) => document.getElementById(id);

function fieldValue(id) {
  const el = document.getElementById(id);
  return (el?.value || '').trim();
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage indisponível (modo privado etc.): segue sem histórico.
  }
}

export function renderHistory() {
  const listEl = $('env-historico-lista');
  const emptyEl = $('env-historico-vazio');
  if (!listEl || !emptyEl) return;
  const list = loadHistory();
  emptyEl.hidden = list.length > 0;
  listEl.innerHTML = list
    .map(
      (h) =>
        `<li><strong>${escapeHtml(h.name)}</strong>` +
        `<span>${escapeHtml(h.semana)} · ${escapeHtml(h.at)}</span></li>`,
    )
    .join('');
}

function setStatus(msg, kind = 'info') {
  const el = $('env-status');
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
}

function errorMessage(name, err) {
  const type = err?.type;
  if (type === 'FILE_SIZE_EXCEEDED') {
    return `“${name}” é grande demais. O limite é 10 MB por arquivo. ` +
      `Comprima ou divida o arquivo e tente de novo.`;
  }
  if (type === 'FORBIDDEN_FILE_TYPE') {
    return `“${name}” não é um formato aceito. Envie apenas arquivos .pdf ou .zip.`;
  }
  if (type === 'NETWORK_ERROR' || type === 'UPLOAD_ERROR') {
    return `Falha de conexão ao enviar “${name}”. Verifique sua internet e tente de novo.`;
  }
  const extra = err?.message ? `: ${err.message}` : '. Tente de novo.';
  return `Não foi possível enviar “${name}”${extra}`;
}

export function validateForm() {
  const nome = fieldValue('env-nome');
  const turma = fieldValue('env-turma');
  const semana = $('env-semana')?.value || '';
  const valid = nome.length >= 2 && turma.length >= 2 && semana !== '';
  const wrap = $('uploader-wrap');
  const lock = $('uploader-lock');
  const hint = $('dica-liberacao');
  if (wrap) wrap.hidden = !valid;
  if (lock) lock.hidden = valid;
  if (hint) {
    hint.textContent = valid
      ? 'Tudo certo! Agora escolha o arquivo abaixo para enviar.'
      : 'Preencha os campos obrigatórios para liberar o envio.';
  }
  return valid;
}

/** Preenche o select de semana/atividade com as pastas descobertas. */
export function fillWeeks(model) {
  const sel = $('env-semana');
  if (!sel) return;
  const opt = (f) =>
    `<option value="${escapeHtml(f.label)}">${escapeHtml(f.label)}</option>`;
  sel.innerHTML =
    `<option value="">— Escolha —</option>` +
    model.folders.filter((f) => f.isWeek).map(opt).join('') +
    model.folders.filter((f) => !f.isWeek).map(opt).join('');
  validateForm();
}

function showConfirmation(entry) {
  const box = $('env-confirmacao');
  if (!box) return;
  const semana = $('env-semana')?.value || '—';
  const agora = new Date().toISOString();
  box.hidden = false;
  box.innerHTML =
    `<p class="confirmacao__titulo">✅ Tarefa enviada com sucesso!</p>` +
    `<dl class="confirmacao__dados">` +
    `<div><dt>Arquivo</dt><dd>${escapeHtml(entry.name)}</dd></div>` +
    `<div><dt>Semana/atividade</dt><dd>${escapeHtml(semana)}</dd></div>` +
    `<div><dt>Enviado em</dt><dd>${escapeHtml(formatDateTime(agora))}</dd></div>` +
    `</dl>` +
    `<p class="confirmacao__dica">💡 Guarde um comprovante: tire um print desta tela.</p>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const history = loadHistory();
  history.unshift({
    name: entry.name,
    semana,
    at: formatDateTime(agora),
    cdnUrl: entry.cdnUrl || '',
  });
  saveHistory(history);
  renderHistory();
}

/**
 * Resolve a public key do Uploadcare:
 * 1) env da Vercel via GET /api/config (forma recomendada);
 * 2) fallback: valor digitado em site/js/config.js.
 */
async function resolvePubkey() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      const key = String(data?.uploadcarePubkey || '').trim();
      if (key && key !== PLACEHOLDER) return key;
    }
  } catch {
    // /api/config indisponível (ex.: abrindo index.html localmente):
    // cai no fallback do config.js.
  }
  const fallback = String(UPLOADCARE.PUBKEY || '').trim();
  return fallback && fallback !== PLACEHOLDER ? fallback : '';
}

export async function initUploader() {
  renderHistory();

  const form = $('form-envio');
  if (form) {
    form.addEventListener('input', validateForm);
    form.addEventListener('change', validateForm);
    form.addEventListener('submit', (e) => e.preventDefault());
  }
  validateForm();

  // Public key vem (em ordem de prioridade) da env da Vercel
  // (UPLOADCARE_PUBLIC_KEY → /api/config) ou, como fallback, do config.js.
  const pubkey = await resolvePubkey();

  // Sem public key, o upload não funciona: avisa e não carrega o uploader.
  if (!pubkey || pubkey === PLACEHOLDER) {
    const aviso = $('uploadcare-aviso');
    if (aviso) {
      aviso.hidden = false;
      aviso.textContent =
        '⚠️ O envio de tarefas ainda não foi ativado: falta configurar a public key ' +
        'do Uploadcare (env UPLOADCARE_PUBLIC_KEY na Vercel). Avise o professor.';
    }
    return;
  }

  let UC;
  try {
    UC = await import(
      'https://cdn.jsdelivr.net/npm/@uploadcare/file-uploader@v1/web/file-uploader.min.js'
    );
    UC.defineLocale('pt', () =>
      import(
        'https://cdn.jsdelivr.net/npm/@uploadcare/file-uploader@v1/locales/file-uploader/pt.js'
      ).then((m) => m.default),
    );
    UC.defineComponents(UC);
  } catch {
    setStatus(
      'Não foi possível carregar o componente de envio. ' +
        'Recarregue a página e tente de novo.',
      'error',
    );
    return;
  }

  const configEl = $('uc-config');
  const ctxEl = $('upload-ctx');
  if (!configEl || !ctxEl) return;

  // Opções vindas da env/config (atributos + propriedade DOM).
  configEl.setAttribute('pubkey', pubkey);
  configEl.setAttribute('max-local-file-size-bytes', String(UPLOADCARE.MAX_FILE_SIZE_BYTES));
  configEl.setAttribute('accept', UPLOADCARE.ACCEPT);
  configEl.setAttribute('locale-name', 'pt');
  configEl.setAttribute('source-list', UPLOADCARE.SOURCE_LIST);
  configEl.setAttribute('multiple', 'false');

  // Metadados como FUNÇÃO reativa: lidos no momento de cada upload, então
  // sempre refletem o formulário atual. Visíveis no dashboard do Uploadcare.
  configEl.metadata = () => ({
    aluno: fieldValue('env-nome'),
    turma_email: fieldValue('env-turma'),
    semana_atividade: $('env-semana')?.value || '',
    observacao: fieldValue('env-obs'),
    enviado_em: new Date().toISOString(),
    origem: 'portal-appsheet',
  });

  ctxEl.addEventListener('file-upload-success', (e) => {
    const entry = e.detail || {};
    showConfirmation({ name: entry.name || 'arquivo', cdnUrl: entry.cdnUrl || '' });
    setStatus(`“${entry.name || 'arquivo'}” enviado com sucesso.`, 'success');
  });

  ctxEl.addEventListener('file-upload-failed', (e) => {
    const entry = e.detail || {};
    const err = (entry.errors && entry.errors[0]) || null;
    setStatus(errorMessage(entry.name || 'arquivo', err), 'error');
  });
}
