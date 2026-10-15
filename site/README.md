# Portal de Materiais — Curso de AppSheet

Site estático (HTML + CSS + JS puro, sem build) + 1 função serverless
(`api/tree.js`). Fica na pasta `/site` — o **Root Directory** na Vercel deve ser `site`.

## O que o site faz

- Lista os materiais do repositório **dinamicamente** via GitHub API
  (nada hardcoded: semanas novas aparecem sozinhas).
- Download individual forçado (Blob + `<a download>`) e ZIP da pasta
  inteira gerado no navegador (fflate via CDN).
- Envio de tarefas via **Uploadcare File Uploader v1** (só PDF/ZIP até
  10 MB), com metadados (nome, turma, semana) para filtrar no dashboard.

## Configuração (passos manuais)

### 1. Vercel — importar e publicar

1. Na Vercel: **Add New → Project →** escolha o repositório
   `ivanlucas7/appsheet`.
2. Em **Root Directory**, selecione `site` (obrigatório — o site mora em `/site`).
3. Framework Preset: **Other**. Não há build nem output dir.
4. Deploy. Cada `push` na branch `main` republica automaticamente.

### 2. Vercel — `GITHUB_TOKEN` (opcional, mas recomendado)

Sem token, a API do GitHub permite ~60 req/hora por IP — estoura fácil
quando a turma toda usa a mesma rede (o proxy `/api/tree` + 1 req por
pasta para o selo "Novo" contam).

1. GitHub → Settings → Developer settings → **Personal access tokens →
   Fine-grained** → Generate: só leitura (**Contents: Read-only**) no
   repositório `appsheet`. Sem expiração longa e sem outros acessos.
2. Vercel → Project → **Settings → Environment Variables** → adicione
   `GITHUB_TOKEN` = o token (Production + Preview).
3. Redeploy. O token fica **só no servidor** (`api/tree.js`); nunca vai
   para o front-end nem para o repositório.

### 3. Uploadcare — ativar o envio de tarefas

1. Crie a conta/projeto em [uploadcare.com](https://uploadcare.com) e copie a
   **Public Key** (dashboard → API keys). É pública — pode ir no código.
2. Em `site/js/config.js`, troque `SUA_PUBLIC_KEY_AQUI` pela sua key:
   `UPLOADCARE.PUBKEY = 'demopublickey'` (exemplo de formato).
3. Commit + push. Sem a key, o site mostra aviso e o uploader nem carrega.
4. No dashboard do Uploadcare, filtre os envios por **Metadata**:
   `aluno`, `turma_email`, `semana_atividade`, `observacao`, `enviado_em`.
5. (Opcional) No projeto Uploadcare, restrinja também por extensão/tamanho
   no servidor para reforçar o limite do front.

### 4. Testar localmente (opcional)

```powershell
# 1) Servir o front (qualquer servidor estático; ex.: VS Code Live Server)
#    abra http://localhost:XXXX/site/index.html
# 2) A listagem usa /api/tree; sem Vercel ela cai no fallback direto ao
#    GitHub (funciona, mas sem selo "Novo" e com limite de 60 req/hora).
# 3) Para testar a função com token:
#    crie site/.env.local com GITHUB_TOKEN=seu_token (ignorado pelo git)
```

> ⚠️ Nunca commite tokens. Só a **public key** do Uploadcare vai para o
> repositório. Segredos ficam nas Environment Variables da Vercel.

## Estrutura

```text
site/
├── index.html        # página única (Materiais + Enviar tarefa)
├── css/styles.css    # mobile-first, claro/escuro automático
├── js/
│   ├── config.js     # ÚNICO lugar de OWNER/REPO/BRANCH, ignorados e Uploadcare
│   ├── tree-model.js # modelo compartilhado (server + fallback do front)
│   ├── github.js     # /api/tree com fallback direto ao GitHub
│   ├── render.js     # HTML das seções (com escape)
│   ├── markdown.js   # mini-markdown sanitizado (READMEs)
│   ├── downloads.js  # download individual + ZIP (fflate via CDN)
│   ├── uploader.js   # Uploadcare v1 (tags uc-*, locale pt, metadados)
│   └── main.js       # orquestração
├── api/tree.js       # função serverless (proxy + cache + selo "Novo")
├── package.json      # só metadados (sem dependências, sem build)
└── .gitignore        # ignora .env.local
```

## Checklist de testes (faça após o deploy)

- [ ] Materiais carregam: resumo mostra arquivos/pastas/tamanho/data.
- [ ] Seções "Semanas" em ordem (1, 2, …) + "Materiais complementares".
- [ ] Abrir uma semana mostra arquivos, tamanhos e descrição do README.
- [ ] Selo "Novo" aparece em pasta alterada há < 7 dias.
- [ ] Busca instantânea + filtros (PDF, Word, Excel, imagem, vídeo, ZIP, outros).
- [ ] Download individual salva o arquivo (teste com PDF e nome com espaço/acento).
- [ ] "Baixar pasta inteira (.zip)" gera `semana-N.zip` com barra de progresso.
- [ ] Com `/api/tree` fora do ar (ex.: bloqueie no DevTools), o fallback
      carrega direto do GitHub; com tudo fora, aparece erro + "Tentar de novo".
- [ ] Enviar tarefa: uploader **bloqueado** até preencher nome + turma + semana.
- [ ] Upload de PDF ≤ 10 MB conclui e mostra confirmação + histórico local.
- [ ] Arquivo > 10 MB e extensão inválida mostram erro em pt-BR.
- [ ] Metadados (aluno/turma/semana) visíveis no dashboard do Uploadcare.
- [ ] Mobile (celular real): layout, acordeões, botões e uploader usáveis.
- [ ] Teclado + leitor de tela: foco visível, `aria-expanded`, `aria-live`.
- [ ] Tema escuro do sistema aplica o modo escuro automaticamente.
