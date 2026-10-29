# OmniTask

> OmniTask é um gerenciador de tarefas desenvolvido com HTML5, CSS3 e JavaScript puro, com tela de acesso (e-mail/senha ou Google), painel administrativo de usuários, quadro visual por status, prioridades, categorias, prazos, filtros, indicadores de produtividade e persistência via `localStorage`.

**Tema visual:** BoardUI (tokens e receitas oficiais portados para CSS puro)
**Versão:** 1.2 · MVP completo com autenticação, administração e kanban avançado

---

## 1. Objetivo e problema resolvido

Pessoas que administram várias atividades — trabalho, estudos e vida pessoal — costumam esquecer compromissos, perder prazos e usar ferramentas diferentes para cada contexto.

O **OmniTask** centraliza essas atividades em um único painel visual, permitindo cadastrar, organizar, priorizar, concluir e acompanhar tarefas **sem backend e sem internet**: cada conta guarda suas tarefas no `localStorage` do navegador, isoladas por dono.

**Proposta de valor:** *Organize suas tarefas, priorize o que importa e acompanhe sua produtividade em um único lugar.*

---

## 2. Funcionalidades

### Acesso e contas

- Tela de acesso com abas **Entrar** / **Criar conta** (controle segmentado do BoardUI).
- Login por **e-mail e senha** com hash **PBKDF2** (WebCrypto, 120.000 iterações + salt) e fallback para contextos sem `crypto.subtle` (ex.: `file://`).
- Login com **Google**: real quando `OmniConfig.GOOGLE_CLIENT_ID` está definido em `js/config.js`; caso contrário, fluxo simulado de demonstração.
- Sessão local com TTL de 7 dias (`omnitask_session`), restaurada ao reabrir a página.
- **Conta administradora** criada automaticamente na primeira execução:
  - e-mail: `pauloaraujodeveloper@gmail.com`
  - senha inicial: `admin123` (altere após o primeiro acesso)
- **Painel administrativo** (somente admin): criar acessos, listar contas, promover/rebaixar papel, suspender/reativar, redefinir senha e excluir contas — sempre com confirmação.
- Conta da plataforma (`ADMIN_EMAIL`) e a própria conta não podem ser alteradas nem excluídas.
- Contas suspensas são bloqueadas na entrada, com mensagem clara.

### Tarefas

- Cadastro com título, descrição, prioridade, categoria, prazo e status.
- Edição completa; exclusão com confirmação prévia.
- Conclusão e reabertura (com registro de `completedAt`).
- Quadro com três colunas: **A fazer**, **Em andamento** e **Concluídas**.
- **Arrastar e soltar** (HTML5) entre colunas, com destaque da coluna-alvo — ou avanço com um clique pelo botão da tarefa.
- **Menu de ações por tarefa** (⋯): editar, mover para qualquer status (com marcação do status atual) e excluir; navegação por setas e fechamento com Escape.
- **Ordenação**: prazo (padrão, com atrasadas primeiro), prioridade, título (A–Z), mais recentes e última edição.
- **Paginação por coluna**: 6 cartões por página com ‹ página/atual › em cada coluna.
- **Planejador de prazos**: alternância **Quadro / Planejador** com visão **mensal** ou **semanal**, navegação por período, destaque do dia atual, chips por prioridade e lista de tarefas **sem prazo**. Clique em um chip abre a edição da tarefa.
- Prioridades **Alta / Média / Baixa** com cor **e** rótulo de texto (nunca apenas cor).
- Categorias: Trabalho, Estudos, Pessoal, Saúde, Finanças e Outros.
- Prazos `DD/MM/AAAA` com destaque de tarefas atrasadas.
- Filtros combináveis (status, prioridade, categoria, prazo) + pesquisa por título/descrição (ignora maiúsculas/acentos).
- Dashboard com 6 indicadores: total, a fazer, em andamento, concluídas, atrasadas e percentual de conclusão.
- Cada tarefa carrega o campo `owner` (conta dona); contas diferentes no mesmo navegador veem apenas as próprias tarefas.
- Diálogo de **Nova tarefa centralizado** na tela (`<dialog>` nativo + `margin: auto`).

### Qualidade de interface

- **Tema BoardUI exclusivamente:** todos os tokens (cores OKLCH, raios, sombras, tipografia Inter) vêm de `css/theme-boardui.css`; nenhum hex avulso nos estilos da aplicação. O Tabler e outros design systems não são usados (conflitariam com as mesmas classes).
- **Tema claro, escuro ou automático:** botão no cabeçalho alterna os três modos; o modo **automático** (padrão) respeita a preferência do sistema (`prefers-color-scheme`) e o estado escolhido fica salvo no navegador.
- **Anime.js v4** empacotado localmente (`assets/js/anime.umd.min.js`, sem CDN): entradas fade+escala+blur, toasts, diálogos com a curva oficial do BoardUI, crossfade de números (sem contagem progressiva) e logo animado/arrastável.
- Animações nunca escondem conteúdo: com aba oculta ou `requestAnimationFrame` não disparando, os elementos aparecem prontos (temporizador de segurança em `js/animations.js`).
- `prefers-reduced-motion` desliga toda a movimentação.
- Estados: carregamento, vazio, nenhum resultado, sucesso, erro e confirmação.
- Responsiva (desktop, tablet, smartphone, impressão) e acessível (semântica, foco visível com anel BoardUI, teclado, ARIA).

### Fora do escopo (v2.0)

Backend, sincronização entre dispositivos, colaboração, notificações push, IA, aplicativo nativo, exportação JSON e revisão em lista.

> A autenticação é **local/demo**: contas e senhas (hasheadas) ficam no `localStorage` deste navegador. Não é um sistema de autenticação de produção — para isso seria necessário um backend.

---

## 3. Tecnologias

| Tecnologia | Finalidade |
| --- | --- |
| HTML5 | Estrutura semântica |
| CSS3 (Grid, Flexbox, custom properties) | Layout, tema BoardUI e responsividade |
| JavaScript ES6+ (IIFE, sem módulos) | Lógica, DOM, CRUD, auth, filtros e indicadores |
| WebCrypto (`crypto.subtle`) | Hash PBKDF2 das senhas |
| Google Identity Services | Login real com Google (opcional) |
| Anime.js v4 (local) | Animações no vocabulário de movimento do BoardUI |
| BoardUI | Sistema de design: tokens, componentes e receitas |
| localStorage | Persistência local |
| Git / GitHub | Controle de versão |
| Vercel ou Render | Publicação (aplicação estática) |

**Sem dependências externas em runtime:** nenhum CDN. Anime.js e a fonte Inter são servidos de `assets/`. Funciona offline após o carregamento (o login Google real requer internet).

---

## 4. Como executar localmente

1. Clone o repositório e abra a pasta no VS Code.
2. Abra `index.html` direto no navegador **ou** use a extensão **Live Server** (recomendado para o login real com Google).
3. Entre com a conta administradora e crie seus acessos:
   - **e-mail:** `pauloaraujodeveloper@gmail.com`
   - **senha:** `admin123`
4. Ou clique em **Criar conta** para registrar um usuário comum.

> Não é necessário `npm install` nem build.

### Configurar login real com Google (opcional)

1. Crie um projeto no [Google Cloud Console](https://console.cloud.google.com/) e habilite o **Google Identity Services**.
2. Gere um **OAuth Client ID** (tipo "Web application") e adicione o origem da aplicação (ex.: `http://localhost:5500`).
3. Copie o client ID para `js/config.js`:

```js
window.OmniConfig = {
  GOOGLE_CLIENT_ID: "SEU-client-id.apps.googleusercontent.com",
  // ...
};
```

Com o client ID preenchido, o botão oficial do Google assume o lugar do botão de demonstração. Sem ele, o botão entra em modo demo (cria/entra na conta `demo.google@omnitask.app`).

---

## 5. Estrutura de pastas

```text
portifolio/
│
├── index.html                # Portão de autenticação + aplicação + painel admin
├── README.md
├── LICENSE
│
├── assets/
│   ├── icons/                # Favicon e ícones
│   ├── images/               # Logo OmniTask
│   ├── fonts/                # Inter (woff2, local)
│   └── js/
│       └── anime.umd.min.js  # Anime.js v4 empacotado (sem CDN)
│
├── css/
│   ├── reset.css             # Reset leve + anel de foco BoardUI
│   ├── theme-boardui.css     # Tokens BoardUI (cores OKLCH, raios, sombras, tipografia)
│   ├── styles.css            # Layout, sidebar, cabeçalho, dashboard e quadro
│   ├── components.css        # Botões, cartões, formulários, diálogos e toasts
│   ├── auth.css              # Tela de acesso, conta na sidebar e painel de usuários
│   ├── responsive.css        # Media queries e impressão
│   └── modern.css            # Camada visual "tech" (vidro, brilhos, botão de tema)
│
├── js/
│   ├── config.js             # OmniConfig: GOOGLE_CLIENT_ID, admin, chaves de storage
│   ├── utils.js              # Auxiliares, formatação, ícones e criação segura de elementos
│   ├── storage.js            # localStorage das tarefas, com escopo por dono (`owner`)
│   ├── auth.js               # Contas, sessão, PBKDF2, Google e API administrativa
│   ├── tasks.js              # Estado em memória, validação e CRUD
│   ├── filters.js            # Estado e aplicação de filtros + pesquisa
│   ├── dashboard.js          # Cálculo dos indicadores
│   ├── animations.js         # Anime.js no vocabulário BoardUI (+ fallback seguro)
│   ├── admin.js              # Painel de gestão de usuários (somente admin)
│   ├── app.js                # Renderização, eventos, sessão e inicialização
│   ├── modern.js             # Tema claro/escuro/automático + arrastar e soltar
│   └── planner.js            # Planejador de prazos (visão mensal/semanal)
│
└── docs/
    ├── prd.md                # Documento de requisitos (PRD)
    └── screenshots/          # Capturas de tela
```

### Arquitetura

```text
Portão de autenticação (auth.js)  →  Sessão (omnitask_session)
        ↓ (somente com sessão ativa)
Interface (index.html + css/ BoardUI)  →  Lógica (tasks, filters, dashboard, admin)
        ↓
Armazenamento local (storage.js/auth.js → localStorage, isolado por conta)
```

Scripts carregados, nesta ordem: `anime, config, utils, storage, auth, tasks, filters, dashboard, animations, admin, app, modern, planner` — todos clássicos (sem `type="module"`), para abrir direto no navegador.

---

## 6. Modelo de dados

### Tarefa (`omnitask_tasks`)

```json
{
  "id": "task_lz3k8x1a2b",
  "owner": "user_admin",
  "title": "Estudar JavaScript",
  "description": "Praticar arrays e objetos",
  "priority": "alta",
  "category": "estudos",
  "dueDate": "2026-11-05",
  "status": "todo",
  "createdAt": "2026-10-28T12:00:00.000Z",
  "updatedAt": "2026-10-28T12:00:00.000Z",
  "completedAt": null
}
```

- `owner`: id da conta dona; tarefas antigas sem dono são migradas para a conta admin.
- `priority`: `alta` | `media` | `baixa`
- `category`: `trabalho` | `estudos` | `pessoal` | `saude` | `financas` | `outros`
- `status`: `todo` | `in_progress` | `done`
- `dueDate`: `YYYY-MM-DD` ou `""`

### Conta (`omnitask_users`)

```json
{
  "id": "user_admin",
  "name": "Paulo Araujo",
  "email": "pauloaraujodeveloper@gmail.com",
  "role": "admin",
  "status": "active",
  "provider": "local",
  "passwordHash": "pbkdf2$120000$…",
  "salt": "…",
  "createdAt": "…",
  "updatedAt": "…",
  "lastLoginAt": "…"
}
```

- `role`: `admin` | `user` · `status`: `active` | `suspended` · `provider`: `local` | `google`
- Senhas nunca em texto puro: `pbkdf2$<iterações>$<hash>` (ou `fb$…` no fallback).

### Sessão (`omnitask_session`)

`{ "userId": "…", "createdAt": "…", "expiresAt": <epoch+7d> }`

---

## 7. Regras de negócio principais

1. Título obrigatório, de **3 a 100 caracteres**, sem espaços nas extremidades; descrição ≤ 500.
2. Prioridade padrão **Média** e status inicial **A fazer**.
3. Apenas **um status por vez**; `completedAt` é preenchido em `done` e volta a `null` ao reabrir.
4. Tarefas **sem prazo** nunca são atrasadas; **concluídas** nunca são atrasadas.
5. Filtros e pesquisa **não alteram** os dados armazenados.
6. Indicadores **sempre** refletem o conjunto completo de tarefas, ignorando filtros.
7. Exclusão definitiva, sempre precedida de confirmação (tarefas e contas).
8. Dados corrompidos no `localStorage` são saneados com aviso ao usuário; falhas de gravação são comunicadas.
9. Cada conta só lê e escreve as **próprias** tarefas (`owner`); gravações preservam as demais contas.
10. Senhas são verificadas por hash (PBKDF2); conta suspensa é bloqueada na entrada.
11. A conta da plataforma (`ADMIN_EMAIL`) é reforçada como `admin`/ativa a cada início e não pode ser alterada ou excluída.
12. A sessão expira em 7 dias e é encerrada manualmente pelo botão **Sair da conta** (com confirmação).

---

## 8. Aprendizados técnicos

- Estrutura semântica com HTML5 (`header`, `nav`, `main`, `section`, `dialog`).
- Portar um design system React/Tailwind (BoardUI) para **CSS puro** via camada de tokens semânticos.
- WebCrypto `deriveBits` (PBKDF2-SHA-256) com degradação segura quando `crypto.subtle` está indisponível.
- Módulos com IIFE e pontes globais (`OmniUI`, `OmniAdmin`, `Motion`) para comunicação sem bundler.
- Criação segura de DOM (`textContent`, sem `innerHTML` com dados do usuário).
- `dialog` nativo, foco gerenciado, confirmações e toasts acessíveis.
- Animação defensiva: conteúdo nunca depende de `requestAnimationFrame` para ficar visível.

---

## 9. Testes executados

- Criar/editar/excluir/concluir tarefas; validação de campos; persistência após recarregar.
- Filtros combinados, pesquisa com acentos/maiúsculas e limpar filtros.
- Cadastro de conta, login/senha corretos e incorretos, sessão restaurada e expirada.
- Conta suspensa bloqueada na entrada; reativação; exclusão com confirmação; redefinição de senha (senha nova passa a valer, antiga é rejeitada).
- Isolamento de tarefas entre contas e migração de tarefas antigas sem dono.
- Painel admin: criar acesso, contadores, papéis, e bloqueio da conta da plataforma.
- Arrastar e soltar entre colunas (com destaque da coluna-alvo) e menu de ações por tarefa (mover/editar/excluir, teclado e Escape).
- Ordenação (prazo/prioridade/título/recentes/edição) e paginação por coluna (páginas ‹ n/m ›).
- Planejador mensal e semanal: navegação por período, dia atual, chips por prazo, tarefas sem prazo e abertura de edição pelo chip; filtros refletidos no planejador.
- Tema automático/claro/escuro: ciclo do botão, persistência e acompanhamento de `prefers-color-scheme`.
- Diálogo de nova tarefa centralizado na viewport.
- Quebra de layout em 1280/1024/900/640/380px validada nas media queries; gaveta da sidebar (abrir/fechar/Escape).
- Console sem erros em todos os fluxos; animações nunca deixam conteúdo invisível.

---

## 10. Melhorias futuras (v2.0)

- Backend real (senhas fora do navegador, sessão em cookie, OAuth oficial).
- Visualização em lista (kanban compacto); exportação/importação JSON.
- Categorias personalizadas; gráficos; comentários/anexos por tarefa.

---

## 11. Licença

Distribuído sob a licença [MIT](LICENSE).
