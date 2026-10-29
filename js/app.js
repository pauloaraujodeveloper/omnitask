/* =========================================================
   app.js — Inicialização, renderização e eventos
   Interface → Lógica → Armazenamento local
   ========================================================= */

(() => {
  "use strict";

  /* ---------------- Referências do DOM ---------------- */
  const $ = (selector) => document.querySelector(selector);

  const els = {
    authView: $("#authView"),
    app: $("#app"),

    sidebar: $("#sidebar"),
    sidebarOverlay: $("#sidebarOverlay"),
    sidebarOpen: $("#sidebarOpen"),
    sidebarClose: $("#sidebarClose"),
    navItems: Array
      .from(document.querySelectorAll(".nav__item"))
      .filter((item) => item.dataset.nav !== "users"), // item exclusivo do admin (admin.js)

    logoutBtn: $("#logoutBtn"),
    userAvatar: $("#userAvatar"),
    userName: $("#userName"),
    userEmail: $("#userEmail"),
    userRole: $("#userRole"),

    searchInput: $("#searchInput"),
    searchClear: $("#searchClear"),
    todayLabel: $("#todayLabel"),

    newTaskBtn: $("#newTaskBtn"),
    emptyStateBtn: $("#emptyStateBtn"),
    emptyState: $("#emptyState"),
    emptyStateTitle: $("#emptyStateTitle"),
    emptyStateText: $("#emptyStateText"),
    board: $("#board"),

    viewBoardBtn: $("#viewBoardBtn"),
    viewPlannerBtn: $("#viewPlannerBtn"),
    planner: $("#planner"),
    plannerBody: $("#plannerBody"),
    plannerTitle: $("#plannerTitle"),
    plannerPrev: $("#plannerPrev"),
    plannerNext: $("#plannerNext"),
    plannerToday: $("#plannerToday"),
    plannerModeMonth: $("#plannerModeMonth"),
    plannerModeWeek: $("#plannerModeWeek"),

    colTodo: $("#colTodo"),
    colDoing: $("#colDoing"),
    colDone: $("#colDone"),
    colCountTodo: $("#colCountTodo"),
    colCountDoing: $("#colCountDoing"),
    colCountDone: $("#colCountDone"),

    navCountAll: $("#navCountAll"),
    navCountTodo: $("#navCountTodo"),
    navCountDoing: $("#navCountDoing"),
    navCountDone: $("#navCountDone"),

    statTotal: $("#statTotal"),
    statTodo: $("#statTodo"),
    statDoing: $("#statDoing"),
    statDone: $("#statDone"),
    statLate: $("#statLate"),
    statPercent: $("#statPercent"),
    progressLabel: $("#progressLabel"),
    progressFill: $("#progressFill"),
    progressBar: $("#progressBar"),
    dashboardSubtitle: $("#dashboardSubtitle"),

    filtersForm: $("#filtersForm"),
    filterStatus: $("#filterStatus"),
    filterPriority: $("#filterPriority"),
    filterCategory: $("#filterCategory"),
    filterDue: $("#filterDue"),
    filterSort: $("#filterSort"),
    clearFiltersBtn: $("#clearFiltersBtn"),
    filtersResult: $("#filtersResult"),

    taskDialog: $("#taskDialog"),
    taskForm: $("#taskForm"),
    taskDialogTitle: $("#taskDialogTitle"),
    modalClose: $("#modalClose"),
    taskCancel: $("#taskCancel"),
    taskTitle: $("#taskTitle"),
    taskTitleError: $("#taskTitleError"),
    taskTitleCounter: $("#taskTitleCounter"),
    taskDescription: $("#taskDescription"),
    taskDescriptionCounter: $("#taskDescriptionCounter"),
    taskPriority: $("#taskPriority"),
    taskCategory: $("#taskCategory"),
    taskDueDate: $("#taskDueDate"),
    taskStatus: $("#taskStatus"),

    confirmDialog: $("#confirmDialog"),
    confirmTitle: $("#confirmTitle"),
    confirmText: $("#confirmText"),
    confirmOk: $("#confirmOk"),
    confirmCancel: $("#confirmCancel"),

    storageWarning: $("#storageWarning"),
    toasts: $("#toasts"),
  };

  const COLUMNS = {
    todo: { container: els.colTodo, count: els.colCountTodo },
    in_progress: { container: els.colDoing, count: els.colCountDoing },
    done: { container: els.colDone, count: els.colCountDone },
  };

  /** Camada de animações (Anime.js) — opcional e desacoplada da lógica. */
  const Motion = window.OmniMotion || null;

  const STATUS_ORDER = { alta: 0, media: 1, baixa: 2 };

  /** Paginação por coluna: quantos cartões exibir antes de paginar. */
  const PAGE_SIZE = 6;
  const SORT_DEFAULT = "due";

  const columnPages = { todo: 1, in_progress: 1, done: 1 };
  let sortBy = SORT_DEFAULT;
  let currentView = "board"; // "board" | "planner"

  let editingId = null;
  let lastFocused = null;
  let currentNav = "overview";

  function resetColumnPages() {
    columnPages.todo = 1;
    columnPages.in_progress = 1;
    columnPages.done = 1;
  }

  /* =========================================================
     Notificações visuais (sucesso / erro / informação)
     ========================================================= */
  const TOAST_SYMBOL = { success: "✓", error: "!", info: "i" };

  function toast(message, type = "success") {
    const node = Utils.el("div", {
      className: `toast toast--${type}`,
      attrs: { role: type === "error" ? "alert" : "status" },
    });

    node.appendChild(
      Utils.el("span", { className: "toast__icon", text: TOAST_SYMBOL[type] || "i" })
    );
    node.appendChild(Utils.el("p", { className: "toast__msg", text: message }));

    const close = Utils.el("button", {
      className: "toast__close",
      attrs: { type: "button", "aria-label": "Fechar aviso" },
      text: "✕",
    });
    close.addEventListener("click", () => remove());
    node.appendChild(close);

    function remove() {
      if (!node.isConnected) return;
      if (Motion) {
        Motion.toastOut(node, () => node.remove());
      } else {
        node.classList.add("is-leaving");
        setTimeout(() => node.remove(), 260);
      }
    }

    els.toasts.appendChild(node);
    if (Motion) Motion.toastIn(node);

    // Mantém no máximo 4 notificações na tela.
    while (els.toasts.children.length > 4) {
      els.toasts.firstElementChild.remove();
    }

    setTimeout(remove, 4000);
  }

  /* =========================================================
     Confirmação antes de excluir (RF-03)
     ========================================================= */
  function confirmAction({ title, text, confirmLabel = "Confirmar" }) {
    return new Promise((resolve) => {
      els.confirmTitle.textContent = title;
      els.confirmText.textContent = text;
      els.confirmOk.textContent = confirmLabel;

      let settled = false;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        els.confirmOk.onclick = null;
        els.confirmCancel.onclick = null;
        els.confirmDialog.close();
        resolve(value);
      };

      els.confirmOk.onclick = () => finish(true);
      els.confirmCancel.onclick = () => finish(false);
      els.confirmDialog.addEventListener("close", () => finish(false), { once: true });
      els.confirmDialog.showModal();
      if (Motion) Motion.dialogIn(els.confirmDialog);
    });
  }

  // Ponte usada por admin.js (e pelo planejador) para notificar e confirmar ações.
  window.OmniUI = {
    toast,
    confirmAction,
    render,
    openTask: (task) => openTaskDialog(task),
  };

  /* =========================================================
     Formulário de criação / edição (RF-01 e RF-02)
     ========================================================= */
  function clearValidation() {
    els.taskTitleError.textContent = "";
    els.taskTitle.removeAttribute("aria-invalid");
    els.taskDescription.removeAttribute("aria-invalid");
  }

  function showValidation(errors) {
    clearValidation();

    if (errors.title) {
      els.taskTitleError.textContent = errors.title;
      els.taskTitle.setAttribute("aria-invalid", "true");
      els.taskTitle.focus();
    } else if (errors.description) {
      els.taskDescription.setAttribute("aria-invalid", "true");
      els.taskDescription.focus();
    }

    if (errors.form) toast(errors.form, "error");
  }

  function updateCounters() {
    const titleLen = els.taskTitle.value.length;
    els.taskTitleCounter.textContent = `${titleLen}/100`;
    els.taskTitleCounter.classList.toggle("is-max", titleLen >= 100);

    const descLen = els.taskDescription.value.length;
    els.taskDescriptionCounter.textContent = `${descLen}/500`;
    els.taskDescriptionCounter.classList.toggle("is-max", descLen >= 500);
  }

  function resetForm() {
    els.taskForm.reset();
    els.taskPriority.value = "media";
    els.taskCategory.value = "outros";
    els.taskStatus.value = "todo";
    els.taskDueDate.value = "";
    clearValidation();
    updateCounters();
  }

  function openTaskDialog(task = null) {
    lastFocused = document.activeElement;
    editingId = task ? task.id : null;
    resetForm();

    els.taskDialogTitle.textContent = task ? "Editar tarefa" : "Nova tarefa";

    if (task) {
      els.taskTitle.value = task.title;
      els.taskDescription.value = task.description;
      els.taskPriority.value = task.priority;
      els.taskCategory.value = task.category;
      els.taskDueDate.value = task.dueDate;
      els.taskStatus.value = task.status;
      updateCounters();
    }

    els.taskDialog.showModal();
    if (Motion) Motion.dialogIn(els.taskDialog);
    setTimeout(() => els.taskTitle.focus(), 40);
  }

  function closeTaskDialog() {
    els.taskDialog.close();
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const data = {
      title: els.taskTitle.value,
      description: els.taskDescription.value,
      priority: els.taskPriority.value,
      category: els.taskCategory.value,
      dueDate: els.taskDueDate.value,
      status: els.taskStatus.value,
    };

    const isEditing = Boolean(editingId);
    const result = isEditing ? Tasks.update(editingId, data) : Tasks.create(data);

    if (!result.ok) {
      showValidation(result.errors);
      return;
    }

    clearValidation();
    closeTaskDialog();

    if (result.saved === false) {
      toast("Tarefa gravada apenas em memória: o navegador bloqueou o armazenamento local.", "error");
    } else {
      toast(
        isEditing ? "Tarefa atualizada com sucesso." : "Tarefa criada com sucesso.",
        "success"
      );
    }

    editingId = null;
  }

  /* =========================================================
     Cartões de tarefa
     ========================================================= */
  function buildCard(task) {
    const overdue = Utils.isOverdue(task);
    const done = task.status === "done";

    const card = Utils.el("article", {
      className: [
        "task-card",
        `task-card--${task.priority}`,
        done ? "task-card--done" : "",
        overdue ? "task-card--overdue" : "",
      ]
        .filter(Boolean)
        .join(" "),
      attrs: { role: "listitem", "data-id": task.id },
    });

    /* Linha superior: prioridade + categoria */
    const top = Utils.el("div", { className: "task-card__top" });
    top.appendChild(
      Utils.el("span", {
        className: `badge badge--${task.priority}`,
        text: `Prioridade ${Utils.labels.priority[task.priority]}`,
      })
    );
    top.appendChild(
      Utils.el("span", {
        className: "badge badge--cat",
        text: Utils.labels.category[task.category],
      })
    );
    if (task.status === "in_progress") {
      top.appendChild(Utils.el("span", { className: "badge badge--doing", text: "Em andamento" }));
    }
    card.appendChild(top);

    /* Título e descrição */
    card.appendChild(Utils.el("h4", { className: "task-card__title", text: task.title }));

    if (task.description) {
      card.appendChild(Utils.el("p", { className: "task-card__desc", text: task.description }));
    }

    /* Metadados: prazo e indicador de atraso */
    if (task.dueDate) {
      const meta = Utils.el("div", { className: "task-card__meta" });
      const due = Utils.el("span", {
        className: overdue
          ? "meta-item meta-item--overdue"
          : Utils.isDueToday(task) && !done
            ? "meta-item meta-item--today"
            : "meta-item",
      });
      due.innerHTML = Utils.icons.calendar;
      due.appendChild(document.createTextNode(` Prazo: ${Utils.formatDue(task.dueDate)}`));

      if (overdue) {
        const flag = Utils.el("span", { className: "meta-item meta-item--overdue" });
        flag.innerHTML = Utils.icons.alert;
        flag.appendChild(document.createTextNode(" Atrasada"));
        meta.appendChild(due);
        meta.appendChild(flag);
      } else {
        meta.appendChild(due);
      }
      card.appendChild(meta);
    }

    /* Rodapé: avanço de status + editar/excluir */
    const footer = Utils.el("div", { className: "task-card__footer" });

    const next = Tasks.nextStatus(task.status);
    const advanceLabel =
      task.status === "todo" ? "Iniciar" : task.status === "in_progress" ? "Concluir" : "Reabrir";
    const advanceIcon =
      task.status === "todo"
        ? Utils.icons.play
        : task.status === "in_progress"
          ? Utils.icons.check
          : Utils.icons.reopen;

    const advanceBtn = Utils.el("button", {
      className: `btn btn--sm ${task.status === "done" ? "btn--reopen" : "btn--advance"}`,
      attrs: { type: "button", "aria-label": `${advanceLabel} tarefa: ${task.title}` },
    });
    advanceBtn.innerHTML = advanceIcon;
    advanceBtn.appendChild(document.createTextNode(` ${advanceLabel}`));
    advanceBtn.addEventListener("click", () => changeStatus(task, next));
    footer.appendChild(advanceBtn);

    const actions = Utils.el("div", { className: "task-card__actions" });
    actions.appendChild(buildTaskMenu(task));

    footer.appendChild(actions);
    card.appendChild(footer);

    return card;
  }

  /* =========================================================
     Menu de ações por tarefa (BoardUI dropdown em JS puro)
     ========================================================= */
  let openTaskMenu = null;

  function closeTaskMenu() {
    if (!openTaskMenu) return;
    openTaskMenu.button.setAttribute("aria-expanded", "false");
    openTaskMenu.card.classList.remove("has-menu");
    openTaskMenu.node.remove();
    openTaskMenu = null;
  }

  function buildTaskMenu(task) {
    const wrap = Utils.el("div", { className: "menu-wrap" });

    const button = Utils.el("button", {
      className: "icon-btn",
      attrs: {
        type: "button",
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        "aria-label": `Mais ações da tarefa: ${task.title}`,
        title: "Mais ações",
      },
    });
    button.innerHTML = Utils.icons.more;

    function buildMenu() {
      const menu = Utils.el("div", { className: "menu", attrs: { role: "menu" } });

      const addItem = (label, options = {}) => {
        const item = Utils.el("button", {
          className: [
            "menu__item",
            options.danger ? "menu__item--danger" : "",
            options.current ? "menu__item--current" : "",
          ]
            .filter(Boolean)
            .join(" "),
          attrs: { type: "button", role: "menuitem" },
          text: label,
        });

        if (options.current) {
          item.disabled = true;
          item.setAttribute("aria-current", "true");
        } else {
          item.addEventListener("click", () => {
            closeTaskMenu();
            options.onClick();
          });
        }

        menu.appendChild(item);
      };

      addItem("Editar tarefa", { onClick: () => openTaskDialog(task) });

      menu.appendChild(Utils.el("div", { className: "menu__sep", attrs: { role: "separator" } }));
      menu.appendChild(Utils.el("p", { className: "menu__label", text: "Mover para" }));

      for (const [status, label] of Object.entries(Utils.labels.status)) {
        addItem(label, {
          current: task.status === status,
          onClick: () => changeStatus(task, status),
        });
      }

      menu.appendChild(Utils.el("div", { className: "menu__sep", attrs: { role: "separator" } }));
      addItem("Excluir tarefa", { danger: true, onClick: () => deleteTask(task) });

      /* Teclado: setas navegam, Escape fecha e devolve o foco. */
      menu.addEventListener("keydown", (event) => {
        const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).filter(
          (el) => !el.disabled
        );
        const index = items.indexOf(document.activeElement);

        if (event.key === "ArrowDown") {
          event.preventDefault();
          items[(index + 1) % items.length].focus();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          items[(index - 1 + items.length) % items.length].focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeTaskMenu();
          button.focus();
        } else if (event.key === "Tab") {
          closeTaskMenu();
        }
      });

      return menu;
    }

    button.addEventListener("click", () => {
      const wasOpen = openTaskMenu && openTaskMenu.button === button;
      closeTaskMenu();
      if (wasOpen) return;

      const menu = buildMenu();
      const card = wrap.closest(".task-card");
      wrap.appendChild(menu);
      if (card) card.classList.add("has-menu"); // evita o recorte (overflow: hidden)

      openTaskMenu = { button, node: menu, card };
      button.setAttribute("aria-expanded", "true");

      const first = menu.querySelector('[role="menuitem"]:not(:disabled)');
      if (first) first.focus();
    });

    wrap.appendChild(button);
    return wrap;
  }

  /* =========================================================
     Ações nas tarefas
     ========================================================= */
  function changeStatus(task, status) {
    const result = Tasks.setStatus(task.id, status);
    if (!result.ok) {
      toast("Não foi possível alterar o status da tarefa.", "error");
      return;
    }

    const label = Utils.labels.status[status];
    toast(
      result.saved === false
        ? `Status alterado para "${label}", mas o armazenamento local falhou.`
        : `Tarefa marcada como "${label}".`,
      result.saved === false ? "error" : "success"
    );
  }

  async function deleteTask(task) {
    const confirmed = await confirmAction({
      title: "Excluir tarefa?",
      text: `A tarefa "${task.title}" será removida definitivamente. Esta ação não poderá ser desfeita.`,
      confirmLabel: "Excluir",
    });

    if (!confirmed) return; // Ao cancelar, a tarefa permanece.

    const result = Tasks.remove(task.id);
    if (!result.ok) {
      toast("Não foi possível excluir a tarefa.", "error");
      return;
    }

    toast(
      result.saved === false
        ? "Tarefa removida, mas o armazenamento local falhou."
        : "Tarefa excluída com sucesso.",
      result.saved === false ? "error" : "success"
    );
  }

  /* =========================================================
     Ordenação e renderização do quadro
     ========================================================= */
  function defaultSort(a, b) {
    const aLate = Utils.isOverdue(a);
    const bLate = Utils.isOverdue(b);
    if (aLate !== bLate) return aLate ? -1 : 1;

    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    const priority = STATUS_ORDER[a.priority] - STATUS_ORDER[b.priority];
    if (priority !== 0) return priority;

    return b.createdAt.localeCompare(a.createdAt);
  }

  /** Ordenações oferecidas na interface (além do padrão por prazo). */
  const SORTERS = {
    due: defaultSort,
    priority: (a, b) =>
      STATUS_ORDER[a.priority] - STATUS_ORDER[b.priority] || defaultSort(a, b),
    title: (a, b) => a.title.localeCompare(b.title, "pt-BR"),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };

  function sortForColumn(list) {
    return [...list].sort(SORTERS[sortBy] || defaultSort);
  }

  function renderBoard(filtered) {
    const total = Tasks.getAll().length;
    const filtering = Filters.isActive();

    const emptyGlobal = total === 0;
    const emptyResult = total > 0 && filtered.length === 0;

    els.board.hidden = emptyGlobal || emptyResult;
    els.emptyState.hidden = !(emptyGlobal || emptyResult);

    if (emptyGlobal || emptyResult) {
      // Esvazia as colunas para não deixar cartões de outra conta
      // (ou de um filtro anterior) no DOM, mesmo com o quadro oculto.
      for (const column of Object.values(COLUMNS)) {
        column.container.replaceChildren();
        column.count.textContent = "0";
      }
    }

    if (emptyGlobal) {
      els.emptyStateTitle.textContent = "Nenhuma tarefa por aqui";
      els.emptyStateText.textContent = "Crie sua primeira tarefa e comece a organizar seu dia.";
      els.emptyStateBtn.textContent = "Criar primeira tarefa";
      els.emptyStateBtn.dataset.action = "create";
      return;
    }

    if (emptyResult) {
      els.emptyStateTitle.textContent = "Nenhum resultado encontrado";
      els.emptyStateText.textContent = filtering
        ? "Nenhuma tarefa corresponde à pesquisa ou aos filtros aplicados."
        : "Não há tarefas para exibir.";
      els.emptyStateBtn.textContent = "Limpar filtros";
      els.emptyStateBtn.dataset.action = "clear";
      if (Motion) Motion.popIn("#emptyState");
      return;
    }

    const byStatus = { todo: [], in_progress: [], done: [] };
    filtered.forEach((task) => byStatus[task.status].push(task));

    const cards = [];

    for (const [status, column] of Object.entries(COLUMNS)) {
      const sorted = sortForColumn(byStatus[status]);
      column.count.textContent = String(sorted.length);

      const fragment = document.createDocumentFragment();

      if (sorted.length === 0) {
        fragment.appendChild(
          Utils.el("p", {
            className: "column__empty",
            text: filtering
              ? "Nenhuma tarefa corresponde aos filtros."
              : "Nenhuma tarefa nesta coluna.",
          })
        );
      } else {
        // Paginação por coluna: exibe PAGE_SIZE cartões por vez.
        const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
        const page = Math.min(Math.max(columnPages[status], 1), pageCount);
        columnPages[status] = page;

        const start = (page - 1) * PAGE_SIZE;
        sorted.slice(start, start + PAGE_SIZE).forEach((task) => {
          const card = buildCard(task);
          fragment.appendChild(card);
          cards.push(card);
        });

        if (pageCount > 1) {
          fragment.appendChild(buildPager(status, page, pageCount));
        }
      }

      column.container.replaceChildren(fragment);
    }

    if (Motion) Motion.cardsIn(cards);
  }

  /** Controles ‹ página/atual › no pé de cada coluna. */
  function buildPager(status, page, pageCount) {
    const pager = Utils.el("nav", {
      className: "column__pager",
      attrs: { "aria-label": `Paginação: ${Utils.labels.status[status]}` },
    });

    const go = (target) => {
      columnPages[status] = target;
      render();
    };

    const prev = Utils.el("button", {
      className: "pager-btn",
      attrs: { type: "button", "aria-label": "Página anterior" },
      text: "‹",
    });
    prev.disabled = page <= 1;
    prev.addEventListener("click", () => go(page - 1));

    const next = Utils.el("button", {
      className: "pager-btn",
      attrs: { type: "button", "aria-label": "Próxima página" },
      text: "›",
    });
    next.disabled = page >= pageCount;
    next.addEventListener("click", () => go(page + 1));

    pager.appendChild(prev);
    pager.appendChild(
      Utils.el("span", {
        className: "pager__label",
        text: `${page} / ${pageCount}`,
        attrs: { "aria-live": "polite" },
      })
    );
    pager.appendChild(next);
    return pager;
  }

  /** Exibe um valor numérico no indicador; o BoardUI troca o número por
      crossfade (220ms), sem contagem progressiva. */
  function setStat(element, value, suffix = "") {
    const text = `${value}${suffix}`;
    if (element.textContent === text) return;

    if (Motion && Motion.numberFade) {
      Motion.numberFade(element, text);
    } else {
      element.textContent = text;
    }
  }

  function renderDashboard(metrics) {
    setStat(els.statTotal, metrics.total);
    setStat(els.statTodo, metrics.todo);
    setStat(els.statDoing, metrics.doing);
    setStat(els.statDone, metrics.done);
    setStat(els.statLate, metrics.late);
    setStat(els.statPercent, metrics.percent, "%");

    els.progressLabel.textContent = `${metrics.percent}% concluído`;
    els.progressFill.style.width = `${metrics.percent}%`;
    els.progressBar.setAttribute(
      "aria-label",
      `${metrics.percent}% das tarefas concluídas`
    );

    els.navCountAll.textContent = metrics.total;
    els.navCountTodo.textContent = metrics.todo;
    els.navCountDoing.textContent = metrics.doing;
    els.navCountDone.textContent = metrics.done;

    if (metrics.total === 0) {
      els.dashboardSubtitle.textContent = "Nenhuma tarefa cadastrada ainda.";
    } else if (metrics.late > 0) {
      els.dashboardSubtitle.textContent = `${metrics.late} tarefa${metrics.late > 1 ? "s" : ""} atrasada${metrics.late > 1 ? "s" : ""} — atenção aos prazos.`;
    } else {
      els.dashboardSubtitle.textContent = `${metrics.total} tarefa${metrics.total > 1 ? "s" : ""} no quadro. Tudo em dia!`;
    }
  }

  /* =========================================================
     Renderização geral
     ========================================================= */
  function render() {
    // Indicadores sempre consideram o conjunto completo (regra de negócio 10).
    renderDashboard(Dashboard.compute(Tasks.getAll()));

    const filtered = Filters.apply(Tasks.getAll());
    els.filtersResult.textContent =
      filtered.length === Tasks.getAll().length
        ? `${filtered.length} tarefa${filtered.length === 1 ? "" : "s"} exibida${filtered.length === 1 ? "" : "s"}`
        : `${filtered.length} de ${Tasks.getAll().length} tarefas exibidas`;

    if (currentView === "planner") {
      els.board.hidden = true;
      els.emptyState.hidden = true;
      els.planner.hidden = false;
      if (window.OmniPlanner) window.OmniPlanner.render(filtered);
      return;
    }

    els.planner.hidden = true;
    renderBoard(filtered);
  }

  /** Alterna entre o quadro kanban e o planejador de prazos. */
  function setView(view) {
    currentView = view === "planner" ? "planner" : "board";

    const isBoard = currentView === "board";
    els.viewBoardBtn.classList.toggle("is-active", isBoard);
    els.viewBoardBtn.setAttribute("aria-pressed", String(isBoard));
    els.viewPlannerBtn.classList.toggle("is-active", !isBoard);
    els.viewPlannerBtn.setAttribute("aria-pressed", String(!isBoard));

    render();
  }

  /* =========================================================
     Filtros e pesquisa
     ========================================================= */
  function syncFilterControls() {
    const state = Filters.get();
    els.filterStatus.value = state.status;
    els.filterPriority.value = state.priority;
    els.filterCategory.value = state.category;
    els.filterDue.value = state.due;

    if (els.searchInput.value !== state.search) {
      els.searchInput.value = state.search;
    }
    els.searchClear.hidden = !state.search;
  }

  function setNavActive(name) {
    currentNav = name;
    els.navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.nav === name);
      item.setAttribute("aria-current", item.dataset.nav === name ? "page" : "false");
    });
  }

  function scrollTo(target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindFilters() {
    els.filtersForm.addEventListener("submit", (event) => event.preventDefault());

    els.filterStatus.addEventListener("change", () => {
      Filters.set({ status: els.filterStatus.value });
      setNavActive(els.filterStatus.value || "all");
    });
    els.filterPriority.addEventListener("change", () =>
      Filters.set({ priority: els.filterPriority.value })
    );
    els.filterCategory.addEventListener("change", () =>
      Filters.set({ category: els.filterCategory.value })
    );
    els.filterDue.addEventListener("change", () => Filters.set({ due: els.filterDue.value }));

    // Ordenação: é apresentação, não filtro — não entra no "Limpar filtros".
    els.filterSort.addEventListener("change", () => {
      sortBy = els.filterSort.value || SORT_DEFAULT;
      resetColumnPages();
      render();
    });

    els.clearFiltersBtn.addEventListener("click", () => {
      Filters.clear();
      setNavActive("all");
    });

    const applySearch = Utils.debounce(() => {
      Filters.set({ search: els.searchInput.value.trim() });
    }, 200);

    els.searchInput.addEventListener("input", () => {
      els.searchClear.hidden = !els.searchInput.value;
      applySearch();
    });

    els.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        Filters.set({ search: els.searchInput.value.trim() });
      }
    });

    els.searchClear.addEventListener("click", () => {
      els.searchInput.value = "";
      Filters.set({ search: "" });
      els.searchInput.focus();
    });
  }

  /* =========================================================
     Menu lateral
     ========================================================= */
  function openSidebar() {
    els.sidebar.classList.add("is-open");
    els.sidebarOverlay.hidden = false;
    els.sidebarOpen.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    els.sidebar.classList.remove("is-open");
    els.sidebarOverlay.hidden = true;
    els.sidebarOpen.setAttribute("aria-expanded", "false");
  }

  function bindSidebar() {
    els.sidebarOpen.addEventListener("click", openSidebar);
    els.sidebarClose.addEventListener("click", closeSidebar);
    els.sidebarOverlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && els.sidebar.classList.contains("is-open")) closeSidebar();
    });

    els.navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const target = item.dataset.nav;
        setNavActive(target);
        closeSidebar();

        switch (target) {
          case "overview":
            Filters.set({ status: "" });
            scrollTo(document.querySelector(".dashboard"));
            break;
          case "all":
            Filters.set({ status: "" });
            scrollTo(document.querySelector(".tasks-area"));
            break;
          case "categories":
            scrollTo(document.querySelector(".filters"));
            setTimeout(() => els.filterCategory.focus(), 350);
            break;
          default:
            Filters.set({ status: target });
            scrollTo(document.querySelector(".tasks-area"));
        }
      });
    });
  }

  /* =========================================================
     Sessão (auth.js) — o aplicativo é aberto por conta
     ========================================================= */
  function initialsOf(user) {
    const source = Utils.cleanText(user.name) || String(user.email || "").split("@")[0] || "?";
    const parts = source.split(" ").filter(Boolean);
    const letters = (parts[0] || "?").charAt(0) + (parts[1] ? parts[1].charAt(0) : "");
    return letters.toUpperCase();
  }

  function renderSessionUser(user) {
    els.userAvatar.textContent = initialsOf(user);
    els.userName.textContent = user.name;
    els.userEmail.textContent = user.email;
    els.userEmail.title = user.email;
    els.userRole.hidden = user.role !== "admin";
  }

  function clearSessionUser() {
    els.userAvatar.textContent = "?";
    els.userName.textContent = "—";
    els.userEmail.textContent = "—";
    els.userEmail.removeAttribute("title");
    els.userRole.hidden = true;
  }

  function loadTasksFor(user) {
    const legacyOwner = Auth.getAdminId();
    const { tasks, warning } = Storage.load(user.id, legacyOwner);
    Tasks.init(tasks, user.id, legacyOwner); // dispara render()
    if (warning) showStorageWarning(warning);
  }

  function applySession(user) {
    if (!user) {
      // Encerrou a sessão: volta para a tela de acesso e limpa o estado.
      els.app.hidden = true;
      els.authView.hidden = false;
      Tasks.init([], null, null);
      Filters.clear();
      clearSessionUser();
      if (window.OmniAdmin) window.OmniAdmin.unmount();
      closeSidebar();
      return;
    }

    els.authView.hidden = true;
    els.app.hidden = false;

    renderSessionUser(user);
    loadTasksFor(user);
    if (window.OmniAdmin) window.OmniAdmin.mount(user);

    if (Motion) {
      Motion.appIn(els.app);
      Motion.statsIn();
    }
  }

  /* =========================================================
     Inicialização
     ========================================================= */
  function showStorageWarning(code) {
    const messages = {
      storage_unavailable: "O armazenamento local não está disponível neste navegador.",
      storage_read_error: "Não foi possível ler as tarefas salvas neste navegador.",
      storage_corrupted:
        "Os dados salvos estavam inválidos e foram ignorados para evitar falhas na aplicação.",
      storage_invalid_data:
        "Alguns dados salvos estavam corrompidos e foram removidos automaticamente.",
    };

    if (code === "storage_unavailable") {
      els.storageWarning.hidden = false;
    }

    if (messages[code]) {
      toast(messages[code], code === "storage_unavailable" ? "error" : "info");
    }
  }

  function bindGlobalEvents() {
    els.newTaskBtn.addEventListener("click", () => openTaskDialog());

    // Alternância entre quadro e planejador.
    els.viewBoardBtn.addEventListener("click", () => setView("board"));
    els.viewPlannerBtn.addEventListener("click", () => setView("planner"));

    // Fecha o menu de ações ao clicar fora ou pressionar Escape.
    document.addEventListener("pointerdown", (event) => {
      if (!openTaskMenu) return;
      if (openTaskMenu.node.contains(event.target)) return;
      if (openTaskMenu.button.contains(event.target)) return;
      closeTaskMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !openTaskMenu) return;
      const button = openTaskMenu.button;
      closeTaskMenu();
      button.focus();
    });

    if (els.logoutBtn) {
      els.logoutBtn.addEventListener("click", async () => {
        const confirmed = await confirmAction({
          title: "Sair da conta?",
          text: "Sua sessão local será encerrada. As tarefas continuam salvas neste navegador.",
          confirmLabel: "Sair",
        });
        if (confirmed) Auth.signOut();
      });
    }

    els.emptyStateBtn.addEventListener("click", () => {
      if (els.emptyStateBtn.dataset.action === "clear") {
        Filters.clear();
        setNavActive("all");
      } else {
        openTaskDialog();
      }
    });

    els.taskForm.addEventListener("submit", handleFormSubmit);
    els.taskCancel.addEventListener("click", closeTaskDialog);
    els.modalClose.addEventListener("click", closeTaskDialog);
    els.taskTitle.addEventListener("input", () => {
      updateCounters();
      if (els.taskTitle.getAttribute("aria-invalid")) {
        els.taskTitleError.textContent = "";
        els.taskTitle.removeAttribute("aria-invalid");
      }
    });
    els.taskDescription.addEventListener("input", updateCounters);

    // Descarta alterações não salvas ao fechar o formulário.
    els.taskDialog.addEventListener("close", () => {
      editingId = null;
      clearValidation();
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    });

    // Fecha ao clicar fora (backdrop).
    els.taskDialog.addEventListener("click", (event) => {
      if (event.target === els.taskDialog) closeTaskDialog();
    });
    els.confirmDialog.addEventListener("click", (event) => {
      if (event.target === els.confirmDialog) els.confirmDialog.close();
    });
  }

  async function init() {
    els.todayLabel.textContent = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });

    Tasks.onChange(render);
    Filters.onChange((state) => {
      syncFilterControls();
      resetColumnPages(); // novos resultados voltam à primeira página
      render();
    });

    bindFilters();
    bindSidebar();
    bindGlobalEvents();
    syncFilterControls();
    setNavActive("overview");

    Storage.checkAvailability();

    // A tela de acesso é gerenciada por auth.js; aqui só reagimos à sessão.
    Auth.onChange(applySession);
    const session = await Auth.init(); // semeia a conta admin e restaura a sessão
    applySession(session);

    if (!Storage.isAvailable()) showStorageWarning("storage_unavailable");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
