/* =========================================================
   dashboard.js — Indicadores de produtividade
   Regra: indicadores sempre refletem o conjunto completo
   de tarefas, ignorando filtros visuais.
   ========================================================= */

const Dashboard = (() => {
  /**
   * Calcula os indicadores obrigatórios do PRD (RF-12).
   * @param {Array} tasks lista completa de tarefas
   */
  function compute(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];

    const total = list.length;
    const todo = list.filter((task) => task.status === "todo").length;
    const doing = list.filter((task) => task.status === "in_progress").length;
    const done = list.filter((task) => task.status === "done").length;
    const late = list.filter(Utils.isOverdue).length;

    // Percentual de conclusão = (concluídas ÷ total) × 100 → 0% quando não há tarefas.
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, todo, doing, done, late, percent };
  }

  return { compute };
})();
