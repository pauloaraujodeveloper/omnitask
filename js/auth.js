/* =========================================================
   auth.js — Contas, sessão e tela de acesso
   Demonstração local (sem backend):
     • e-mail + senha com hash PBKDF2 (WebCrypto, com fallback)
     • Google real quando OmniConfig.GOOGLE_CLIENT_ID está definido;
       caso contrário, fluxo simulado de demonstração
     • papel (admin | user) e acesso ativo | suspenso
   Persistência: localStorage (omnitask_users / omnitask_session)
   ========================================================= */

const Auth = (() => {
  const KEYS = OmniConfig.STORAGE_KEYS;
  const USERS_KEY = KEYS.users;
  const SESSION_KEY = KEYS.session;

  const MIN_PASSWORD = 6;
  const MAX_PASSWORD = 72;
  const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
  const PBKDF2_ITERATIONS = 120000;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const GOOGLE_DEMO_EMAIL = "demo.google@omnitask.app";
  const GOOGLE_DEMO_NAME = "Conta Google (demo)";

  const listeners = [];
  let currentUser = null;
  let initPromise = null;
  let googleBusy = false;

  /* =========================================================
     1. Armazenamento de contas e sessão
     ========================================================= */

  function readUsers() {
    try {
      const raw = window.localStorage.getItem(USERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (user) => user && typeof user === "object" && typeof user.email === "string" && user.email
      );
    } catch (error) {
      return [];
    }
  }

  function writeUsers(users) {
    try {
      window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readSession() {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || typeof parsed.userId !== "string") return null;
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        window.localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeSession(userId) {
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          userId,
          createdAt: new Date().toISOString(),
          expiresAt: Date.now() + SESSION_TTL_MS,
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearSession() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* nada a fazer */
    }
  }

  /* =========================================================
     2. Senhash — PBKDF2 (WebCrypto) com fallback offline
     ========================================================= */

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return toHex(bytes);
  }

  /** Hash não criptográfico usado só quando WebCrypto está indisponível (ex.: file://). */
  function fallbackHash(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let round = 0; round < 2048; round += 1) {
      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        h1 ^= code + round;
        h1 = Math.imul(h1, 0x01000193);
        h2 = Math.imul(h2 ^ (h1 + code), 0x85ebca6b);
      }
      h2 ^= h1;
    }
    return (
      "fb$" +
      (h1 >>> 0).toString(16).padStart(8, "0") +
      (h2 >>> 0).toString(16).padStart(8, "0")
    );
  }

  async function hashPassword(password, salt) {
    const subtle = window.crypto && window.crypto.subtle;
    if (subtle) {
      try {
        const encoder = new TextEncoder();
        const key = await subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
          "deriveBits",
        ]);
        const bits = await subtle.deriveBits(
          { name: "PBKDF2", salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
          key,
          256
        );
        return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(bits)}`;
      } catch (error) {
        /* contexto não seguro (ex.: file://) → fallback abaixo */
      }
    }
    return fallbackHash(`${password}$${salt}`);
  }

  async function verifyPassword(password, user) {
    if (!user || typeof user.passwordHash !== "string") return false;
    const computed = await hashPassword(password, user.salt || user.id);
    return computed === user.passwordHash;
  }

  /* =========================================================
     3. Validação e utilidades de conta
     ========================================================= */

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return EMAIL_PATTERN.test(normalizeEmail(email));
  }

  function findByEmail(email) {
    const target = normalizeEmail(email);
    return readUsers().find((user) => normalizeEmail(user.email) === target) || null;
  }

  function findById(id) {
    return readUsers().find((user) => user.id === id) || null;
  }

  /** Remove dados sensíveis antes de expor a conta na interface. */
  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === "admin" ? "admin" : "user",
      status: user.status === "suspended" ? "suspended" : "active",
      provider: user.provider === "google" ? "google" : "local",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  function isAdminEmail(email) {
    return normalizeEmail(email) === normalizeEmail(OmniConfig.ADMIN_EMAIL);
  }

  /* =========================================================
     4. Criação e gestão de contas
     ========================================================= */

  /**
   * Cria uma conta. Retorna {ok, errors?, user?}.
   * Validações de nome/e-mail/senha são feitas aqui (fonte única).
   */
  async function createUser({ name, email, password, role = "user", provider = "local" }) {
    const users = readUsers();
    const cleanName = Utils.cleanText(name);
    const cleanEmail = normalizeEmail(email);
    const errors = {};

    if (!cleanName) {
      errors.name = "Informe um nome.";
    } else if (cleanName.length < 2) {
      errors.name = "O nome deve ter no mínimo 2 caracteres.";
    } else if (cleanName.length > 60) {
      errors.name = "O nome pode ter no máximo 60 caracteres.";
    }

    if (!cleanEmail) {
      errors.email = "Informe um e-mail.";
    } else if (!isValidEmail(cleanEmail)) {
      errors.email = "Informe um e-mail válido.";
    } else if (findByEmail(cleanEmail)) {
      errors.email = "Já existe uma conta com este e-mail.";
    }

    if (provider === "local") {
      const pwd = typeof password === "string" ? password : "";
      if (!pwd) {
        errors.password = "Informe uma senha.";
      } else if (pwd.length < MIN_PASSWORD) {
        errors.password = `A senha deve ter no mínimo ${MIN_PASSWORD} caracteres.`;
      } else if (pwd.length > MAX_PASSWORD) {
        errors.password = `A senha pode ter no máximo ${MAX_PASSWORD} caracteres.`;
      }
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const id = `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const salt = randomSalt();
    const now = new Date().toISOString();

    const user = {
      id,
      name: cleanName,
      email: cleanEmail,
      role: role === "admin" ? "admin" : "user",
      status: "active",
      provider: provider === "google" ? "google" : "local",
      passwordHash: provider === "local" ? await hashPassword(password, salt) : null,
      salt,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };

    users.push(user);
    if (!writeUsers(users)) {
      return { ok: false, errors: { form: "Não foi possível salvar a conta neste navegador." } };
    }

    return { ok: true, user: publicUser(user) };
  }

  /* =========================================================
     5. Sessão
     ========================================================= */

  function setCurrent(user) {
    currentUser = user;
    listeners.forEach((callback) => callback(currentUser));
  }

  function openSession(user) {
    const now = Date.now();
    writeSession(user.id);

    const users = readUsers().map((record) =>
      record.id === user.id ? { ...record, lastLoginAt: new Date(now).toISOString() } : record
    );
    writeUsers(users);

    setCurrent(publicUser(users.find((record) => record.id === user.id) || user));
    return { ok: true, user: currentUser };
  }

  /** Entrada por e-mail e senha. */
  async function signIn(email, password) {
    const user = findByEmail(email);
    if (!user) return { ok: false, error: "E-mail ou senha incorretos." };

    if (user.status === "suspended") {
      return { ok: false, error: "Esta conta está suspensa. Fale com o administrador." };
    }
    if (user.provider === "google") {
      return { ok: false, error: "Esta conta entra com Google. Use o botão abaixo." };
    }

    const valid = await verifyPassword(password, user);
    if (!valid) return { ok: false, error: "E-mail ou senha incorretos." };

    return openSession(user);
  }

  /** Cria a conta e abre a sessão de uma vez (cadastro público). */
  async function signUp({ name, email, password, confirm }) {
    const errors = {};
    if (typeof confirm === "string" && confirm !== password) {
      errors.confirm = "As senhas não coincidem.";
    }

    const created = await createUser({ name, email, password, role: "user", provider: "local" });
    if (!created.ok) {
      return { ok: false, errors: { ...created.errors, ...errors } };
    }
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    return openSession(findByEmail(created.user.email) || created.user);
  }

  function signOut() {
    clearSession();
    setCurrent(null);
  }

  /* =========================================================
     6. Google (real com OAuth ou simulado)
     ========================================================= */

  function loadGoogleIdentity() {
    if (window.google && window.google.accounts) return Promise.resolve();
    if (loadGoogleIdentity.promise) return loadGoogleIdentity.promise;

    loadGoogleIdentity.promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("gis_load_failed"));
      document.head.appendChild(script);
    });

    return loadGoogleIdentity.promise;
  }

  function decodeJwt(token) {
    try {
      const payload = String(token).split(".")[1] || "";
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      const data = JSON.parse(json);
      return data && typeof data === "object" ? data : null;
    } catch (error) {
      return null;
    }
  }

  /** Entra (ou cria) a conta a partir de um perfil Google. */
  async function signInWithGoogleProfile(profile) {
    const email = normalizeEmail(profile && profile.email);
    if (!isValidEmail(email)) return { ok: false, error: "Não foi possível ler a conta do Google." };

    const existing = findByEmail(email);
    if (existing) {
      if (existing.status === "suspended") {
        return { ok: false, error: "Esta conta está suspensa. Fale com o administrador." };
      }
      return openSession(existing);
    }

    const displayName = Utils.cleanText((profile && profile.name) || "") || email.split("@")[0];
    const created = await createUser({
      name: displayName,
      email,
      password: null,
      role: "user",
      provider: "google",
    });
    if (!created.ok) return { ok: false, error: Object.values(created.errors || {})[0] };

    return openSession(findByEmail(email) || created.user);
  }

  function setGoogleBusy(busy) {
    googleBusy = busy;
    const button = document.getElementById("googleBtn");
    if (!button) return;
    const label = button.querySelector("span");
    button.disabled = busy;
    button.setAttribute("aria-busy", busy ? "true" : "false");
    if (label) label.textContent = busy ? "Conectando…" : "Continuar com Google";
  }

  async function demoGoogleSignIn() {
    if (googleBusy) return;
    setGoogleBusy(true);
    // Simula a latência do redirecionamento do Google.
    await new Promise((resolve) => setTimeout(resolve, 650));
    const result = await signInWithGoogleProfile({
      email: GOOGLE_DEMO_EMAIL,
      name: GOOGLE_DEMO_NAME,
    });
    setGoogleBusy(false);
    if (!result.ok && typeof window.showAuthError === "function") {
      window.showAuthError(result.error);
    }
    return result;
  }

  /** Clique no botão Google: real quando configurado, simulado caso contrário. */
  function handleGoogleClick() {
    if (googleBusy) return;
    if (!OmniConfig.isGoogleReal()) {
      demoGoogleSignIn();
      return;
    }
    loadGoogleIdentity()
      .then(() => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          window.google.accounts.id.prompt();
        }
      })
      .catch(() => {
        if (typeof window.showAuthError === "function") {
          window.showAuthError("Não foi possível carregar o login do Google. Verifique a conexão.");
        }
      });
  }

  /* =========================================================
     7. Conta administradora (semente automática)
     ========================================================= */

  async function seedAdmin() {
    const existing = findByEmail(OmniConfig.ADMIN_EMAIL);

    if (existing) {
      // A conta do desenvolvedor sempre permanece admin e ativa.
      if (existing.role !== "admin" || existing.status !== "active") {
        writeUsers(
          readUsers().map((user) =>
            user.id === existing.id
              ? { ...user, role: "admin", status: "active", updatedAt: new Date().toISOString() }
              : user
          )
        );
      }
      return existing;
    }

    const salt = randomSalt();
    const now = new Date().toISOString();
    const admin = {
      id: "user_admin",
      name: "Paulo Araujo",
      email: OmniConfig.ADMIN_EMAIL,
      role: "admin",
      status: "active",
      provider: "local",
      passwordHash: await hashPassword(OmniConfig.ADMIN_INITIAL_PASSWORD, salt),
      salt,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };

    writeUsers([...readUsers(), admin]);
    return admin;
  }

  /** Restaura a sessão anterior (se válida) após semear a conta admin. */
  function restoreSession() {
    const session = readSession();
    if (!session) {
      setCurrent(null);
      return null;
    }

    const user = findById(session.userId);
    if (!user || user.status === "suspended") {
      clearSession();
      setCurrent(null);
      return null;
    }

    setCurrent(publicUser(user));
    return currentUser;
  }

  /* =========================================================
     8. Tela de acesso (abas, formulário e botão Google)
     ========================================================= */

  const view = {
    tabSignIn: null,
    tabSignUp: null,
    form: null,
    nameField: null,
    name: null,
    nameError: null,
    email: null,
    emailError: null,
    password: null,
    passwordError: null,
    confirmField: null,
    confirm: null,
    confirmError: null,
    submit: null,
    formError: null,
    googleBtn: null,
    googleNote: null,
    mode: "signin",
  };

  function cacheViewEls() {
    view.tabSignIn = document.getElementById("tabSignIn");
    view.tabSignUp = document.getElementById("tabSignUp");
    view.form = document.getElementById("authForm");
    view.nameField = document.getElementById("authNameField");
    view.name = document.getElementById("authName");
    view.nameError = document.getElementById("authNameError");
    view.email = document.getElementById("authEmail");
    view.emailError = document.getElementById("authEmailError");
    view.password = document.getElementById("authPassword");
    view.passwordError = document.getElementById("authPasswordError");
    view.confirmField = document.getElementById("authConfirmField");
    view.confirm = document.getElementById("authConfirm");
    view.confirmError = document.getElementById("authConfirmError");
    view.submit = document.getElementById("authSubmit");
    view.formError = document.getElementById("authFormError");
    view.googleBtn = document.getElementById("googleBtn");
    view.googleNote = document.getElementById("authGoogleNote");
  }

  function clearFieldError(input, errorEl) {
    if (errorEl) errorEl.textContent = "";
    if (input) input.removeAttribute("aria-invalid");
  }

  function setFieldError(input, errorEl, message) {
    if (errorEl) errorEl.textContent = message;
    if (input) input.setAttribute("aria-invalid", "true");
  }

  function clearErrors() {
    clearFieldError(view.name, view.nameError);
    clearFieldError(view.email, view.emailError);
    clearFieldError(view.password, view.passwordError);
    clearFieldError(view.confirm, view.confirmError);
    showFormError("");
  }

  function showFormError(message) {
    if (!view.formError) return;
    view.formError.textContent = message || "";
    view.formError.hidden = !message;
  }

  // Ponte usada pelo fluxo Google (real ou simulado) para exibir erros.
  window.showAuthError = showFormError;

  function setBusy(busy) {
    if (!view.submit) return;
    const label = view.mode === "signup" ? "Criar conta" : "Entrar";
    view.submit.disabled = busy;
    view.submit.textContent = busy
      ? view.mode === "signup"
        ? "Criando conta…"
        : "Entrando…"
      : label;
  }

  function setMode(mode) {
    view.mode = mode === "signup" ? "signup" : "signin";
    const signUpMode = view.mode === "signup";

    if (view.tabSignIn && view.tabSignUp) {
      view.tabSignIn.classList.toggle("is-active", !signUpMode);
      view.tabSignUp.classList.toggle("is-active", signUpMode);
      view.tabSignIn.setAttribute("aria-selected", String(!signUpMode));
      view.tabSignUp.setAttribute("aria-selected", String(signUpMode));
    }

    if (view.nameField) view.nameField.hidden = !signUpMode;
    if (view.confirmField) view.confirmField.hidden = !signUpMode;
    if (view.name) view.name.required = signUpMode;
    if (view.confirm) view.confirm.required = signUpMode;
    if (view.password) view.password.autocomplete = signUpMode ? "new-password" : "current-password";
    if (view.submit) view.submit.textContent = signUpMode ? "Criar conta" : "Entrar";

    clearErrors();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearErrors();

    const signUpMode = view.mode === "signup";
    const email = view.email.value;
    const password = view.password.value;

    if (!email.trim()) {
      setFieldError(view.email, view.emailError, "Informe seu e-mail.");
      return;
    }
    if (!isValidEmail(email)) {
      setFieldError(view.email, view.emailError, "Informe um e-mail válido.");
      return;
    }
    if (!password) {
      setFieldError(view.password, view.passwordError, "Informe sua senha.");
      return;
    }
    if (signUpMode && password.length < MIN_PASSWORD) {
      setFieldError(
        view.password,
        view.passwordError,
        `A senha deve ter no mínimo ${MIN_PASSWORD} caracteres.`
      );
      return;
    }

    setBusy(true);
    const result = signUpMode
      ? await signUp({ name: view.name.value, email, password, confirm: view.confirm.value })
      : await signIn(email, password);
    setBusy(false);

    if (!result.ok) {
      const errors = result.errors || {};
      if (errors.name) setFieldError(view.name, view.nameError, errors.name);
      if (errors.email) setFieldError(view.email, view.emailError, errors.email);
      if (errors.password) setFieldError(view.password, view.passwordError, errors.password);
      if (errors.confirm) setFieldError(view.confirm, view.confirmError, errors.confirm);
      showFormError(result.error || Object.values(errors)[0] || "Não foi possível continuar.");

      // Foca o primeiro campo inválido.
      const firstKey = ["name", "email", "password", "confirm"].find((key) => errors[key]);
      const firstInput = { name: view.name, email: view.email, password: view.password, confirm: view.confirm }[
        firstKey
      ];
      if (firstInput) firstInput.focus();
      else if (view.email) view.email.focus();
      return;
    }

    // Sucesso: a sessão é emitida e app.js troca a tela de acesso pelo app.
    view.form.reset();
    setMode("signin");
  }

  /** Botão Google: oficial (OAuth) quando configurado, simulado caso contrário. */
  function setupGoogleButton() {
    if (!view.googleBtn) return;

    if (!OmniConfig.isGoogleReal()) {
      if (view.googleNote) view.googleNote.hidden = false;
      view.googleBtn.addEventListener("click", handleGoogleClick);
      return;
    }

    // Login real: o botão oficial do Google Identity Services assume o lugar.
    const slot = document.createElement("div");
    slot.className = "social-slot";
    view.googleBtn.insertAdjacentElement("afterend", slot);
    view.googleBtn.hidden = true;

    loadGoogleIdentity()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: OmniConfig.GOOGLE_CLIENT_ID,
          callback: (response) => {
            const profile = decodeJwt(response && response.credential);
            if (!profile || !profile.email) {
              showFormError("Não foi possível ler a conta do Google.");
              return;
            }
            signInWithGoogleProfile(profile).then((outcome) => {
              if (!outcome.ok) showFormError(outcome.error);
            });
          },
        });
        window.google.accounts.id.renderButton(slot, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
        });
      })
      .catch(() => {
        slot.remove();
        view.googleBtn.hidden = false;
        if (view.googleNote) view.googleNote.hidden = false;
        view.googleBtn.addEventListener("click", handleGoogleClick);
      });
  }

  function bindAuthView() {
    if (!view.form) return;

    view.tabSignIn.addEventListener("click", () => setMode("signin"));
    view.tabSignUp.addEventListener("click", () => setMode("signup"));

    [view.tabSignIn, view.tabSignUp].forEach((tab) => {
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const next = view.mode === "signin" ? "signup" : "signin";
        setMode(next);
        (next === "signin" ? view.tabSignIn : view.tabSignUp).focus();
      });
    });

    view.form.addEventListener("submit", handleSubmit);

    [
      [view.name, view.nameError],
      [view.email, view.emailError],
      [view.password, view.passwordError],
      [view.confirm, view.confirmError],
    ].forEach(([input, errorEl]) => {
      if (input) input.addEventListener("input", () => clearFieldError(input, errorEl));
    });

    setupGoogleButton();
    setMode("signin");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      cacheViewEls();
      bindAuthView();
    });
  } else {
    cacheViewEls();
    bindAuthView();
  }

  /* =========================================================
     9. API pública
     ========================================================= */

  function init() {
    if (initPromise) return initPromise;
    initPromise = seedAdmin().then(restoreSession);
    return initPromise;
  }

  function onChange(callback) {
    listeners.push(callback);
  }

  function getSessionUser() {
    return currentUser;
  }

  function isSignedIn() {
    return Boolean(currentUser);
  }

  function isAdmin() {
    return Boolean(currentUser && currentUser.role === "admin");
  }

  function getAdminId() {
    const admin = findByEmail(OmniConfig.ADMIN_EMAIL);
    return admin ? admin.id : "user_admin";
  }

  /* ---------------- Gestão (somente administrador) ---------------- */

  function listUsers() {
    return readUsers()
      .map(publicUser)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function countUsers() {
    return readUsers().length;
  }

  function countAdmins() {
    return readUsers().filter((user) => user.role === "admin").length;
  }

  /** O administrador pode alterar outras contas, nunca a própria. */
  function canManage(target) {
    return Boolean(currentUser && currentUser.role === "admin" && target && target.id !== currentUser.id);
  }

  /** A conta da plataforma (config.ADMIN_EMAIL) não pode ser alterada nem excluída. */
  function isPlatformAccount(user) {
    return Boolean(user && isAdminEmail(user.email));
  }

  async function adminCreateUser({ name, email, password, role }) {
    return createUser({ name, email, password, role, provider: "local" });
  }

  function updateUsers(mutator) {
    const users = readUsers();
    const next = mutator(users);
    if (next === null) return false;
    return writeUsers(next);
  }

  function setRole(id, role) {
    if (!isAdmin()) return { ok: false, error: "Acesso negado." };
    const target = findById(id);
    if (!target) return { ok: false, error: "Conta não encontrada." };
    if (!canManage(target) && !isPlatformAccount(target)) {
      return { ok: false, error: "Você não pode alterar esta conta." };
    }

    const nextRole = role === "admin" ? "admin" : "user";
    // A conta da plataforma nunca perde o papel de administrador.
    const appliedRole = isPlatformAccount(target) ? "admin" : nextRole;

    updateUsers((users) =>
      users.map((user) =>
        user.id === id ? { ...user, role: appliedRole, updatedAt: new Date().toISOString() } : user
      )
    );
    return { ok: true, role: appliedRole };
  }

  function setStatus(id, status) {
    if (!isAdmin()) return { ok: false, error: "Acesso negado." };
    const target = findById(id);
    if (!target) return { ok: false, error: "Conta não encontrada." };
    if (!canManage(target)) return { ok: false, error: "Você não pode alterar esta conta." };

    const nextStatus = status === "suspended" ? "suspended" : "active";
    updateUsers((users) =>
      users.map((user) =>
        user.id === id ? { ...user, status: nextStatus, updatedAt: new Date().toISOString() } : user
      )
    );
    return { ok: true, status: nextStatus };
  }

  function resetPassword(id, newPassword) {
    if (!isAdmin()) return { ok: false, error: "Acesso negado." };
    const target = findById(id);
    if (!target) return { ok: false, error: "Conta não encontrada." };
    if (!canManage(target) && target.id !== currentUser.id) {
      return { ok: false, error: "Você não pode alterar esta conta." };
    }

    const password = typeof newPassword === "string" ? newPassword : "";
    if (password.length < MIN_PASSWORD) {
      return { ok: false, error: `A nova senha deve ter no mínimo ${MIN_PASSWORD} caracteres.` };
    }
    if (password.length > MAX_PASSWORD) {
      return { ok: false, error: `A nova senha pode ter no máximo ${MAX_PASSWORD} caracteres.` };
    }

    const salt = randomSalt();
    return hashPassword(password, salt).then((passwordHash) => {
      updateUsers((users) =>
        users.map((user) =>
          user.id === id
            ? { ...user, passwordHash, salt, provider: "local", updatedAt: new Date().toISOString() }
            : user
        )
      );
      return { ok: true };
    });
  }

  async function removeUser(id) {
    if (!isAdmin()) return { ok: false, error: "Acesso negado." };
    const target = findById(id);
    if (!target) return { ok: false, error: "Conta não encontrada." };
    if (!canManage(target)) return { ok: false, error: "Você não pode excluir esta conta." };

    updateUsers((users) => users.filter((user) => user.id !== id));
    return { ok: true };
  }

  return {
    init,
    onChange,
    getSessionUser,
    isSignedIn,
    isAdmin,
    getAdminId,
    signIn,
    signUp,
    signOut,
    handleGoogleClick,
    // gestão de contas (painel administrativo)
    listUsers,
    countUsers,
    countAdmins,
    canManage,
    isPlatformAccount,
    adminCreateUser,
    setRole,
    setStatus,
    resetPassword,
    removeUser,
    isValidEmail,
    MIN_PASSWORD,
  };
})();
