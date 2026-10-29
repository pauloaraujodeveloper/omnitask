/* =========================================================
   tasks.js — Estado em memória, validação e operações CRUD
   ========================================================= */

const Tasks = (() => {
  const VALID_STATUS = ["todo", "in_progress", "done"];
  const VALID_PRIORITY = ["alta", "media", "baixa"];
  const VALID_CATEGORY = ["trabalho", "estudos", "pessoal", "saude", "financas", "outros"];

  /** Lista de tarefas mantida em memória durante a execução. */
  let items = [];
  /** Conta dona das tarefas em memória + dono legado das tarefas sem `owner`. */
  let ownerId = null;
  let legacyOwner = null;
  const listeners = [];

  /* ---------------- Ciclo de vida do estado ---------------- */

  function init(initialTasks, owner, legacy) {
    items = Array.isArray(initialTasks) ? initialTasks : [];
    ownerId = owner || null;
    legacyOwner = legacy || null;
    emit();
  }

  function getAll() {
    return items;
  }

  function get(id) {
    return items.find((task) => task.id === id) || null;
  }

  function onChange(callback) {
    listeners.push(callback);
  }

  function emit() {
    listeners.forEach((callback) => callback(items));
  }

  /** Persiste no localStorage. Retorna false quando a gravação falha. */
  function persist() {
    return Storage.save(items, ownerId, legacyOwner);
  }

  /* ---------------- Validação ---------------- */

  /**
   * Valida os dados do formulário.
   * @returns {Object} mapa de erros por campo (vazio quando válido)
   */
  function validate(data) {
    const errors = {};
    const title = typeof data.title === "string" ? data.title.trim() : "";

    if (!title) {
      errors.title = "Informe um título para a tarefa.";
    } else if (title.length < 3) {
      errors.title = "O título deve ter no mínimo 3 caracteres.";
    } else if (title.length > 100) {
      errors.title = "O título pode ter no máximo 100 caracteres.";
    }

    const description = typeof data.description === "string" ? data.description.trim() : "";
    if (description.length > 500) {
      errors.description = "A descrição pode ter no máximo 500 caracteres.";
    }

    if (!VALID_PRIORITY.includes(data.priority)) {
      errors.priority = "Selecione uma prioridade válida.";
    }

    if (!VALID_CATEGORY.includes(data.category)) {
      errors.category = "Selecione uma categoria válida.";
    }

    if (!VALID_STATUS.includes(data.status)) {
      errors.status = "Selecione um status válido.";
    }

    if (data.dueDate) {
      const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate);
      const date = new Date(data.dueDate + "T00:00:00");
      if (!validFormat || Number.isNaN(date.getTime())) {
        errors.dueDate = "Informe uma data válida.";
      }
    }

    return errors;
  }

  /* ---------------- Operações CRUD ---------------- */

  /**
   * Cria uma nova tarefa.
   * @returns {{ok: boolean, errors?: Object, saved?: boolean, task?: Object}}
   */
  function create(data) {
    const errors = validate(data);
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const now = new Date().toISOString();
    const status = data.status;

    const task = {
      id: Utils.uid(),
      owner: ownerId,
      title: data.title.trim(),
      description: (data.description || "").trim(),
      priority: data.priority,
      category: data.category,
      dueDate: data.dueDate || "",
      status,
      createdAt: now,
      updatedAt: now,
      completedAt: status === "done" ? now : null,
    };

    items = [task, ...items];
    const saved = persist();
    emit();

    return { ok: true, saved, task };
  }

  /**
   * Atualiza uma tarefa existente (sem duplicar).
   * @returns {{ok: boolean, errors?: Object, saved?: boolean, task?: Object}}
   */
  function update(id, data) {
    const existing = get(id);
    if (!existing) return { ok: false, errors: { form: "Tarefa não encontrada." } };

    const errors = validate(data);
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const status = data.status;
    const completedAt =
      status === "done" ? (existing.completedAt || new Date().toISOString()) : null;

    const updated = {
      ...existing,
      title: data.title.trim(),
      description: (data.description || "").trim(),
      priority: data.priority,
      category: data.category,
      dueDate: data.dueDate || "",
      status,
      completedAt,
      updatedAt: new Date().toISOString(),
    };

    items = items.map((task) => (task.id === id ? updated : task));
    const saved = persist();
    emit();

    return { ok: true, saved, task: updated };
  }

  /** Remove definitivamente uma tarefa. */
  function remove(id) {
    const before = items.length;
    items = items.filter((task) => task.id !== id);
    if (items.length === before) return { ok: false };

    const saved = persist();
    emit();
    return { ok: true, saved };
  }

  /**
   * Altera o status de uma tarefa (concluir, iniciar, reabrir).
   * Regra: completedAt é preenchido em "done" e volta a null ao reabrir.
   */
  function setStatus(id, status) {
    if (!VALID_STATUS.includes(status)) return { ok: false };

    const existing = get(id);
    if (!existing) return { ok: false };

    const updated = {
      ...existing,
      status,
      completedAt: status === "done" ? (existing.completedAt || new Date().toISOString()) : null,
      updatedAt: new Date().toISOString(),
    };

    items = items.map((task) => (task.id === id ? updated : task));
    const saved = persist();
    emit();

    return { ok: true, saved, task: updated };
  }

  /** Próximo status no fluxo: todo → in_progress → done → todo. */
  function nextStatus(status) {
    if (status === "todo") return "in_progress";
    if (status === "in_progress") return "done";
    return "todo";
  }

  return { init, getAll, get, onChange, validate, create, update, remove, setStatus, nextStatus };
})();
