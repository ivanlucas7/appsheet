// Utilidades pequenas do front-end (puras, sem DOM).

/** "1536" -> "1,5 KB"; "40871027" -> "39 MB". */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const decimals = i === 0 ? 0 : v >= 100 ? 0 : 1;
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: decimals })} ${units[i]}`;
}

/** "2026-10-14T..." -> "14/10/2026". */
export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "2026-10-14T..." -> "14/10/2026, 21:35". */
export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Classifica a extensão em um tipo com ícone e rótulo pt-BR. */
export function typeOf(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === 'pdf') return { id: 'pdf', icon: '📕', label: 'PDF' };
  if (['doc', 'docx', 'docm', 'odt', 'rtf'].includes(e))
    return { id: 'word', icon: '📝', label: 'Word' };
  if (['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(e))
    return { id: 'excel', icon: '📊', label: 'Excel' };
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'heic', 'tif', 'tiff'].includes(e))
    return { id: 'imagem', icon: '🖼️', label: 'Imagem' };
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'].includes(e))
    return { id: 'video', icon: '🎬', label: 'Vídeo' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e))
    return { id: 'zip', icon: '📦', label: 'ZIP' };
  if (['ppt', 'pptx', 'odp'].includes(e)) return { id: 'outros', icon: '📽️', label: 'Slides' };
  return { id: 'outros', icon: '📄', label: e ? e.toUpperCase() : 'Arquivo' };
}

/** Rótulos dos filtros de tipo (ordem de exibição). */
export const TYPE_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pdf', label: 'PDF' },
  { id: 'word', label: 'Word' },
  { id: 'excel', label: 'Excel' },
  { id: 'imagem', label: 'Imagem' },
  { id: 'video', label: 'Vídeo' },
  { id: 'zip', label: 'ZIP' },
  { id: 'outros', label: 'Outros' },
];

/** Evita chamadas repetidas (ex.: busca enquanto digita). */
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Nome de pasta legível para nome de arquivo .zip: "semana 1" -> "semana-1". */
export function zipNameFor(folderName) {
  const base = String(folderName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'pasta'}.zip`;
}
