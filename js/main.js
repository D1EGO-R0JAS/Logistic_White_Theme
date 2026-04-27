/* ═══════════════════════════════════════════════════════════
   LOGISTIC SUPPORT — main.js
   Módulos: Loading · Navbar · MobileMenu · Reveal · Counters
            Marquee · HeroImage · MapModal · TRM · SvcFlip
            LazyInit
═══════════════════════════════════════════════════════════ */

/* ── Utilidades globales ──────────────────────────────────── */
/* Cede el control al navegador entre tareas pesadas (Layout/Paint). */
function yieldMain() {
  return 'scheduler' in window && 'yield' in scheduler
    ? scheduler.yield()
    : new Promise(r => setTimeout(r, 0));
}

/**
 * Escapa caracteres HTML especiales para prevenir XSS al insertar
 * contenido dinámico (datos de API) en innerHTML.
 * CRÍTICO: sin esta función, escapeHTML() lanza ReferenceError en runtime.
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Crea un AbortSignal con timeout compatible con Safari < 16 y Chrome < 103.
 * AbortSignal.timeout() estático no está disponible en esos navegadores.
 */
function makeTimeoutSignal(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/* ── Navbar scroll — agrega .scrolled cuando se baja de 60 px ── */
/* El CSS de .scrolled opacifica el fondo del nav; la transición
   background .35s ease ya existe en el stylesheet. */
(function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
      ticking = false;
    });
  }, { passive: true });
})();

/* ── Loading screen ───────────────────────────────────────── */
window.addEventListener('load', () => {
  const ld = document.getElementById('loading');

  function hideLoader() {
    /* rAF asegura que cualquier recálculo de estilos pendiente (p.ej. el
       cambio de media="print"→"all" de styles.min.css) haya completado su
       repaint antes de descubrir el contenido. */
    requestAnimationFrame(() => {
      ld.classList.add('out');
      document.body.classList.remove('is-loading');

      /* Elimina el nodo del DOM al concluir la transición de opacidad.
         { once:true } evita listeners huérfanos. */
      ld.addEventListener('transitionend', () => ld.remove(), { once: true });

      async function run() {
        initReveal();
        await yieldMain();
        initCounters();
        await yieldMain();
        initLazySections();
      }
      'requestIdleCallback' in window
        ? requestIdleCallback(() => run(), { timeout: 300 })
        : run();
    });
  }

  setTimeout(hideLoader, 400);
}, { once: true });

/* ── Mobile menu ──────────────────────────────────────────── */
const ham = document.getElementById('ham');
const mob = document.getElementById('mob');

function toggleMob() {
  const open = mob.classList.toggle('open');
  ham.classList.toggle('open', open);
  ham.setAttribute('aria-expanded', open ? 'true' : 'false');
  ham.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeMob() {
  mob.classList.remove('open');
  ham.classList.remove('open');
  ham.setAttribute('aria-expanded', 'false');
  ham.setAttribute('aria-label', 'Abrir menú');
  document.body.style.overflow = '';
}

/* Close on outside tap */
document.addEventListener('click', e => {
  if (mob.classList.contains('open') && !mob.contains(e.target) && !ham.contains(e.target)) closeMob();
});

/* ── Scroll Reveal ────────────────────────────────────────── */
function initReveal() {
  const els = document.querySelectorAll('.rv, .rv-l, .rv-r');
  if (!els.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -55px 0px' });

  els.forEach(el => obs.observe(el));
}

/* ── Numeric counters ─────────────────────────────────────── */
/* scope limita la búsqueda a una sección concreta; por defecto
   solo registra los contadores del #hero (above the fold).
   Las secciones below-fold registran sus propios contadores
   de forma lazy en initLazySections(). */
function initCounters(scope = document.getElementById('hero')) {
  const root     = scope || document;
  const counters = root.querySelectorAll('[data-target]');
  if (!counters.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !e.target.dataset.done) {
        e.target.dataset.done = '1';
        animNum(e.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => obs.observe(el));
}

function animNum(el) {
  const target = +el.dataset.target;
  const suffix = el.dataset.suffix || '';
  const dur    = 1800;
  const t0     = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const tick = now => {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = Math.floor(easeOut(p) * target).toLocaleString('es-CO') + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── Marquee duplication ──────────────────────────────────── */
/* Guarda el HTML original antes de duplicar para evitar cuadruplicación
   si la función se llamara más de una vez (ej. hot-reload, SPA). */
function duplicateMarquees() {
  ['mq1', 'mq2'].forEach(id => {
    const t = document.getElementById(id);
    if (!t || t.dataset.duped) return;   // guard: no duplicar dos veces
    t.innerHTML += t.innerHTML;
    t.dataset.duped = '1';
  });
}


/* ══════════════════════════════════════════════════════════
   LAZY SECTION INIT
   ─────────────────────────────────────────────────────────
   DECISIÓN DE ENFOQUE: Se mantiene todo el HTML en el DOM.
   Mover secciones a <template> rompería:
     - href="#id" del navbar y footer (el elemento no existiría
       al hacer clic si aún no se ha hidratado).
     - Las referencias directas mapModal / trmWidget capturadas
       al inicio del script.
     - Los onclick inline de .sede-card (openMap) y .fabs.

   En cambio, diferimos únicamente la inicialización JS costosa
   de cada sección hasta que se aproxima al viewport (200 px
   de margen). Esto libera el hilo principal durante la carga
   inicial sin tocar el HTML ni romper la navegación.

   Beneficios concretos:
     - duplicateMarquees() (~24 nodos nuevos) → solo cuando
       #puertos entra al viewport.
     - _initServicios() (registro de N listeners extra) → solo
       cuando #servicios entra al viewport.
     - IntersectionObserver reveal/counters ya funciona de forma
       inherentemente lazy — no requiere trabajo adicional aquí.
══════════════════════════════════════════════════════════ */
function initLazySections() {
  const sectionInits = {
    puertos:     _initPuertos,
    nosotros:    _initNosotrosCounters,
    servicios:   _initServicios,
    sedes:       null,
    seguimiento: null,
    valores:     _initValoresCounters,
    footer:      null,
  };

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      const fn = sectionInits[id];
      if (typeof fn === 'function') fn();
      obs.unobserve(entry.target);
    });
  }, { rootMargin: '200px 0px 200px 0px', threshold: 0 });

  Object.keys(sectionInits).forEach(id => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
}

/* Init de #puertos: duplica los tracks del marquee */
function _initPuertos() {
  duplicateMarquees();
}

/* Init de contadores lazy (below fold) */
function _initNosotrosCounters() {
  initCounters(document.getElementById('nosotros'));
}

function _initValoresCounters() {
  initCounters(document.getElementById('valores'));
}

/* Init de #servicios: registra flip en tarjetas sin inicializar.
   initSvcFlip IIFE ya lo hace al cargar; este hook cubre
   posibles tarjetas inyectadas dinámicamente en el futuro. */
function _initServicios() {
  const isTouch = window.matchMedia('(hover: none)').matches;
  document.querySelectorAll('.svc-card:not([data-flip-ready])').forEach(card => {
    card.dataset.flipReady = '1';
    if (isTouch) {
      card.addEventListener('click', e => {
        if (!e.target.closest('a')) card.classList.toggle('flipped');
      });
    }
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('flipped');
      }
    });
  });
}

/* ── Smooth scroll helper ─────────────────────────────────── */
function goTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  closeMob();
}

/* ── WhatsApp FAB — valida placeholder antes de abrir ─────── */
function openWhatsApp(el) {
  const wa = el.dataset.wa || '';
  if (!wa || wa.indexOf('[TU_NUMERO]') !== -1) {
    alert('El botón de WhatsApp aún no ha sido configurado.\nPor favor contacte al administrador del sitio.');
    return;
  }
  window.open(wa, '_blank', 'noopener,noreferrer');
}

/* ── Map Modal ────────────────────────────────────────────── */
let mapModal = null, mapIframe = null, mapCityEl = null;
let mapInited = false;

function _initMap() {
  if (mapInited) return;
  mapInited = true;
  mapModal  = document.getElementById('map-modal');
  mapIframe = document.getElementById('map-iframe');
  mapCityEl = document.getElementById('map-city');
  mapModal?.addEventListener('click', e => {
    if (e.target === mapModal) closeMap();
  });
}

function openMap(city, lat, lng) {
  _initMap();
  if (!mapModal) return;
  /* Cierra el menú móvil si estuviera abierto para evitar conflicto
     de body.overflow entre mob-menu y map-modal. */
  closeMob();
  mapCityEl.textContent = city;
  mapIframe.src = `https://maps.google.com/maps?q=${lat},${lng}&output=embed&hl=es&z=16`;
  mapModal.classList.add('open');
  mapModal.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
  mapModal.querySelector('.map-close-btn').focus();
}

function closeMap() {
  if (!mapModal) return;
  mapModal.classList.remove('open');
  mapModal.setAttribute('aria-hidden', 'true');
  /* Solo libera el scroll si el menú móvil también está cerrado */
  if (!mob.classList.contains('open')) {
    document.body.style.overflow = '';
  }
  /* Limpiar src para liberar memoria */
  setTimeout(() => { mapIframe.src = ''; }, 300);
}

/* Close on Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (mapModal?.classList.contains('open'))   closeMap();
    if (trmWidget?.classList.contains('open'))  closeTRM();
  }
});

/* ══════════════════════════════════════════════════════════
   TRM WIDGET — USD·EUR·GBP·JPY ↔ COP
══════════════════════════════════════════════════════════ */
let trmWidget = null;
function _ensureTRM() {
  if (!trmWidget) trmWidget = document.getElementById('trm-widget');
}

/* Estado */
const state = {
  trm:   null,          // COP por 1 USD (fuente: datos.gov.co)
  rates: {},            // { EUR: 0.92, GBP: 0.79, JPY: 149.5 } — frente al USD
  sel:   'USD',         // divisa activa en conversor
  date:  '',
};

/* Mapa de divisas: clave → { label, emoji, decimals } */
const CURRENCIES = {
  USD: { label: 'Dólar USD',    emoji: '🇺🇸', dec: 2 },
  EUR: { label: 'Euro EUR',     emoji: '🇪🇺', dec: 2 },
  GBP: { label: 'Libra GBP',   emoji: '🇬🇧', dec: 2 },
  JPY: { label: 'Yen JPY',     emoji: '🇯🇵', dec: 0 },
};

function toggleTRM() {
  _ensureTRM();
  if (!trmWidget) return;
  const open = trmWidget.classList.toggle('open');
  trmWidget.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open && !state.trm) fetchAll();
}
function closeTRM() {
  _ensureTRM();
  if (!trmWidget) return;
  trmWidget.classList.remove('open');
  trmWidget.setAttribute('aria-hidden', 'true');
}

/* ── Fetch TRM oficial (datos.gov.co) ─── */
async function fetchTRM_API() {
  const res = await fetch(
    'https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde DESC',
    { headers: { Accept: 'application/json' }, signal: makeTimeoutSignal(6000) }
  );
  if (!res.ok) throw new Error('TRM HTTP ' + res.status);
  const [row] = await res.json();
  if (!row) throw new Error('TRM vacío');
  return { valor: parseFloat(row.valor), fecha: row.vigenciadesde };
}

/* ── Fetch cross-rates (Frankfurter — ECB, sin API key) ─── */
async function fetchRates_API() {
  const res = await fetch(
    'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY',
    { signal: makeTimeoutSignal(6000) }
  );
  if (!res.ok) throw new Error('Rates HTTP ' + res.status);
  const data = await res.json();
  return data.rates; // { EUR: 0.92, GBP: 0.79, JPY: 149.5 }
}

/* ── Orquestador ─────────────────────────── */
async function fetchAll() {
  setTRMStatus('Consultando tasas...');
  try {
    const [trmData, rates] = await Promise.allSettled([fetchTRM_API(), fetchRates_API()]);

    /* TRM */
    if (trmData.status === 'fulfilled') {
      state.trm  = trmData.value.valor;
      state.date = trmData.value.fecha;
    } else {
      state.trm  = 4200; // fallback
      state.date = null;
      console.warn('TRM fallback:', trmData.reason);
    }

    /* Cross-rates */
    if (rates.status === 'fulfilled') {
      state.rates = rates.value;
    } else {
      state.rates = { EUR: 0.925, GBP: 0.795, JPY: 149.8 }; // fallback
      console.warn('Rates fallback:', rates.reason);
    }

    renderTRM();
    setTRMStatus('');
  } catch (err) {
    setTRMStatus('Error al consultar. Usando valores de referencia.');
    state.trm   = 4200;
    state.rates = { EUR: 0.925, GBP: 0.795, JPY: 149.8 };
    renderTRM();
  }
}

/* ── Calcular COP por unidad de divisa ─── */
function copPerUnit(cur) {
  if (!state.trm) return null;
  if (cur === 'USD') return state.trm;
  const usdPerUnit = 1 / (state.rates[cur] || 1);
  return usdPerUnit * state.trm;
}

/* ── Render ──────────────────────────────── */
function renderTRM() {
  /* Rate principal (TRM USD/COP) */
  const valEl  = document.getElementById('trm-val');
  const dateEl = document.getElementById('trm-date');
  if (valEl) {
    valEl.textContent = state.trm
      ? '$ ' + state.trm.toLocaleString('es-CO', { minimumFractionDigits:2, maximumFractionDigits:2 })
      : '—';
  }
  if (dateEl && state.date) {
    const d = new Date(state.date);
    dateEl.textContent = 'Vigencia: ' + d.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
  }

  /* Grilla de divisas */
  const grid = document.getElementById('trm-rates-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(CURRENCIES).map(([cur, info]) => {
    const cop  = copPerUnit(cur);
    const val  = cop ? cop.toLocaleString('es-CO', { minimumFractionDigits: info.dec, maximumFractionDigits: info.dec }) : '—';
    const sel  = cur === state.sel ? ' sel' : '';
    return `
      <div class="trm-rate-cell${sel}" onclick="selectCurrency('${cur}')" role="button" tabindex="0">
        <div class="trm-cell-pair">${info.emoji} ${cur} → COP</div>
        <div class="trm-cell-val">$ ${val}</div>
      </div>`;
  }).join('');

  /* Tabs — actualizar clase active y aria-selected */
  document.querySelectorAll('.trm-tab').forEach(t => {
    const isActive = t.dataset.cur === state.sel;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  /* Actualizar label del input base */
  const lbl = document.getElementById('trm-from-lbl');
  if (lbl) lbl.textContent = CURRENCIES[state.sel]?.label || state.sel;

  /* Resetear inputs */
  const inp1 = document.getElementById('trm-from');
  const inp2 = document.getElementById('trm-to');
  if (inp1) inp1.value = '';
  if (inp2) inp2.value = '';
}

function selectCurrency(cur) {
  state.sel = cur;
  renderTRM();
}

function setTRMStatus(msg) {
  const el = document.getElementById('trm-status');
  if (el) el.textContent = msg;
}

/* ── Conversor ───────────────────────────── */
/*
 * NOTA: Ambos inputs son type="number", por lo que el navegador solo
 * acepta notación de punto decimal estándar (no formato localizado).
 * Se usa toFixed() para escribir valores que el input numérico pueda leer.
 * toLocaleString() en inp2.value causaría que el browser rechazara el valor
 * y la conversión inversa (cvtTo) leería "" → 0.
 */
function cvtFrom() {
  const inp1 = document.getElementById('trm-from');
  const inp2 = document.getElementById('trm-to');
  if (!inp1 || !inp2) return;
  const val = parseFloat(inp1.value) || 0;
  const rate = copPerUnit(state.sel);
  /* Usar toFixed(2) — formato numérico estándar compatible con type="number" */
  inp2.value = rate ? (val * rate).toFixed(2) : '';
}

function cvtTo() {
  const inp1 = document.getElementById('trm-from');
  const inp2 = document.getElementById('trm-to');
  if (!inp1 || !inp2) return;
  /* inp2 es type="number": inp2.value ya devuelve notación estándar (punto decimal).
     El replace es innecesario aquí, pero se mantiene como fallback defensivo. */
  const raw  = inp2.value.replace(/\./g,'').replace(',','.');
  const val  = parseFloat(inp2.value) || 0;
  const rate = copPerUnit(state.sel);
  inp1.value = rate ? (val / rate).toFixed(CURRENCIES[state.sel]?.dec ?? 2) : '';
}

/* ── Close on outside click ──────────────── */
document.addEventListener('click', e => {
  const btn = document.querySelector('.btn-fab-trm');
  if (trmWidget?.classList.contains('open') && !trmWidget.contains(e.target) && !btn?.contains(e.target)) {
    closeTRM();
  }
});

/* ── Refresh button ──────────────────────── */
function refreshTRM() {
  state.trm   = null;
  state.rates = {};
  fetchAll();
}

/* ── Service card flip (touch / keyboard) ─ */
function initSvcFlip() {
  const cards = document.querySelectorAll('.svc-card');
  const isTouch = window.matchMedia('(hover: none)').matches;

  cards.forEach(card => {
    card.dataset.flipReady = '1';

    if (isTouch) {
      card.addEventListener('click', e => {
        if (!e.target.closest('a')) card.classList.toggle('flipped');
      });
    }

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('flipped');
      }
    });
  });
}
'requestIdleCallback' in window
  ? requestIdleCallback(initSvcFlip, { timeout: 2000 })
  : setTimeout(initSvcFlip, 0);

/* Tracking Carga */
const API_URL = "https://script.google.com/macros/s/AKfycbwMrwRk9FSjZcV9RuYzewb0ccrZG2n9XXF_nT28d0mIOwNj5WdL1L_zGnswLauvYm1O/exec";

const CAMPOS_META = ["CLIENTE", "CANAL", "TIPO_SERVICIO", "PROCESO"];

  // ─── CONSULTAR ────────────────────────────────────────────────
  async function consultar() {
    const codCliente  = document.getElementById("inputCliente").value.trim();
    const codServicio = document.getElementById("inputServicio").value.trim();
    const resultado   = document.getElementById("resultado");

    if (!codCliente || !codServicio) {
      mostrarError("Por favor ingresa el Código de Cliente y el Código de Servicio.");
      return;
    }

    setLoading(true);
    resultado.innerHTML = `
      <div class="msg-box msg-loading">
        <div class="mini-spinner"></div>
        Consultando información, por favor espera...
      </div>
    `;

    const url = `${API_URL}?cod_cliente=${encodeURIComponent(codCliente)}&cod_servicio=${encodeURIComponent(codServicio)}`;

    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const res  = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.error) {
        mostrarError(data.error);
      } else {
        renderResultado(data);
      }

    } catch (err) {
      if (err.name === "AbortError") {
        mostrarError("La consulta tardó demasiado. Intenta nuevamente.");
      } else {
        mostrarError("Error de conexión. Verifica tu red e intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── RENDER RESULTADO ─────────────────────────────────────────
  /* El trabajo de templating (escapeHTML × N campos, concatenación de strings)
     se delega a tracking-worker.js para liberar el hilo principal.
     Fallback síncrono si el navegador no soporta Worker. */
  function renderResultado(data) {
    const resultado = document.getElementById("resultado");

    if (window.Worker) {
      const worker = new Worker('js/tracking-worker.js');
      worker.onmessage = function (e) {
        resultado.innerHTML = e.data.metaHTML + e.data.tablaHTML;
        worker.terminate();
      };
      worker.onerror = function () {
        worker.terminate();
        _renderResultadoSync(data, resultado);
      };
      worker.postMessage(data);
    } else {
      _renderResultadoSync(data, resultado);
    }
  }

  function _renderResultadoSync(data, resultado) {
    const meta   = {};
    const campos = {};

    for (const [k, v] of Object.entries(data)) {
      if (CAMPOS_META.includes(k)) meta[k] = v;
      else campos[k] = v;
    }

    const metaLabels = {
      CLIENTE: "Cliente", CANAL: "Canal",
      TIPO_SERVICIO: "Tipo de Servicio", PROCESO: "Proceso",
    };

    let metaHTML = '<div class="meta-banner">';
    for (const [k, label] of Object.entries(metaLabels)) {
      if (meta[k]) {
        metaHTML +=
          `<div class="meta-item">` +
            `<span class="meta-label">${escapeHTML(label)}</span>` +
            `<span class="meta-value ${k === 'CLIENTE' ? 'accent' : ''}">${escapeHTML(String(meta[k]))}</span>` +
          `</div>`;
      }
    }
    metaHTML += '</div>';

    let tablaHTML = '<div class="result-card"><h3>📋 Detalle del Servicio</h3>';
    for (const [campo, valor] of Object.entries(campos)) {
      const esVacio = !valor || valor === '-';
      tablaHTML +=
        `<div class="campo-row">` +
          `<div class="campo-label">${escapeHTML(campo)}</div>` +
          `<div class="campo-valor ${esVacio ? 'vacio' : ''}">${esVacio ? 'Sin información' : escapeHTML(String(valor))}</div>` +
        `</div>`;
    }
    tablaHTML += '</div>';

    resultado.innerHTML = metaHTML + tablaHTML;
  }

  // ─── MOSTRAR ERROR ────────────────────────────────────────────
  function mostrarError(msg) {
    document.getElementById("resultado").innerHTML = `
      <div class="msg-box msg-error">⚠️ ${escapeHTML(msg)}</div>
    `;
  }

  // ─── ESTADO DE CARGA ──────────────────────────────────────────
  function setLoading(loading) {
    const btn     = document.getElementById("btnConsultar");
    const text    = document.getElementById("btnText");
    const spinner = document.getElementById("btnSpinner");

    btn.disabled        = loading;
    text.textContent    = loading ? "Consultando..." : "Consultar Servicio";
    spinner.style.display = loading ? "block" : "none";
  }