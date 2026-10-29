/* =========================================================
   filters.js — Estado e aplicação de filtros + pesquisa
   ========================================================= */

const Filters = (() => {
  const state = {
    status: "",
    priority: "",
    category: "",
    due: "",
    search: "",
  };

  const listeners = [];

  function get() {
    return { ...state };
  }

  function onChange(callback) {
    listeners.push(callback);
  }

  function emit() {
    listeners.forEach((callback) => callback({ ...state }));
  }

  /** Atualiza um ou mais critérios. */
  function set(patch) {
    Object.assign(state, patch);
    emit();
  }

  /** Remove todos os critérios (os dados originais não são alterados). */
  function clear() {
    state.status = "";
    state.priority = "";
    state.category = "";
    state.due = "";
    state.search = "";
    emit();
  }

  function isActive() {
    return Boolean(state.status || state.priority || state.category || state.due || state.search);
  }

  /** Testa o critério de prazo de uma tarefa. */
  function matchDue(task) {
    switch (state.due) {
      case "overdue":
        return Utils.isOverdue(task);
      case "with_due":
        return Boolean(task.dueDate);
      case "no_due":
        return !task.dueDate;
      case "today":
        return task.dueDate === Utils.todayISO();
      case "week":
        return Utils.isDueThisWeek(task);
      default:
        return true;
    }
  }

  /** Testa a pesquisa no título e na descrição (ignora maiúsculas/acentos). */
  function matchSearch(task) {
    if (!state.search) return true;
    const term = Utils.normalize(state.search);
    if (!term) return true;

    return (
      Utils.normalize(task.title).includes(term) ||
      Utils.normalize(task.description).includes(term)
    );
  }

  /**
   * Aplica filtros e pesquisa sobre a lista original.
   * @returns {Array} nova lista (sem alterar os dados armazenados)
   */
  function apply(tasks) {
    return tasks.filter((task) => {
      if (state.status && task.status !== state.status) return false;
      if (state.priority && task.priority !== state.priority) return false;
      if (state.category && task.category !== state.category) return false;
      if (!matchDue(task)) return false;
      if (!matchSearch(task)) return false;
      return true;
    });
  }

  return { get, set, clear, isActive, apply, onChange };
})();
