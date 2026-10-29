/* =========================================================
   config.js — Configuração global do OmniTask
   ========================================================= */

const OmniConfig = (() => {
  /**
   * Client ID OAuth do Google Cloud Console.
   * Deixe "" para usar o login Google em modo demonstração (simulado).
   * Para ativar o login real:
   *   1. Crie um projeto em https://console.cloud.google.com
   *   2. Ative "Google Identity Services" e crie um "OAuth 2.0 Client ID"
   *      com o tipo "Web application" e o origem deste site no campo
   *      "Authorized JavaScript origins" (ex.: http://localhost:8787)
   *   3. Cole o Client ID abaixo entre aspas.
   */
  const GOOGLE_CLIENT_ID = "";

  /** Conta do administrador/desenvolvedor da plataforma. */
  const ADMIN_EMAIL = "pauloaraujodeveloper@gmail.com";

  /**
   * Senha inicial da conta administradora (demonstração).
   * A conta é criada automaticamente no primeiro acesso e pode ser
   * redefinida pelo painel "Usuários".
   */
  const ADMIN_INITIAL_PASSWORD = "admin123";

  /** Chaves do localStorage (prefixo omnidtask_*). */
  const STORAGE_KEYS = {
    tasks: "omnitask_tasks",
    users: "omnitask_users",
    session: "omnitask_session",
  };

  return Object.freeze({
    GOOGLE_CLIENT_ID,
    ADMIN_EMAIL,
    ADMIN_INITIAL_PASSWORD,
    STORAGE_KEYS,
    isGoogleReal: () => typeof GOOGLE_CLIENT_ID === "string" && GOOGLE_CLIENT_ID.trim().length > 0,
  });
})();
