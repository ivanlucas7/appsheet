// ============================================================
// Modelo de dados do portal (puro, sem DOM).
// Compartilhado entre a função serverless (/api/tree) e o front-end
// (fallback direto à API do GitHub), para que ambos devolvam o mesmo formato.
// ============================================================
import { OWNER, REPO, BRANCH, IGNORE_PATHS, GITHUB_API, RAW_BASE } from './config.js';

const IGNORE_SET = new Set(IGNORE_PATHS.map((p) => p.toLowerCase()));

/** Pastas que casam com esse padrão vão para a seção "Semanas". */
export const WEEK_RE = /^semana\s*(\d+)/i;

/** Retorna true se o caminho deve ser escondido do portal. */
export function isIgnored(path) {
  const first = String(path).split('/')[0].toLowerCase();
  return IGNORE_SET.has(first);
}

/** Faz encodeURIComponent em cada segmento do caminho (há espaços e acentos). */
export function encodePath(path) {
  return String(path)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** URL de download direto (raw) de um arquivo do repositório. */
export function rawUrl(path) {
  return `${RAW_BASE}/${OWNER}/${REPO}/${BRANCH}/${encodePath(path)}`;
}

/** URL da API de árvore do GitHub (listagem recursiva). */
export function apiTreeUrl() {
  return `${GITHUB_API}/repos/${OWNER}/${REPO}/git/trees/${encodeURIComponent(
    BRANCH,
  )}?recursive=1`;
}

/** Extensão (minúscula, sem ponto) de um nome de arquivo. */
export function extOf(name) {
  const i = String(name).lastIndexOf('.');
  return i > 0 ? String(name).slice(i + 1).toLowerCase() : '';
}

/** Info de semana a partir do nome da pasta: { isWeek, number }. */
export function weekInfo(name) {
  const m = String(name).match(WEEK_RE);
  return m ? { isWeek: true, number: parseInt(m[1], 10) } : { isWeek: false, number: null };
}

/** Rótulo amigável: "semana 2" -> "Semana 2", "A_B-c" -> "A B c". */
export function displayName(name) {
  const w = weekInfo(name);
  if (w.isWeek) return `Semana ${w.number}`;
  const cleaned = String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Normaliza a árvore do GitHub em um modelo organizado por pasta de 1º nível.
 * @param {Array} items - entries de data.tree (ou filtro já aplicado)
 * @param {{ lastCommits?: Record<string,string> }} opts - datas ISO do último
 *   commit por pasta (para o selo "Novo"); ausência -> null (à prova de falha)
 * @returns {{ folders, rootFiles, stats }}
 */
export function normalizeTree(items, { lastCommits = {} } = {}) {
  const folders = new Map();
  const rootFiles = [];
  let totalBytes = 0;

  for (const it of items || []) {
    if (it.type !== 'blob') continue; // ignora subtrees; só arquivos
    if (isIgnored(it.path)) continue;
    const parts = String(it.path).split('/');
    const size = Number(it.size) || 0;
    totalBytes += size;

    const file = {
      name: parts[parts.length - 1],
      path: it.path,
      size,
      ext: extOf(parts[parts.length - 1]),
      url: rawUrl(it.path),
      // segmentos das subpastas aninhadas (ex.: ["Exercícios", "Extras"])
      subdirParts: parts.length > 2 ? parts.slice(1, -1) : [],
    };

    if (parts.length === 1) {
      rootFiles.push(file); // arquivo solto na raiz
      continue;
    }

    const top = parts[0];
    if (!folders.has(top)) {
      folders.set(top, {
        name: top,
        path: top,
        label: displayName(top),
        files: [],
        readme: null,
        fileCount: 0,
        totalBytes: 0,
        lastCommit: null,
        isNew: false,
        ...weekInfo(top),
      });
    }
    const f = folders.get(top);
    f.files.push(file);
    f.fileCount += 1;
    f.totalBytes += size;
    // README.md na raiz da pasta vira a descrição da semana.
    if (parts.length === 2 && /^readme\.md$/i.test(parts[1])) {
      f.readme = { path: it.path, url: rawUrl(it.path) };
    }
  }

  const folderList = [...folders.values()];
  const weekCutoff = Date.now() - 7 * 24 * 3600 * 1000;
  for (const f of folderList) {
    f.lastCommit = lastCommits[f.path] || null;
    f.isNew = Boolean(f.lastCommit) && Date.parse(f.lastCommit) >= weekCutoff;
    f.files.sort((a, b) => a.path.localeCompare(b.path, 'pt-BR'));
  }

  // Semanas primeiro (ordem numérica natural), depois as demais (A–Z).
  folderList.sort((a, b) => {
    if (a.isWeek && b.isWeek) return a.number - b.number;
    if (a.isWeek) return -1;
    if (b.isWeek) return 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  rootFiles.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  let lastUpdate = null;
  for (const f of folderList) {
    if (f.lastCommit && (!lastUpdate || f.lastCommit > lastUpdate)) lastUpdate = f.lastCommit;
  }

  return {
    folders: folderList,
    rootFiles,
    stats: {
      fileCount: rootFiles.length + folderList.reduce((s, f) => s + f.fileCount, 0),
      folderCount: folderList.length,
      totalBytes,
      lastUpdate,
    },
  };
}
