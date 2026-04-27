/* ── Web Worker: cargo tracking HTML builder ─────────────────
   Recibe el JSON crudo del API y devuelve dos strings HTML
   (metaHTML + tablaHTML) listos para inyectar en el DOM.
   Sin acceso al DOM — puro procesamiento de datos. ──────── */

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CAMPOS_META = ["CLIENTE", "CANAL", "TIPO_SERVICIO", "PROCESO"];

const META_LABELS = {
  CLIENTE:       "Cliente",
  CANAL:         "Canal",
  TIPO_SERVICIO: "Tipo de Servicio",
  PROCESO:       "Proceso",
};

self.onmessage = function (e) {
  const data   = e.data;
  const meta   = {};
  const campos = {};

  for (const [k, v] of Object.entries(data)) {
    if (CAMPOS_META.includes(k)) meta[k] = v;
    else campos[k] = v;
  }

  // Banner de metadatos
  let metaHTML = '<div class="meta-banner">';
  for (const [k, label] of Object.entries(META_LABELS)) {
    if (meta[k]) {
      metaHTML +=
        '<div class="meta-item">' +
          '<span class="meta-label">'  + escapeHTML(label)            + '</span>' +
          '<span class="meta-value '   + (k === 'CLIENTE' ? 'accent' : '') + '">' +
            escapeHTML(String(meta[k])) +
          '</span>' +
        '</div>';
    }
  }
  metaHTML += '</div>';

  // Tabla de campos operativos
  let tablaHTML = '<div class="result-card"><h3>📋 Detalle del Servicio</h3>';
  for (const [campo, valor] of Object.entries(campos)) {
    const esVacio = !valor || valor === '-';
    tablaHTML +=
      '<div class="campo-row">' +
        '<div class="campo-label">'  + escapeHTML(campo) + '</div>' +
        '<div class="campo-valor '   + (esVacio ? 'vacio' : '') + '">' +
          (esVacio ? 'Sin información' : escapeHTML(String(valor))) +
        '</div>' +
      '</div>';
  }
  tablaHTML += '</div>';

  self.postMessage({ metaHTML, tablaHTML });
};
