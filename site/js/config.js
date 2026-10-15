// ============================================================
// Configuração central do portal.
// É o ÚNICO lugar onde se define: OWNER, REPO, BRANCH, a lista
// de ignorados da listagem e as opções do Uploadcare.
// ⚠️  NENHUM segredo (token, secret key) pode ir para este arquivo.
//     A public key do Uploadcare é pública por natureza e pode ficar aqui.
// ============================================================

export const OWNER = 'ivanlucas7';
export const REPO = 'appsheet';
export const BRANCH = 'main';

// Pastas/arquivos da RAIZ do repositório que NÃO devem aparecer no portal.
// A comparação vale para o primeiro segmento do caminho: 'site' esconde
// 'site/index.html', 'site/api/tree.js', etc.
// ('.agents' é uma segurança extra para pastas de tooling.)
export const IGNORE_PATHS = [
  'site',
  '.github',
  '.gitignore',
  'README.md',
  'package.json',
  'vercel.json',
  'node_modules',
  '.agents',
];

export const UPLOADCARE = {
  CTX_NAME: 'envio-alunos',
  // 👉 Forma RECOMENDADA: defina a env UPLOADCARE_PUBLIC_KEY na Vercel
  //    (o front busca via GET /api/config). Este campo é apenas fallback
  //    para uso local sem serverless. Sem key em nenhum dos dois lugares,
  //    o envio de tarefas não funciona.
  PUBKEY: 'SUA_PUBLIC_KEY_AQUI',
  // Tamanho máximo por arquivo: 10 MB.
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  // Extensões aceitas no envio.
  ACCEPT: '.pdf,.zip',
  // Fontes de arquivo liberadas para os alunos (menos confusão no celular).
  SOURCE_LIST: 'local, camera',
};

export const GITHUB_API = 'https://api.github.com';
export const RAW_BASE = 'https://raw.githubusercontent.com';

export default {
  OWNER,
  REPO,
  BRANCH,
  IGNORE_PATHS,
  UPLOADCARE,
  GITHUB_API,
  RAW_BASE,
};
