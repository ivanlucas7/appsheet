// Downloads individuais e em ZIP (gerado no navegador via fflate, via CDN).

/** Dispara o salvamento de um Blob com o nome original. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Baixa um arquivo forçando o salvamento (inclusive PDFs, que o navegador
 * tentaria abrir): faz fetch da URL raw (CORS permitido), converte em Blob
 * e usa <a download>. Em caso de falha, abre a URL raw em nova aba.
 */
export async function downloadFile(file, { onStart, onSuccess, onError } = {}) {
  onStart?.(file);
  try {
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    saveBlob(blob, file.name);
    onSuccess?.(file);
    return { ok: true, fallback: false };
  } catch (err) {
    // Fallback: abre a URL raw em nova aba para o aluno salvar manualmente.
    window.open(file.url, '_blank', 'noopener,noreferrer');
    onError?.(file, err);
    return { ok: false, fallback: true };
  }
}

/**
 * Baixa todos os arquivos da pasta (até 4 em paralelo) e gera o ZIP no
 * navegador, preservando subpastas. Progresso via onProgress({phase, done,
 * total, failed}): phase = 'files' | 'zip' | 'done'.
 * A biblioteca fflate é importada sob demanda (só quando o aluno clicar).
 */
export async function downloadFolderZip(folder, zipFilename, onProgress) {
  const total = folder.files.length;
  onProgress?.({ phase: 'files', done: 0, total, failed: 0 });

  const entries = [];
  const queue = [...folder.files];
  let done = 0;
  let failed = 0;

  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const f = queue.shift();
      try {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const inner = [...(f.subdirParts || []), f.name].join('/');
        entries.push([inner, buf]);
      } catch {
        failed += 1;
      } finally {
        done += 1;
        onProgress?.({ phase: 'files', done, total, failed });
      }
    }
  });
  await Promise.all(workers);

  if (!entries.length) {
    throw new Error('Nenhum arquivo pôde ser baixado. Verifique sua conexão e tente de novo.');
  }

  onProgress?.({ phase: 'zip', done, total, failed });

  const { zip } = await import('https://cdn.jsdelivr.net/npm/fflate@0.4.8/+esm');
  const zipped = await new Promise((resolve, reject) => {
    zip(Object.fromEntries(entries), { level: 6 }, (err, out) =>
      err ? reject(err) : resolve(out),
    );
  });

  saveBlob(new Blob([zipped], { type: 'application/zip' }), zipFilename);
  onProgress?.({ phase: 'done', done, total, failed });
}
