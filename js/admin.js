/* =========================================================
   admin.js — Painel de gestão de usuários (somente admin)
   Criar acesso, listar contas, alternar papel/acesso,
   redefinir senha e excluir contas.
   ========================================================= */

window.OmniAdmin = (() => {
  const $ = (selector) => document.querySelector(selector);

  const els = {
    navItem: null,
    navCount: null,
    dialog: null,
    closeBtn: null,
    doneBtn: null,
    createForm: null,
    createName: null,
    createEmail: null,
    createPassword: null,
    createRole: null,
    createError: null,
    list: null,
    hint: null,
  };

  let mounted = false;
  let sessionUser = null;
  let lastFocused = null;

  /* ---------------- Utilitários de interface ---------------- */

  function ui() {
    return window.OmniUI || { toast: () => {}, confirmAction: async () => false };
  }

  function initials(name, email) {
    const source = Utils.cleanText(name) || String(email || "").split("@")[0] || "?";
    const parts = source.split(" ").filter(Boolean);
    const letters = (parts[0] || "?").charAt(0) + (parts[1] ? parts[1].charAt(0) : "");
    return letters.toUpperCase();
  }

  function formatDate(value) {
    return value ? Utils.formatDateTime(value).split(" ")[0] : "—";
  }

  function badge(text, kind) {
    return Utils.el("span", { className: `badge badge--${kind}`, text });
  }

  /* ---------------- Renderização da lista ---------------- */

  function actionButton(label, handler, { danger = false, disabled = false, title = "" } = {}) {
    const button = Utils.el("button", {
      className: `btn btn--sm ${danger ? "btn--danger-ghost" : "btn--ghost"}`,
      attrs: { type: "button" },
      text: label,
    });
    if (title) button.title = title;
    if (disabled) {
      button.disabled = true;
      if (title) button.title = title;
    } else {
      button.addEventListener("click", handler);
    }
    return button;
  }

  function buildRow(user) {
    const isSelf = sessionUser && user.id === sessionUser.id;
    const platform = Auth.isPlatformAccount(user);
    const manageable = Auth.canManage(user);
    const locked = platform || isSelf;

    const row = Utils.el("li", { className: "admin-user" });

    row.appendChild(
      Utils.el("span", {
        className: "admin-user__avatar",
        attrs: { "aria-hidden": "true" },
        text: initials(user.name, user.email),
      })
    );

    const body = Utils.el("span", { className: "admin-user__body" });
    const nameLine = Utils.el("span", { className: "admin-user__name" });
    nameLine.appendChild(Utils.el("strong", { text: user.name }));
    nameLine.appendChild(badge(user.role === "admin" ? "admin" : "usuário", "role"));
    if (user.status === "suspended") nameLine.appendChild(badge("suspenso", "suspended"));
    if (user.provider === "google") nameLine.appendChild(badge("google", "google"));
    if (platform) nameLine.appendChild(badge("plataforma", "platform"));
    body.appendChild(nameLine);

    const lastAccess = user.lastLoginAt ? Utils.formatDateTime(user.lastLoginAt) : "nunca";
    body.appendChild(
      Utils.el("small", {
        className: "admin-user__meta",
        text: `${user.email} · conta criada em ${formatDate(user.createdAt)} · último acesso: ${lastAccess}`,
      })
    );
    row.appendChild(body);

    const actions = Utils.el("span", { className: "admin-user__actions" });

    const lockedMsg = platform
      ? "Conta da plataforma: não pode ser alterada."
      : "Não é possível alterar a própria conta.";

    actions.appendChild(
      actionButton(user.role === "admin" ? "Tornar usuário" : "Tornar admin", () => toggleRole(user), {
        disabled: locked,
        title: locked ? lockedMsg : "",
      })
    );

    actions.appendChild(
      actionButton(user.status === "suspended" ? "Reativar" : "Suspender", () => toggleStatus(user), {
        danger: user.status !== "suspended",
        disabled: locked,
        title: locked ? lockedMsg : "",
      })
    );

    actions.appendChild(
      actionButton("Redefinir senha", () => openReset(row, user), {
        disabled: platform && !isSelf,
        title: platform && !isSelf ? lockedMsg : "",
      })
    );

    actions.appendChild(
      actionButton("Excluir", () => deleteUser(user), {
        danger: true,
        disabled: !manageable,
        title: !manageable ? lockedMsg : "",
      })
    );

    row.appendChild(actions);

    /* Formulário inline de redefinição de senha (aberto sob demanda) */
    const resetForm = Utils.el("form", { className: "admin-user__reset", attrs: { hidden: "" } });
    const resetInput = Utils.el("input", {
      attrs: {
        type: "password",
        maxlength: "72",
        placeholder: "Nova senha (mínimo 6)",
        "aria-label": `Nova senha para ${user.email}`,
        autocomplete: "new-password",
      },
    });
    const resetError = Utils.el("p", { className: "field__error", attrs: { role: "alert" } });
    const saveBtn = Utils.el("button", {
      className: "btn btn--primary btn--sm",
      attrs: { type: "submit" },
      text: "Salvar senha",
    });
    const cancelBtn = Utils.el("button", {
      className: "btn btn--ghost btn--sm",
      attrs: { type: "button" },
      text: "Cancelar",
    });
    cancelBtn.addEventListener("click", () => {
      resetForm.hidden = true;
      resetError.textContent = "";
      resetInput.value = "";
    });
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      saveBtn.disabled = true;
      const result = await Auth.resetPassword(user.id, resetInput.value);
      saveBtn.disabled = false;

      if (!result.ok) {
        resetError.textContent = result.error || "Não foi possível redefinir a senha.";
        return;
      }

      resetForm.hidden = true;
      resetInput.value = "";
      ui().toast(`Senha de ${user.name} redefinida com sucesso.`, "success");
    });

    resetForm.appendChild(resetInput);
    resetForm.appendChild(saveBtn);
    resetForm.appendChild(cancelBtn);
    resetForm.appendChild(resetError);
    row.appendChild(resetForm);

    return row;
  }

  function openReset(row, user) {
    const form = row.querySelector(".admin-user__reset");
    const input = form && form.querySelector("input");
    if (!form) return;
    form.hidden = false;
    if (input) input.focus();
    void user;
  }

  function render() {
    if (!els.list) return;

    const users = Auth.listUsers();
    const admins = users.filter((user) => user.role === "admin").length;

    els.list.replaceChildren(...users.map(buildRow));

    if (els.hint) {
      els.hint.textContent = `${users.length} conta${users.length === 1 ? "" : "s"} · ${admins} administrador${admins === 1 ? "" : "es"}`;
    }
    if (els.navCount) els.navCount.textContent = String(users.length);
  }

  /* ---------------- Ações ---------------- */

  async function toggleRole(user) {
    const next = user.role === "admin" ? "user" : "admin";
    const result = Auth.setRole(user.id, next);
    if (!result.ok) {
      ui().toast(result.error || "Não foi possível alterar o papel.", "error");
      return;
    }
    ui().toast(
      result.role === "admin"
        ? `${user.name} agora é administrador.`
        : `${user.name} agora é usuário comum.`,
      "success"
    );
    render();
  }

  async function toggleStatus(user) {
    const next = user.status === "suspended" ? "active" : "suspended";
    const result = Auth.setStatus(user.id, next);
    if (!result.ok) {
      ui().toast(result.error || "Não foi possível alterar o acesso.", "error");
      return;
    }
    ui().toast(
      result.status === "suspended"
        ? `Acesso de ${user.name} suspenso.`
        : `Acesso de ${user.name} reativado.`,
      "success"
    );
    render();
  }

  async function deleteUser(user) {
    const confirmed = await ui().confirmAction({
      title: "Excluir conta?",
      text: `A conta de ${user.name} (${user.email}) será removida. As tarefas criadas por ela permanecem salvas neste navegador.`,
      confirmLabel: "Excluir conta",
    });
    if (!confirmed) return;

    const result = await Auth.removeUser(user.id);
    if (!result.ok) {
      ui().toast(result.error || "Não foi possível excluir a conta.", "error");
      return;
    }
    ui().toast(`Conta de ${user.name} excluída.`, "success");
    render();
  }

  function clearCreateError() {
    if (!els.createError) return;
    els.createError.textContent = "";
    [els.createName, els.createEmail, els.createPassword].forEach((field) => {
      if (field) field.removeAttribute("aria-invalid");
    });
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!els.createError) return;
    clearCreateError();

    const result = await Auth.adminCreateUser({
      name: els.createName.value,
      email: els.createEmail.value,
      password: els.createPassword.value,
      role: els.createRole.value,
    });

    if (!result.ok) {
      const errors = result.errors || {};
      const map = { name: els.createName, email: els.createEmail, password: els.createPassword };
      Object.keys(map).forEach((key) => {
        if (errors[key]) map[key].setAttribute("aria-invalid", "true");
      });
      els.createError.textContent =
        errors.form || Object.values(errors)[0] || "Não foi possível criar o acesso.";
      const firstInvalid = Object.keys(map).find((key) => errors[key]);
      if (firstInvalid) map[firstInvalid].focus();
      return;
    }

    els.createForm.reset();
    ui().toast(`Acesso criado para ${result.user.name}.`, "success");
    render();
  }

  /* ---------------- Abertura e fechamento ---------------- */

  function open() {
    if (!els.dialog) return;
    lastFocused = document.activeElement;
    render();
    clearCreateError();
    els.dialog.showModal();
    if (window.OmniMotion) window.OmniMotion.dialogIn(els.dialog);
    setTimeout(() => {
      if (els.createName) els.createName.focus();
    }, 40);
  }

  function close() {
    if (els.dialog && els.dialog.open) els.dialog.close();
  }

  /* ---------------- Ciclo de vida ---------------- */

  function cacheEls() {
    els.navItem = $("#navUsersItem");
    els.navCount = $("#navCountUsers");
    els.dialog = $("#usersDialog");
    els.closeBtn = $("#usersClose");
    els.doneBtn = $("#usersDone");
    els.createForm = $("#adminCreateForm");
    els.createName = $("#adminNewName");
    els.createEmail = $("#adminNewEmail");
    els.createPassword = $("#adminNewPassword");
    els.createRole = $("#adminNewRole");
    els.createError = $("#adminCreateError");
    els.list = $("#adminUsersList");
    els.hint = $("#adminListHint");
  }

  function bind() {
    if (mounted) return;
    mounted = true;

    const navButton = els.navItem && els.navItem.querySelector(".nav__item");
    if (navButton) navButton.addEventListener("click", open);

    if (els.closeBtn) els.closeBtn.addEventListener("click", close);
    if (els.doneBtn) els.doneBtn.addEventListener("click", close);
    if (els.dialog) {
      els.dialog.addEventListener("click", (event) => {
        if (event.target === els.dialog) close();
      });
      els.dialog.addEventListener("close", () => {
        if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
      });
    }

    if (els.createForm) els.createForm.addEventListener("submit", handleCreate);
    [els.createName, els.createEmail, els.createPassword].forEach((field) => {
      if (field) field.addEventListener("input", clearCreateError);
    });
  }

  /** Exibido quando a sessão pertence a um administrador. */
  function mount(user) {
    sessionUser = user;
    if (!els.navItem) return;
    const admin = Boolean(user && user.role === "admin");
    els.navItem.hidden = !admin;
    if (admin) render();
  }

  function unmount() {
    sessionUser = null;
    close();
    if (els.list) els.list.replaceChildren();
    if (els.hint) els.hint.textContent = "";
    if (els.navCount) els.navCount.textContent = "0";
    if (els.navItem) els.navItem.hidden = true;
  }

  function init() {
    cacheEls();
    bind();
    unmount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { open, close, mount, unmount, render };
})();
