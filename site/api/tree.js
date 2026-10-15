// ============================================================
// GET /api/tree — lista os materiais do repositório.
// Função serverless da Vercel (Node, ESM).
//
// - Lê a árvore completa do GitHub (recursive=1).
// - Usa GITHUB_TOKEN (opcional) para escapar do limite de 60 req/hora por IP.
// - Filtra os caminhos ignorados e devolve JSON organizado por pasta.
// - Tenta obter a data do último commit de cada pasta (à prova de falha:
//   qualquer erro aqui vira lastCommit: null, sem derrubar a resposta).
// - Cache de borda: s-maxage=300, stale-while-revalidate=3600.
// ============================================================
import { OWNER, REPO, BRANCH } from '../js/config.js';
import { apiTreeUrl, isIgnored, normalizeTree } from '../js/tree-model.js';

const CACHE_HEADER = 's-maxage=300, stale-while-revalidate=3600';
const GH_API_BASE = 'https://api.github.com';

function ghHeaders() {
  const headers = {
    'User-Agent': 'appsheet-portal',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // Token OPCIONAL via variável de ambiente (nunca commite tokens!).
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const err = new Error(`GitHub respondeu ${res.status} para ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Data ISO do último commit que tocou o caminho (ou null se falhar). */
async function lastCommitFor(path) {
  try {
    const url =
      `${GH_API_BASE}/repos/${OWNER}/${REPO}/commits` +
      `?path=${encodeURIComponent(path)}&per_page=1&sha=${encodeURIComponent(BRANCH)}`;
    const commits = await fetchJson(url);
    return commits?.[0]?.commit?.committer?.date || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', CACHE_HEADER);

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido. Use GET.' });
    return;
  }

  try {
    const data = await fetchJson(apiTreeUrl());

    if (data.truncated) {
      // Repositórios muito grandes podem vir truncados; registramos no log.
      console.warn(
        `[api/tree] Atenção: árvore truncada pelo GitHub (truncated=true). ` +
          `Alguns arquivos podem estar faltando na listagem.`,
      );
    }

    // Pastas de 1º nível que contêm arquivos (para buscar o último commit).
    const blobs = (data.tree || []).filter((i) => i.type === 'blob' && !isIgnored(i.path));
    const folderTops = [
      ...new Set(
        blobs.filter((b) => String(b.path).includes('/')).map((b) => String(b.path).split('/')[0]),
      ),
    ];

    const lastCommits = {};
    const settled = await Promise.allSettled(
      folderTops.map(async (top) => [top, await lastCommitFor(top)]),
    );
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value[1]) lastCommits[s.value[0]] = s.value[1];
    }

    const model = normalizeTree(data.tree, { lastCommits });

    res.status(200).json({
      ok: true,
      truncated: Boolean(data.truncated),
      fetchedAt: new Date().toISOString(),
      provider: 'proxy',
      folders: model.folders,
      rootFiles: model.rootFiles,
      stats: model.stats,
    });
  } catch (err) {
    console.error('[api/tree] Falha ao montar a árvore:', err?.message || err);
    res.status(502).json({
      ok: false,
      error:
        'Não foi possível carregar a lista de materiais agora. ' +
        'Tente novamente em instantes.',
    });
  }
}
