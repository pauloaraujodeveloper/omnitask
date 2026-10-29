/* =========================================================
   planner.js — Planejador de prazos (visão mensal ou semanal)
   Mostra as tarefas nos dias dos seus prazos, com navegação
   por período. Recebe a lista já filtrada por app.js.
   Usa apenas tokens BoardUI (css/components.css + modern.css).
   ========================================================= */

window.OmniPlanner = (() => {
  "use strict";

  const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 };

  const els = {};
  let mode = "month"; // "month" | "week"
  let anchor = null; // Data de referência do período exibido
  let lastTasks = [];

  /* ---------- Utilidades de data (sem conversão de fuso) ---------- */
  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isoOf(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function weekStart(date) {
    return addDays(date, -date.getDay()); // domingo
  }

  function sameDay(a, b) {
    return isoOf(a) === isoOf(b);
  }

  /** Células do mês: semanas completas (domingo a sábado). */
  function monthCells(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(date.getFullYear(), date.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }

  /** Título legível do período (pt-BR, semântica de data local). */
  function titleText() {
    if (mode === "month") {
      return anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }

    const start = weekStart(anchor);
    const end = addDays(start, 6);
    const monthYear = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} de ${monthYear}`;
    }
    return `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })} – ${end.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
  }

  /* ---------- Peças da interface ---------- */
  function byPriorityThenTitle(a, b) {
    return (
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      a.title.localeCompare(b.title, "pt-BR")
    );
  }

  /** Chip de tarefa no calendário; clique abre o formulário de edição. */
  function chipFor(task) {
    const chip = Utils.el("button", {
      className: [
        "planner__chip",
        `planner__chip--${task.priority}`,
        task.status === "done" ? "planner__chip--done" : "",
      ]
        .filter(Boolean)
        .join(" "),
      attrs: {
        type: "button",
        title: `${task.title} — ${Utils.labels.status[task.status]}`,
      },
      text: task.title,
    });
    chip.addEventListener("click", () => {
      if (window.OmniUI && OmniUI.openTask) OmniUI.openTask(task);
    });
    return chip;
  }

  function groupByDate(tasks) {
    const byDate = {};
    const noDue = [];

    for (const task of tasks) {
      if (!task.dueDate) {
        noDue.push(task);
        continue;
      }
      if (!byDate[task.dueDate]) byDate[task.dueDate] = [];
      byDate[task.dueDate].push(task);
    }

    return { byDate, noDue };
  }

  /* ---------- Visão mensal ---------- */
  function renderMonth(byDate) {
    const wrap = Utils.el("div", { className: "planner__month" });

    const weekdayRow = Utils.el("div", {
      className: "planner__weekdays",
      attrs: { "aria-hidden": "true" },
    });
    WEEKDAYS.forEach((label) => weekdayRow.appendChild(Utils.el("span", { text: label })));
    wrap.appendChild(weekdayRow);

    const grid = Utils.el("div", {
      className: "planner__grid",
      attrs: { "aria-label": `Tarefas com prazo em ${titleText()}` },
    });
    const todayISO = Utils.todayISO();

    monthCells(anchor).forEach((date) => {
      if (!date) {
        grid.appendChild(Utils.el("div", { className: "planner__cell planner__cell--pad" }));
        return;
      }

      const iso = isoOf(date);
      const dayTasks = (byDate[iso] || []).sort(byPriorityThenTitle);
      const cell = Utils.el("div", {
        className: `planner__cell${iso === todayISO ? " planner__cell--today" : ""}`,
        attrs: {
          "aria-label": date.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          }),
        },
      });

      cell.appendChild(Utils.el("span", { className: "planner__daynum", text: String(date.getDate()) }));
      dayTasks.slice(0, 3).forEach((task) => cell.appendChild(chipFor(task)));
      if (dayTasks.length > 3) {
        cell.appendChild(
          Utils.el("span", {
            className: "planner__more",
            text: `+${dayTasks.length - 3}`,
            attrs: { title: `${dayTasks.length - 3} tarefa(s) a mais neste dia` },
          })
        );
      }
      grid.appendChild(cell);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  /* ---------- Visão semanal ---------- */
  function renderWeek(byDate) {
    const wrap = Utils.el("div", { className: "planner__week" });
    const start = weekStart(anchor);
    const todayISO = Utils.todayISO();

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(start, i);
      const iso = isoOf(date);

      const column = Utils.el("div", {
        className: `planner__day${iso === todayISO ? " planner__day--today" : ""}`,
      });

      const head = Utils.el("div", { className: "planner__dayhead" });
      head.appendChild(Utils.el("span", { className: "planner__weekday", text: WEEKDAYS[i] }));
      head.appendChild(Utils.el("strong", { className: "planner__daynum", text: String(date.getDate()) }));
      column.appendChild(head);

      const dayTasks = (byDate[iso] || []).sort(byPriorityThenTitle);
      if (dayTasks.length === 0) {
        column.appendChild(Utils.el("p", { className: "planner__dayempty", text: "—" }));
      }
      dayTasks.forEach((task) => column.appendChild(chipFor(task)));

      wrap.appendChild(column);
    }

    return wrap;
  }

  /* ---------- Tarefas sem prazo ---------- */
  function renderNoDue(list) {
    const wrap = Utils.el("section", { className: "planner__nodue" });
    wrap.appendChild(
      Utils.el("h4", { className: "planner__nodue-title", text: `Sem prazo (${list.length})` })
    );

    if (list.length === 0) {
      wrap.appendChild(
        Utils.el("p", {
          className: "planner__dayempty",
          text: "Todas as tarefas exibidas têm prazo definido.",
        })
      );
      return wrap;
    }

    const row = Utils.el("div", { className: "planner__nodue-list" });
    list.sort(byPriorityThenTitle).forEach((task) => row.appendChild(chipFor(task)));
    wrap.appendChild(row);
    return wrap;
  }

  /* ---------- Renderização ---------- */
  function render(tasks) {
    if (!els.planner || !els.plannerBody) return;
    lastTasks = tasks;

    els.plannerTitle.textContent = titleText();

    els.modeMonth.classList.toggle("is-active", mode === "month");
    els.modeMonth.setAttribute("aria-pressed", String(mode === "month"));
    els.modeWeek.classList.toggle("is-active", mode === "week");
    els.modeWeek.setAttribute("aria-pressed", String(mode === "week"));

    const { byDate, noDue } = groupByDate(tasks);
    const body = document.createDocumentFragment();

    body.appendChild(mode === "month" ? renderMonth(byDate) : renderWeek(byDate));
    body.appendChild(renderNoDue(noDue));

    els.plannerBody.replaceChildren(body);
  }

  /* ---------- Navegação ---------- */
  function shift(delta) {
    if (mode === "month") {
      anchor = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
    } else {
      anchor = addDays(anchor, delta * 7);
    }
    render(lastTasks);
  }

  function setMode(next) {
    mode = next === "week" ? "week" : "month";
    render(lastTasks);
  }

  /* ---------- Inicialização ---------- */
  function init() {
    els.planner = document.getElementById("planner");
    els.plannerBody = document.getElementById("plannerBody");
    els.plannerTitle = document.getElementById("plannerTitle");
    els.plannerPrev = document.getElementById("plannerPrev");
    els.plannerNext = document.getElementById("plannerNext");
    els.plannerToday = document.getElementById("plannerToday");
    els.modeMonth = document.getElementById("plannerModeMonth");
    els.modeWeek = document.getElementById("plannerModeWeek");

    if (!els.planner) return;
    anchor = startOfDay(new Date());

    els.plannerPrev.addEventListener("click", () => shift(-1));
    els.plannerNext.addEventListener("click", () => shift(1));
    els.plannerToday.addEventListener("click", () => {
      anchor = startOfDay(new Date());
      render(lastTasks);
    });
    els.modeMonth.addEventListener("click", () => setMode("month"));
    els.modeWeek.addEventListener("click", () => setMode("week"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { render };
})();
