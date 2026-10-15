// Busca dos materiais: tenta /api/tree (proxy com cache + token no servidor)
// e, se falhar, chama a API do GitHub DIRETAMENTE do navegador como fallback.
// (A API direta tem limite de 60 req/hora por IP; por isso o proxy é o padrão.)
import { apiTreeUrl } from './tree-model.js';
import { normalizeTree } from './tree-model.js';
import { OWNER, REPO, BRANCH } from './config.js';

/** URL da pasta no GitHub (botão "Ver no GitHub"). */
export function githubFolderUrl(folderPath) {
  const enc = String(folderPath)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `https://github.com/${OWNER}/${REPO}/tree/${encodeURIComponent(BRANCH)}/${enc}`;
}

/** URL do repositório. */
export function githubRepoUrl() {
  return `https://github.com/${OWNER}/${REPO}`;
}

export async function loadMaterials() {
  // 1) Proxy serverless (recomendado).
  try {
    const res = await fetch('/api/tree');
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const json = await res.json();
    if (!json || json.ok !== true) throw new Error('proxy inválido');
    return { ...json, provider: 'proxy' };
  } catch (proxyErr) {
    console.warn('[materiais] /api/tree falhou, tentando GitHub direto:', proxyErr);
  }

  // 2) Fallback: GitHub direto (mesmo modelo de dados, sem selo "Novo").
  const res = await fetch(apiTreeUrl(), {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        'Limite de requisições do GitHub atingido. Aguarde alguns minutos e tente de novo.',
      );
    }
    throw new Error(`GitHub respondeu ${res.status}.`);
  }
  const data = await res.json();
  const model = normalizeTree(data.tree, { lastCommits: {} });
  return {
    ok: true,
    truncated: Boolean(data.truncated),
    fetchedAt: new Date().toISOString(),
    provider: 'github-direto',
    folders: model.folders,
    rootFiles: model.rootFiles,
    stats: model.stats,
  };
}
