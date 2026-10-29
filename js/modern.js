/* =========================================================
   modern.js — Tema claro/escuro/automático e arrastar-e-soltar
   Carregado depois de app.js; usa Tasks (tasks.js) e OmniUI (app.js).
   ========================================================= */

(() => {
  "use strict";

  const THEME_KEY = "omnitask_theme";
  const root = document.documentElement;
  const STATUS_LABEL = { todo: "A fazer", in_progress: "Em andamento", done: "Concluídas" };

  /* ---------- Tema: automático (padrão) → claro → escuro ---------- */
  const THEME_ORDER = ["auto", "light", "dark"];
  const THEME_LABEL = { auto: "automático", light: "claro", dark: "escuro" };
  const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function readTheme() {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (THEME_ORDER.includes(saved)) return saved;
    } catch (_) { /* armazenamento indisponível: automático */ }
    return "auto"; // por padrão, respeita a preferência do sistema
  }

  function nextMode(mode) {
    return THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length] || "auto";
  }

  function isDark(mode) {
    return mode === "dark" || (mode === "auto" && schemeQuery.matches);
  }

  function applyTheme(mode) {
    const dark = isDark(mode);
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";

    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.dataset.mode = mode;
      btn.setAttribute(
        "aria-label",
        `Tema ${THEME_LABEL[mode]} — ativar tema ${THEME_LABEL[nextMode(mode)]}`
      );
      btn.title = `Tema: ${THEME_LABEL[mode]} (clique para alternar)`;
    }
  }

  function mountThemeToggle() {
    const newTask = document.getElementById("newTaskBtn");
    if (!newTask || document.getElementById("themeToggle")) return;

    // Ícones fixos (SVG estático, sem dados do usuário).
    const btn = document.createElement("button");
    btn.id = "themeToggle";
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.innerHTML =
      '<svg class="icon-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' +
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

    btn.addEventListener("click", () => {
      const next = nextMode(btn.dataset.mode || readTheme());
      applyTheme(next);
      try { window.localStorage.setItem(THEME_KEY, next); } catch (_) { /* ignora */ }
    });

    newTask.parentNode.insertBefore(btn, newTask);
    applyTheme(btn.dataset.mode || readTheme());
  }

  /* No modo automático, acompanha mudanças da preferência do sistema. */
  const onSchemeChange = () => {
    if (readTheme() === "auto") applyTheme("auto");
  };
  if (typeof schemeQuery.addEventListener === "function") {
    schemeQuery.addEventListener("change", onSchemeChange);
  }

  /* ---------- Arrastar e soltar ---------- */
  const board = document.getElementById("board");
  let dragId = null;

  function markDraggable(scope) {
    scope.querySelectorAll(".task-card:not([draggable])").forEach((card) => {
      card.setAttribute("draggable", "true");
    });
  }

  function clearOver() {
    if (!board) return;
    board.querySelectorAll(".column.is-over").forEach((c) => c.classList.remove("is-over"));
  }

  function bindBoard() {
    if (!board) return;

    // Cartões são recriados a cada render: marca como arrastáveis sempre que surgirem.
    markDraggable(board);
    new MutationObserver(() => markDraggable(board)).observe(board, { childList: true, subtree: true });

    board.addEventListener("dragstart", (event) => {
      const card = event.target.closest && event.target.closest(".task-card");
      if (!card) return;
      dragId = card.dataset.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragId);
      card.classList.add("is-dragging");
    });

    board.addEventListener("dragend", (event) => {
      const card = event.target.closest && event.target.closest(".task-card");
      if (card) card.classList.remove("is-dragging");
      clearOver();
      dragId = null;
    });

    board.addEventListener("dragover", (event) => {
      const column = event.target.closest && event.target.closest(".column");
      if (!column || !dragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (!column.classList.contains("is-over")) {
        clearOver();
        column.classList.add("is-over");
      }
    });

    board.addEventListener("dragleave", (event) => {
      const column = event.target.closest && event.target.closest(".column");
      if (column && !column.contains(event.relatedTarget)) column.classList.remove("is-over");
    });

    board.addEventListener("drop", (event) => {
      const column = event.target.closest && event.target.closest(".column");
      const id = dragId || event.dataTransfer.getData("text/plain");
      clearOver();
      if (!column || !id || typeof Tasks === "undefined" || !window.OmniUI) return;
      event.preventDefault();

      const status = column.dataset.status;
      const task = Tasks.get(id);
      if (!task || task.status === status) return;

      const result = Tasks.setStatus(id, status);
      if (!result || !result.ok) {
        OmniUI.toast("Não foi possível mover a tarefa.", "error");
        return;
      }
      OmniUI.render();
      OmniUI.toast(
        result.saved === false
          ? `Tarefa movida para "${STATUS_LABEL[status]}", mas o armazenamento local falhou.`
          : `Tarefa movida para "${STATUS_LABEL[status]}".`,
        result.saved === false ? "error" : "success"
      );
    });
  }

  /* Aplica o tema o quanto antes, para evitar flash ao carregar. */
  applyTheme(readTheme());

  document.addEventListener("DOMContentLoaded", () => {
    mountThemeToggle();
    bindBoard();
  });
})();
