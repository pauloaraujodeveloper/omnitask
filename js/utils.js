/* =========================================================
   utils.js — Funções auxiliares reutilizáveis
   ========================================================= */

const Utils = (() => {
  /** Gera um identificador único para a tarefa. */
  function uid() {
    return "task_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Data local atual no formato ISO de data (YYYY-MM-DD), sem fuso. */
  function todayISO() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }

  /** Converte YYYY-MM-DD em DD/MM/AAAA (sem conversão de fuso horário). */
  function formatDue(iso) {
    if (!iso || typeof iso !== "string") return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return "";
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  /** Data/hora local no formato legível (pt-BR). */
  function formatDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /** Normaliza texto para buscas: minúsculas, sem acentos e sem espaços extras. */
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  /** Remove espaços das extremidades e colapsa espaços repetidos. */
  function cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  /** Verifica se a tarefa está atrasada (prazo vencido e não concluída). */
  function isOverdue(task) {
    if (!task.dueDate || task.status === "done") return false;
    return task.dueDate < todayISO();
  }

  /** Verifica se o prazo vence hoje. */
  function isDueToday(task) {
    return Boolean(task.dueDate) && task.dueDate === todayISO();
  }

  /** Atrasadas dentro dos próximos 7 dias (inclui hoje). */
  function isDueThisWeek(task) {
    if (!task.dueDate || task.status === "done") return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 7);
    const due = new Date(task.dueDate + "T00:00:00");
    return due >= now && due <= limit;
  }

  /** Cria um elemento DOM com texto/atributos de forma segura (textContent). */
  function el(tag, options = {}, children = []) {
    const node = document.createElement(tag);

    if (options.className) node.className = options.className;
    if (options.text != null) node.textContent = options.text;
    if (options.attrs) {
      for (const [name, value] of Object.entries(options.attrs)) {
        node.setAttribute(name, value);
      }
    }

    (Array.isArray(children) ? children : [children]).forEach((child) => {
      if (child == null) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });

    return node;
  }

  /** Adia a execução da função (útil para a pesquisa). */
  function debounce(fn, delay = 220) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /** Ícones SVG fixos (nunca provenientes do usuário). */
  const icons = {
    calendar:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>',
    alert:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    edit:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    play:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l14 9-14 9z"/></svg>',
    reopen:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    more:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  };

  /** Rótulos apresentados na interface (em português). */
  const labels = {
    status: { todo: "A fazer", in_progress: "Em andamento", done: "Concluída" },
    priority: { alta: "Alta", media: "Média", baixa: "Baixa" },
    category: {
      trabalho: "Trabalho",
      estudos: "Estudos",
      pessoal: "Pessoal",
      saude: "Saúde",
      financas: "Finanças",
      outros: "Outros",
    },
  };

  return {
    labels,
    uid,
    todayISO,
    formatDue,
    formatDateTime,
    normalize,
    cleanText,
    isOverdue,
    isDueToday,
    isDueThisWeek,
    el,
    debounce,
    icons,
  };
})();
