# PRD — OmniTask

**Gerenciador de tarefas pessoais e profissionais**
**Versão:** 1.2 · **Status:** MVP implementado (autenticação, administração e kanban avançado) · **Prioridade:** Alta
**Categoria:** Produtividade / Organização pessoal
**Sistema de design:** BoardUI (tokens e receitas oficiais portados para CSS puro)

> Este documento resume os requisitos que orientaram a implementação. A versão integral do PRD foi a fonte de verdade para o desenvolvimento do MVP; a v1.1 acrescenta acesso por conta e painel administrativo; a v1.2 acrescenta drag and drop, tema claro/escuro/automático, planejador de prazos, ordenação, paginação e menus de ação por tarefa.

---

## 1. Visão geral

O **OmniTask** é uma aplicação web de gerenciamento de tarefas para organizar atividades pessoais e profissionais em um único ambiente, acompanhar prazos, definir prioridades e monitorar produtividade.

Desenvolvida com **HTML5, CSS3 e JavaScript puro**, sem backend: o acesso é por conta local (e-mail/senha com hash PBKDF2, ou Google) e os dados são persistidos no navegador via `localStorage`, **isolados por conta** (`owner`), permanecendo disponíveis após reabrir a aplicação no mesmo navegador.

**Proposta de valor:** *Organize suas tarefas, priorize o que importa e acompanhe sua produtividade em um único lugar.*

### Problema resolvido

- Esquecer tarefas e compromissos importantes.
- Perder prazos por falta de acompanhamento.
- Dificuldade em separar o urgente do menos importante.
- Falta de visão clara do andamento das atividades.
- Uso de ferramentas diferentes para contextos diferentes.
- Ausência de uma visão objetiva da própria produtividade.

---

## 2. Objetivos

**Geral:** desenvolver uma aplicação funcional que permita cadastrar, organizar, atualizar, concluir e acompanhar tarefas de forma simples e visual.

**Específicos:**

1. Gerenciar o ciclo de vida completo da tarefa (CRUD).
2. Facilitar identificação por status, prioridade e categoria.
3. Exibir prazos e destacar atrasos.
4. Persistir dados localmente no navegador.
5. Apresentar indicadores básicos de produtividade.
6. Oferecer experiência responsiva (desktop, tablet, mobile).
7. Demonstrar fundamentos de front-end em portfólio.

---

## 3. Público-alvo

| Persona | Perfil | Necessidade principal |
| --- | --- | --- |
| Profissional organizado | Acompanha entregas e prazos de trabalho | Ver pendentes, em andamento e atrasadas |
| Estudante | Organiza estudos, exercícios e trabalhos | Categorias, datas de entrega e prioridades |
| Organização pessoal | Tarefas domésticas e objetivos | Registro rápido, sem criar conta |

---

## 4. Escopo do MVP

**Incluído:** tela de acesso (entrar/criar conta), sessão local com expiração, contas com papel (admin/usuário) e estado (ativo/suspenso), painel administrativo de usuários (criar acesso, alterar papel, suspender/reativar, redefinir senha, excluir), isolamento de tarefas por conta, cadastro, edição, exclusão com confirmação, conclusão/reabertura, prioridade, prazo, categoria, status, filtros combinados, pesquisa, persistência em `localStorage`, dashboard de indicadores, identificação de atrasadas, tema BoardUI, animações (Anime.js local), responsividade, estados vazios e notificações visuais, arrastar e soltar entre colunas, menu de ações por tarefa, tema claro/escuro/automático, planejador de prazos mensal/semanal, ordenação e paginação por coluna.

**Não incluído (v2.0):** backend, banco remoto, sincronização, colaboração, compartilhamento, push, integrações, IA, app nativo.

> A autenticação é **local/demo**: contas e hashes ficam no `localStorage` do navegador. O login com Google é real somente quando `OmniConfig.GOOGLE_CLIENT_ID` está configurado; sem client ID, o fluxo é simulado para demonstração.

---

## 5. Requisitos funcionais

| ID | Requisito | Regras essenciais |
| --- | --- | --- |
| RF-01 | Criar tarefa | Título obrigatório de 3 a 100 caracteres (sem espaços nas pontas); descrição ≤ 500; prioridade padrão “Média”; status inicial “A fazer”; aparece imediatamente no quadro; persiste no `localStorage` |
| RF-02 | Editar tarefa | Formulário pré-preenchido; altera todos os campos; atualiza sem duplicar; cancelar descarta alterações |
| RF-03 | Excluir tarefa | Exige confirmação; recalcula indicadores; alteração persistida |
| RF-04 | Concluir/reabrir | Status muda para `done` (ou retorna a `todo`/`in_progress`); indicadores recalculados |
| RF-05 | Prioridade | Alta (vermelho), Média (amarelo/laranja), Baixa (azul/cinza) — **cor sempre acompanhada de texto** |
| RF-06 | Categoria | Trabalho, Estudos, Pessoal, Saúde, Finanças, Outros; exibida no cartão e usada como filtro |
| RF-07 | Prazo | Opcional; exibição `DD/MM/AAAA`; atrasada = prazo anterior à data local e status ≠ `done` |
| RF-08 | Status | Três colunas com contagem; mudança por ação no cartão ou pelo formulário |
| RF-09 | Filtros | Status, prioridade, categoria e prazo (inclui atrasadas) + opção de limpar tudo |
| RF-10 | Pesquisa | Título e descrição; ignora maiúsculas/acentos; combina com filtros |
| RF-11 | Persistência | Carrega ao iniciar; grava após cada operação; trata dados inválidos; avisa se indisponível |
| RF-12 | Indicadores | Total, a fazer, em andamento, concluídas, atrasadas e percentual = (concluídas ÷ total) × 100 → 0% sem tarefas |
| RF-13 | Acesso | Abas Entrar/Criar conta; e-mail + senha ou Google; validações com foco no campo inválido; erros claros (credenciais, conta suspensa, conta Google) |
| RF-14 | Conta | Nome, e-mail único válido e senha ≥ 6 (máx. 72); senha armazenada apenas como hash PBKDF2 (120.000 iterações + salt) com fallback offline |
| RF-15 | Sessão | Restaurada ao abrir a página; expira em 7 dias; saída manual com confirmação; app inacessível sem sessão |
| RF-16 | Isolamento | Cada tarefa tem `owner`; contas veem/editam apenas as próprias tarefas; gravações preservam as demais contas; tarefas sem dono migram para a conta admin |
| RF-17 | Administração | Papel `admin` pode: criar acesso, listar contas, promover/rebaixar, suspender/reativar, redefinir senha e excluir (com confirmação); conta da plataforma e a própria conta são protegidas; conta suspensa é bloqueada na entrada |
| RF-18 | Mover tarefas | Arrastar e soltar (HTML5) entre colunas com destaque da coluna-alvo; menu de ações por tarefa com "Mover para" (status atual marcado); avanço com um clique pelo botão da tarefa |
| RF-19 | Tema | Modos claro, escuro e **automático** (padrão, respeita `prefers-color-scheme`); alternância pelo botão no cabeçalho; escolha persistida no navegador |
| RF-20 | Planejador | Visão dos prazos em **mês** ou **semana**, com navegação por período, destaque do dia atual, chips por prioridade, lista de tarefas sem prazo e abertura da edição ao clicar no chip; respeita os filtros ativos |
| RF-21 | Organização | Ordenação: prazo (padrão), prioridade, título, mais recentes e última edição; paginação por coluna (6 por página, ‹ n/m ›); busca e filtros continuam combináveis |
| RF-22 | Menu de ações | Cada cartão tem menu (⋯) com editar, mover e excluir; fecha com Escape ou clique fora; navegação por setas; status atual marcado como item atual |
| RF-23 | Diálogo | "Nova tarefa" abre em diálogo nativo **centralizado** na viewport, com foco inicial no título |

---

## 6. Requisitos não funcionais

- **Usabilidade:** interface simples, ações identificáveis, textos claros.
- **Responsividade:** desktop, notebook, tablet e smartphone; sem rolagem horizontal indevida.
- **Desempenho:** leve e rápido; meta de 1.000 tarefas responsivas.
- **Acessibilidade:** HTML semântico, rótulos associados, teclado, foco visível, contraste, estados não baseados apenas em cor.
- **Segurança:** sem HTML executável vindo do usuário (`textContent`), validação antes de salvar, sem dados sensíveis, sem dependências externas.
- **Compatibilidade:** Chrome, Edge, Firefox e navegadores móveis recentes.
- **Manutenibilidade:** arquivos com responsabilidades claras e funções reutilizáveis.

---

## 7. Arquitetura

```text
Portão de autenticação (auth.js) → Sessão (omnitask_session)
        ↓ somente com sessão ativa
Interface (index.html + css/ BoardUI) → Lógica (tasks, filters, dashboard, admin)
        ↓
Armazenamento (storage.js / auth.js → localStorage, isolado por conta)
```

- Estado em memória durante a execução, sincronizado após cada alteração.
- Chaves de armazenamento: `omnitask_tasks`, `omnitask_users`, `omnitask_session`.
- Scripts clássicos (sem `type="module"`) para abrir direto no navegador, nesta ordem: `anime, config, utils, storage, auth, tasks, filters, dashboard, animations, admin, app`.

---

## 8. Modelo de dados

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

| Campo | Regra |
| --- | --- |
| `id` | identificador único |
| `owner` | id da conta dona; tarefas antigas sem dono migram para a conta admin |
| `priority` | `alta`, `media`, `baixa` |
| `category` | `trabalho`, `estudos`, `pessoal`, `saude`, `financas`, `outros` |
| `status` | `todo`, `in_progress`, `done` |
| `dueDate` | `YYYY-MM-DD` ou vazio |
| `completedAt` | preenchido em `done`; volta a `null` ao reabrir |

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

| Campo | Regra |
| --- | --- |
| `role` | `admin` ou `user` |
| `status` | `active` ou `suspended` (suspensa é bloqueada na entrada) |
| `provider` | `local` (e-mail+senha) ou `google` |
| `passwordHash` | `pbkdf2$<iterações>$<hash>`; fallback `fb$…` sem WebCrypto; `null` para contas Google |

### Sessão (`omnitask_session`)

`{ "userId": "…", "createdAt": "…", "expiresAt": <epoch + 7 dias> }`

Nomes internos em inglês; textos da interface em português.

---

## 9. Regras de negócio complementares

1. Identificador único por tarefa.
2. Títulos vazios não são permitidos.
3. Apenas um status por vez.
4. Tarefa concluída permanece no histórico local.
5. Exclusão definitiva, após confirmação.
6. Tarefas sem prazo não são atrasadas.
7. Concluídas nunca contam como atrasadas.
8. Filtros funcionam em conjunto.
9. Pesquisa não modifica dados armazenados.
10. Indicadores refletem o conjunto completo, ignorando filtros.
11. Mudança de status atualiza `updatedAt`.
12. Atraso calculado pela **data local** do usuário (sem conversão de fuso).
13. Funciona offline após o carregamento.
14. Senhas nunca em texto puro; verificação por hash (PBKDF2 + salt).
15. A conta da plataforma (`ADMIN_EMAIL`) é reforçada como admin/ativa a cada início e não pode ser alterada nem excluída.
16. Sessão expira em 7 dias; saída manual com confirmação.
17. Animações nunca escondem conteúdo: sem `requestAnimationFrame` (aba oculta), os elementos aparecem prontos.

---

## 10. Estados da interface

Carregamento inicial · Lista vazia · Nenhum resultado · Sucesso · Erro · Confirmação de exclusão.

---

## 11. Critérios de aceite do MVP

- [x] Criar, editar, excluir e concluir tarefas.
- [x] Campos obrigatórios validados com mensagens claras.
- [x] Tarefas organizadas em três colunas por status, com contagem.
- [x] Prioridade, categoria e prazo exibidos corretamente (atraso destacado).
- [x] Filtros e pesquisa funcionando em conjunto.
- [x] Dados preservados após atualizar a página.
- [x] Indicadores refletindo corretamente os dados.
- [x] Tarefas atrasadas identificadas.
- [x] Interface funcional em desktop e dispositivos móveis.
- [x] Tela de acesso com entrar/criar conta, validações e erros acessíveis.
- [x] Sessão restaurada ao reabrir; saída com confirmação; expiração em 7 dias.
- [x] Tarefas isoladas por conta; migração de tarefas sem dono.
- [x] Painel admin: criar acesso, papel, suspensão, redefinição de senha e exclusão com confirmação.
- [x] Conta da plataforma protegida; conta suspensa bloqueada na entrada.
- [x] Tema BoardUI aplicado exclusivamente (tokens semânticos, sem cores avulsas).
- [x] Animações com fallback seguro (conteúdo nunca fica invisível) e `prefers-reduced-motion`.
- [x] Arrastar e soltar entre colunas e menu de ações por tarefa (mover/editar/excluir).
- [x] Tema claro, escuro e automático (respeitando `prefers-color-scheme`), com persistência.
- [x] Planejador mensal e semanal de prazos, com navegação e chips clicáveis.
- [x] Ordenação e paginação por coluna funcionando com filtros e pesquisa.
- [x] Diálogo "Nova tarefa" centralizado na viewport.
- [x] Sem erros de console nos fluxos principais.
- [x] Documentação (README) e instruções de execução.
- [ ] Aplicação publicada e acessível (pendente de publicação).

---

## 12. Riscos e limitações

- **Perda de dados locais:** o `localStorage` pode ser limpo pelo usuário; sem backup automático.
- **Autenticação local/demo:** contas e hashes vivem no navegador; não é segurança de produção (sem backend).
- **Login Google:** requer `GOOGLE_CLIENT_ID` e internet; sem configuração, o fluxo é simulado.
- **Sem sincronização:** dados vinculados ao navegador e à origem da aplicação.
- **Crescimento do código:** separação por responsabilidades acompanhando a evolução.
- **Escopo excessivo:** recursos avançados permanecem no roadmap.
- **Datas:** tratadas sem conversões de fuso que alterem o dia selecionado.
- **Armazenamento limitado:** falhas de gravação são tratadas e comunicadas.

---

## 13. Roadmap

- **Fase 1** — Estrutura e layout ✅
- **Fase 2** — Cadastro e renderização ✅
- **Fase 3** — Operações CRUD ✅
- **Fase 4** — Persistência ✅
- **Fase 5** — Filtros e indicadores ✅
- **Fase 6** — Tema BoardUI e animações ✅
- **Fase 7** — Autenticação, contas e painel admin ✅
- **Fase 8** — Kanban avançado: drag and drop, tema claro/escuro/automático, planejador mensal/semanal, ordenação, paginação e menus de ação ✅
- **Fase 9** — Qualidade e publicação 🔄 (publicação pendente)
- **v2.0** — Backend real, visualização em lista, exportação JSON, categorias personalizadas, gráficos.

---

**Documento:** PRD OmniTask v1.2 — resumo de implementação
