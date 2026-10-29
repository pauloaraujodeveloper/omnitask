/* =========================================================
   storage.js — Persistência das tarefas no localStorage
   Cada tarefa pertence a uma conta (campo `owner`), o que
   permite vários usuários no mesmo navegador.
   ========================================================= */

const Storage = (() => {
  const STORAGE_KEY = (window.OmniConfig && OmniConfig.STORAGE_KEYS.tasks) || "omnitask_tasks";

  const VALID_STATUS = ["todo", "in_progress", "done"];
  const VALID_PRIORITY = ["alta", "media", "baixa"];
  const VALID_CATEGORY = ["trabalho", "estudos", "pessoal", "saude", "financas", "outros"];
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  let available = false;

  /** Verifica se o localStorage pode ser utilizado neste navegador. */
  function checkAvailability() {
    try {
      const probe = "__omnitask_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      available = true;
    } catch (error) {
      available = false;
    }
    return available;
  }

  function isAvailable() {
    return available;
  }

  /**
   * Normaliza um registro vindo do armazenamento; retorna null se inválido.
   * @param {Object} raw registro bruto
   * @param {string} fallbackOwner dono atribuído a tarefas sem `owner`
   *        (lançamentos anteriores ao sistema de contas)
   */
  function sanitize(raw, fallbackOwner) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const title = typeof raw.title === "string" ? Utils.cleanText(raw.title) : "";
    if (title.length < 1) return null;

    const status = VALID_STATUS.includes(raw.status) ? raw.status : "todo";
    const priority = VALID_PRIORITY.includes(raw.priority) ? raw.priority : "media";
    const category = VALID_CATEGORY.includes(raw.category) ? raw.category : "outros";
    const dueDate =
      typeof raw.dueDate === "string" && DATE_PATTERN.test(raw.dueDate) ? raw.dueDate : "";

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : Utils.uid(),
      owner: typeof raw.owner === "string" && raw.owner ? raw.owner : fallbackOwner || "omnitask",
      title: title.slice(0, 100),
      description:
        typeof raw.description === "string" ? Utils.cleanText(raw.description).slice(0, 500) : "",
      priority,
      category,
      dueDate,
      status,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
      completedAt: status === "done" ? (raw.completedAt || new Date().toISOString()) : null,
    };
  }

  function writeList(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (error) {
      available = false;
      return false;
    }
  }

  function readList() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { list: [], warning: null };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { list: [], warning: "storage_corrupted" };
      return { list: parsed, warning: null };
    } catch (error) {
      return { list: [], warning: "storage_corrupted" };
    }
  }

  /**
   * Recupera as tarefas de um usuário.
   * @param {string} ownerId conta atual
   * @param {string|null} legacyOwner dono atribuído às tarefas antigas sem `owner`
   * @returns {{tasks: Array, warning: string|null}}
   */
  function load(ownerId, legacyOwner = null) {
    const result = { tasks: [], warning: null };

    if (!checkAvailability()) {
      result.warning = "storage_unavailable";
      return result;
    }

    let raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      result.warning = "storage_read_error";
      return result;
    }

    if (!raw) return result;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Formato inesperado");

      const fallbackOwner = legacyOwner || ownerId || "omnitask";
      const all = parsed.map((item) => sanitize(item, fallbackOwner)).filter(Boolean);

      if (all.length !== parsed.length) result.warning = "storage_invalid_data";

      // Migra tarefas sem dono (criadas antes do login) para a conta legada.
      const needsMigration = parsed.some(
        (item) => item && typeof item === "object" && !(typeof item.owner === "string" && item.owner)
      );
      if (needsMigration || all.length !== parsed.length) writeList(all);

      result.tasks = all.filter((task) => task.owner === ownerId);
    } catch (error) {
      result.warning = "storage_corrupted";
      result.tasks = [];
    }

    return result;
  }

  /**
   * Persiste as tarefas de um usuário, preservando as demais contas.
   * Tarefas antigas sem `owner` são mantidas com o dono legado (admin).
   * @param {Array} tasks tarefas do usuário atual (com `owner` preenchido)
   * @param {string} ownerId conta atual
   * @param {string|null} legacyOwner dono das tarefas sem `owner`
   * @returns {boolean} sucesso da gravação
   */
  function save(tasks, ownerId, legacyOwner = null) {
    if (!available && !checkAvailability()) return false;

    const fallbackOwner = legacyOwner || ownerId || "omnitask";

    let others = [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          others = parsed
            .map((item) => sanitize(item, fallbackOwner))
            .filter((task) => task && task.owner !== ownerId);
        }
      }
    } catch (error) {
      // Lista antiga corrompida: segue apenas com as tarefas novas.
      others = [];
    }

    const mine = (Array.isArray(tasks) ? tasks : []).map((task) =>
      sanitize(task, ownerId) || task
    );

    return writeList([...others, ...mine]);
  }

  return { STORAGE_KEY, checkAvailability, isAvailable, load, save };
})();
