/* =========================================================
   animations.js — Anime.js v4 no vocabulário do BoardUI
   Referência de movimento (motion.md):
     • entradas = fade + escala 95% + blur 2px (condensa no lugar)
     • UI 100–300ms · dados 360–400ms · saídas 225ms
     • saída de diálogo: cubic-bezier(0.32, 0.72, 0, 1) em 300ms
     • números trocam por crossfade (220ms), sem contagem progressiva
     • prefers-reduced-motion desliga tudo

   Regra de ouro: animação NUNCA esconde conteúdo. Se a aba está
   oculta (ou o requestAnimationFrame não dispara), os elementos
   aparecem prontos; um temporizador de segurança revela qualquer
   alvo que ainda estiver no quadro inicial da animação.

   O bundle Anime.js é carregado localmente
   (assets/js/anime.umd.min.js) e desestruturado do global `anime`,
   sem CDN externo.
   ========================================================= */

window.OmniMotion = (() => {
  const anime = window.anime;

  // Se o Anime.js não carregar, a aplicação segue funcionando sem animações.
  if (!anime || typeof anime.animate !== "function") return null;

  const { animate, createDraggable, spring } = anime;
  const utils = anime.utils || {};
  const { stagger, cleanInlineStyles } = utils;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Curvas oficiais do BoardUI (com fallback para easings do Anime.js). */
  const EASE_OUT =
    typeof anime.cubicBezier === "function" ? anime.cubicBezier(0.22, 1, 0.36, 1) : "out(3)";
  const EASE_MODAL =
    typeof anime.cubicBezier === "function" ? anime.cubicBezier(0.32, 0.72, 0, 1) : "out(4)";
  const EASE_IN =
    typeof anime.cubicBezier === "function" ? anime.cubicBezier(0.4, 0, 1, 1) : "in(2)";

  /* Margem extra do temporizador de segurança (ms). */
  const SAFETY_MARGIN_MS = 500;

  /* =========================================================
     0. Revelação segura
     ========================================================= */
  function pageVisible() {
    return document.visibilityState === "visible";
  }

  /** Remove o quadro inicial escrito pela animação (opacity/transform/filter). */
  function revealNow(targets) {
    targets.forEach((node) => {
      if (!node || !node.style) return;
      node.style.removeProperty("opacity");
      node.style.removeProperty("transform");
      node.style.removeProperty("filter");
    });
  }

  /**
   * Executa uma animação de entrada sem jamais esconder o conteúdo:
   *  • aba oculta → não anima (o conteúdo já está visível);
   *  • rAF engasgar → um timeout revela os alvos mesmo assim.
   * @param {Array|NodeList} targets alvos da animação
   * @param {Object} params parâmetros do Anime.js
   * @param {number} totalMs duração total declarada (com delays)
   */
  function entranceAnimate(targets, params, totalMs) {
    const list = Array.from(targets).filter(Boolean);
    if (!list.length || !pageVisible()) return null;

    let completed = false;
    const animation = animate(list, {
      ...params,
      onComplete: (instance) => {
        completed = true;
        if (typeof cleanInlineStyles === "function") cleanInlineStyles(instance);
      },
    });

    setTimeout(() => {
      if (completed) return;
      try {
        animation.pause();
      } catch (error) {
        /* já finalizada ou indisponível */
      }
      revealNow(list);
    }, (totalMs || params.duration || 300) + SAFETY_MARGIN_MS);

    return animation;
  }

  /* =========================================================
     1. Logo — bounce contínuo, arrastável e giro ao clicar
        (assinatura visual do projeto)
     ========================================================= */
  function setupLogo() {
    const [logo] = utils.$(".brand__logo");
    const [logoInner] = utils.$(".brand__logo-inner");
    const [button] = utils.$("#rotateLogoBtn");
    const counter = document.querySelector("#rotationCount");

    if (!logo || !logoInner) return;

    let rotations = 0;

    if (!reduceMotion) {
      // Cria um loop de "bounce" no logo
      animate(logo, {
        scale: [
          { to: 1.14, ease: "inOut(3)", duration: 200 },
          { to: 1, ease: spring({ bounce: 0.7 }) },
        ],
        loop: true,
        loopDelay: 250,
      });

      // Torna o logo arrastável ao redor do próprio centro
      createDraggable(logo, {
        container: [0, 0, 0, 0],
        releaseEase: spring({ bounce: 0.7 }),
      });
    }

    // Anima a rotação do logo ao clicar
    const rotateLogo = () => {
      rotations++;
      if (counter) counter.innerText = `${rotations}`;
      entranceAnimate(
        [logoInner],
        { rotate: rotations * 360, ease: "out(4)", duration: 1500 },
        1500
      );
    };

    // Evita girar o logo quando o clique foi, na verdade, um arrasto.
    let downX = 0;
    let downY = 0;
    logo.addEventListener("pointerdown", (event) => {
      downX = event.clientX;
      downY = event.clientY;
    });
    logo.addEventListener("click", (event) => {
      if (Math.abs(event.clientX - downX) + Math.abs(event.clientY - downY) > 6) return;
      rotateLogo();
    });

    if (button) button.addEventListener("click", rotateLogo);
  }

  /** Parâmetros de entrada do BoardUI: fade + scale 95% + blur 2px. */
  function entrance(duration) {
    return {
      opacity: [0, 1],
      scale: [0.95, 1],
      filter: ["blur(2px)", "blur(0px)"],
      duration,
      ease: EASE_OUT,
    };
  }

  /* =========================================================
     2. Entrada do aplicativo (shell) após autenticar
     ========================================================= */
  function appIn(target) {
    if (reduceMotion || !target) return;
    entranceAnimate([target], entrance(300), 300);
  }

  /* =========================================================
     3. Entrada dos cartões de tarefa (stagger, faixa de dados)
     ========================================================= */
  function cardsIn(nodes) {
    if (reduceMotion || !nodes || !nodes.length) return;

    // Limite de animação simultânea para manter o desempenho (RNF-03).
    const list = nodes.slice(0, 48);
    const totalMs = 380 + 18 * Math.max(0, list.length - 1);

    entranceAnimate(list, { ...entrance(380), delay: stagger(18) }, totalMs);
  }

  /* =========================================================
     4. Entrada dos cartões de indicadores (dashboard)
     ========================================================= */
  function statsIn() {
    if (reduceMotion) return;

    const cards = utils.$(".stat-card");
    if (!cards.length) return;

    const totalMs = 400 + 40 * Math.max(0, cards.length - 1);
    entranceAnimate(cards, { ...entrance(400), delay: stagger(40) }, totalMs);
  }

  /* =========================================================
     5. Indicadores numéricos — crossfade (220ms), nunca contagem
     ========================================================= */
  function numberFade(element, text) {
    if (!element) return;
    element.textContent = text; // o número troca antes de qualquer animação
    if (reduceMotion) return;
    entranceAnimate([element], { opacity: [0.35, 1], duration: 220, ease: "linear" }, 220);
  }

  /* =========================================================
     6. Notificações (toasts)
     ========================================================= */
  function toastIn(node) {
    if (reduceMotion) return;
    entranceAnimate(
      [node],
      {
        opacity: [0, 1],
        scale: [0.96, 1],
        x: [12, 0],
        filter: ["blur(2px)", "blur(0px)"],
        duration: 260,
        ease: EASE_OUT,
      },
      260
    );
  }

  function toastOut(node, done) {
    if (reduceMotion) {
      done();
      return;
    }

    let removed = false;
    const finish = () => {
      if (removed) return;
      removed = true;
      done();
    };

    const animation = animate(node, {
      opacity: 0,
      x: 12,
      duration: 225,
      ease: EASE_IN,
      onComplete: (instance) => {
        if (typeof cleanInlineStyles === "function") cleanInlineStyles(instance);
        finish();
      },
    });

    // Sem rAF a notificação não sai sozinha; o timeout garante a remoção.
    setTimeout(() => {
      if (removed) return;
      try {
        animation.pause();
      } catch (error) {
        /* já finalizada */
      }
      revealNow([node]);
      finish();
    }, 225 + SAFETY_MARGIN_MS);
  }

  /* =========================================================
     7. Diálogos — modal curve (0.32, 0.72, 0, 1) em 300ms
        a partir de scale 0.85 + blur 4px
     ========================================================= */
  function dialogIn(dialog) {
    if (reduceMotion || !dialog) return;
    entranceAnimate(
      [dialog],
      {
        opacity: [0, 1],
        scale: [0.85, 1],
        filter: ["blur(4px)", "blur(0px)"],
        duration: 300,
        ease: EASE_MODAL,
      },
      300
    );
  }

  /* =========================================================
     8. Microinterações
     ========================================================= */
  function popIn(selector) {
    if (reduceMotion) return;
    entranceAnimate(utils.$(selector), { opacity: [0, 1], duration: 220, ease: EASE_OUT }, 220);
  }

  function init() {
    setupLogo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { reduceMotion, appIn, cardsIn, statsIn, numberFade, toastIn, toastOut, dialogIn, popIn };
})();
