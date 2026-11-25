/* =====================================================================
   comun.js — Cliente de Supabase y utilidades compartidas
   Se importa como módulo ES desde cada página.
   ===================================================================== */

const CFG = window.VITRAL_CONFIG || {};

export const configurado = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
export const config = CFG;

/** Cliente único de Supabase (null si falta configuración). */
export const sb = configurado
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

/* ---------------------------------------------------------------------
   Catálogos de etiquetas
   --------------------------------------------------------------------- */
export const ESTADOS = {
  borrador:                { txt: 'Borrador',                  clase: 'b-neutro' },
  enviada:                 { txt: 'Solicitud enviada',         clase: 'b-info' },
  en_revision:             { txt: 'En revisión',               clase: 'b-info' },
  pendiente_documentacion: { txt: 'Pendiente de documentación', clase: 'b-aviso' },
  requiere_correcciones:   { txt: 'Requiere correcciones',     clase: 'b-aviso' },
  aprobado:                { txt: 'Aprobado',                  clase: 'b-exito' },
  rechazado:               { txt: 'Rechazado',                 clase: 'b-error' },
  suspendido:              { txt: 'Suspendido',                clase: 'b-error' }
};

export const DISPONIBILIDAD = {
  disponible:      { txt: 'Disponible',      clase: 'b-exito' },
  limitada:        { txt: 'Disponibilidad limitada', clase: 'b-aviso' },
  bajo_pedido:     { txt: 'Bajo pedido',     clase: 'b-info' },
  agotado:         { txt: 'Agotado',         clase: 'b-error' },
  sin_especificar: { txt: 'Sin especificar', clase: 'b-neutro' }
};

export const ESTADOS_CERT = {
  declarada: { txt: 'Declarada',   clase: 'b-neutro', ayuda: 'Registrada sin documento revisado por el CLRAH' },
  pendiente: { txt: 'En revisión', clase: 'b-info',   ayuda: 'Documento enviado, pendiente de revisión' },
  validada:  { txt: 'Validada',    clase: 'b-exito',  ayuda: 'Revisada y validada por el CLRAH' },
  rechazada: { txt: 'Rechazada',   clase: 'b-error',  ayuda: 'No fue aceptada; revise las observaciones' },
  vencida:   { txt: 'Vencida',     clase: 'b-aviso',  ayuda: 'La vigencia expiró' }
};

export const PROVINCIAS = [
  'Bocas del Toro', 'Chiriquí', 'Coclé', 'Colón', 'Darién', 'Herrera', 'Los Santos',
  'Panamá', 'Panamá Oeste', 'Veraguas', 'Comarca Guna Yala', 'Comarca Emberá-Wounaan',
  'Comarca Ngäbe-Buglé', 'Comarca Naso Tjër Di'
];

/* ---------------------------------------------------------------------
   Utilidades de texto y formato
   --------------------------------------------------------------------- */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function normalizar(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function fecha(v, conHora = false) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  const o = { day: '2-digit', month: 'short', year: 'numeric' };
  if (conHora) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-PA', o);
}

export function numero(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('es-PA', { maximumFractionDigits: 2 });
}

export function badge(mapa, clave, extra = '') {
  const e = mapa[clave] || { txt: clave || '—', clase: 'b-neutro' };
  const t = e.ayuda ? ` title="${esc(e.ayuda)}"` : '';
  return `<span class="badge ${e.clase} ${extra}"${t}>${esc(e.txt)}</span>`;
}

export function iniciales(nombre) {
  const p = String(nombre || '').replace(/[,.]/g, ' ').split(/\s+/)
    .filter(w => w && !/^(s|a|de|del|la|el|y|sa|inc|corp)$/i.test(w));
  return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

export function urlSegura(u) {
  if (!u) return null;
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+/.test(s)) return 'https://' + s;
  return null;
}

export function urlLogo(path) {
  if (!path || !sb) return null;
  return sb.storage.from('logos').getPublicUrl(path).data.publicUrl;
}

export function parametro(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}

/* ---------------------------------------------------------------------
   Mensajes de error comprensibles
   --------------------------------------------------------------------- */
export function mensajeError(e) {
  if (!e) return 'Ocurrió un error inesperado.';
  const m = e.message || String(e);
  if (e.code === '42501' || /row-level security|permission denied|No autorizado/i.test(m)) {
    return /No autorizado|solo|administrador/i.test(m) && !/row-level/i.test(m)
      ? m : 'No tienes permiso para realizar esta acción.';
  }
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
  if (/User already registered/i.test(m)) return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No fue posible conectar con el servidor. Verifica tu conexión.';
  if (/duplicate key/i.test(m)) return 'Ya existe un registro con ese nombre.';
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return 'El archivo supera el tamaño permitido.';
  if (/mime type/i.test(m)) return 'Tipo de archivo no permitido.';
  return m;
}

/* ---------------------------------------------------------------------
   Toast, modal y confirmación
   --------------------------------------------------------------------- */
export function toast(texto, tipo = 'info', ms = 4200) {
  let cont = $('.toasts');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'toasts';
    cont.setAttribute('role', 'status');
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.textContent = texto;
  cont.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/**
 * Abre un modal. contenido: HTML del cuerpo. Devuelve { el, cerrar }.
 * opciones: { titulo, subtitulo, tam: 'chico'|'grande', pie: HTML, alCerrar }
 */
export function abrirModal(contenido, op = {}) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `
    <div class="modal ${op.tam || ''}" role="dialog" aria-modal="true" aria-labelledby="modal-tit">
      <div class="modal-cab">
        <div><h2 id="modal-tit">${esc(op.titulo || '')}</h2>${op.subtitulo ? `<p>${esc(op.subtitulo)}</p>` : ''}</div>
        <button class="cerrar" type="button" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-cuerpo">${contenido}</div>
      ${op.pie ? `<div class="modal-pie">${op.pie}</div>` : ''}
    </div>`;
  const previo = document.activeElement;
  const cerrar = () => {
    fondo.remove();
    document.removeEventListener('keydown', alTecla);
    document.body.style.overflow = '';
    previo?.focus?.();
    op.alCerrar?.();
  };
  const alTecla = e => { if (e.key === 'Escape') cerrar(); };
  fondo.addEventListener('mousedown', e => { if (e.target === fondo) cerrar(); });
  fondo.querySelector('.cerrar').addEventListener('click', cerrar);
  document.addEventListener('keydown', alTecla);
  document.body.appendChild(fondo);
  document.body.style.overflow = 'hidden';
  const enfocable = fondo.querySelector('.modal-cuerpo input, .modal-cuerpo select, .modal-cuerpo textarea, .modal-pie .btn-primario');
  (enfocable || fondo.querySelector('.cerrar')).focus();
  return { el: fondo, cerrar };
}

/** Confirmación con promesa. peligro=true muestra el botón en rojo suave. */
export function confirmar(mensaje, { titulo = 'Confirmar acción', aceptar = 'Confirmar', peligro = false } = {}) {
  return new Promise(res => {
    let decidido = false;
    const m = abrirModal(`<p style="font-size:13px;color:var(--text2);white-space:pre-line">${esc(mensaje)}</p>`, {
      titulo, tam: 'chico',
      pie: `<button class="btn btn-sec" data-r="0" type="button">Cancelar</button>
            <button class="btn ${peligro ? 'btn-acento' : 'btn-primario'}" data-r="1" type="button">${esc(aceptar)}</button>`,
      alCerrar: () => { if (!decidido) res(false); }
    });
    m.el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => {
      decidido = true; res(b.dataset.r === '1'); m.cerrar();
    }));
  });
}

/** Marca un botón como "cargando" mientras se ejecuta fn. */
export async function conCarga(boton, fn) {
  if (boton) { boton.classList.add('cargando'); boton.disabled = true; }
  try { return await fn(); }
  finally { if (boton) { boton.classList.remove('cargando'); boton.disabled = false; } }
}

/* ---------------------------------------------------------------------
   Sesión y perfil
   --------------------------------------------------------------------- */
export async function sesionActual() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/** Devuelve { usuario, perfil } o null si no hay sesión. */
export async function cargarPerfil() {
  const s = await sesionActual();
  if (!s) return null;
  const { data, error } = await sb.from('perfiles').select('id, rol, empresa_id, nombre, activo').eq('id', s.user.id).maybeSingle();
  if (error) throw error;
  return { usuario: s.user, perfil: data };
}

export async function cerrarSesion() {
  await sb?.auth.signOut();
  location.href = 'index.html';
}

/** Exige sesión (y opcionalmente rol). Redirige al acceso si no cumple. */
export async function exigirSesion(rol = null) {
  const r = await cargarPerfil();
  if (!r || !r.perfil) {
    location.href = 'acceso.html?volver=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return null;
  }
  if (!r.perfil.activo) {
    await sb.auth.signOut();
    location.href = 'acceso.html?inactiva=1';
    return null;
  }
  if (rol && r.perfil.rol !== rol) {
    location.href = r.perfil.rol === 'admin' ? 'admin.html' : 'panel.html';
    return null;
  }
  return r;
}

/* ---------------------------------------------------------------------
   Header común
   --------------------------------------------------------------------- */
export function pintarHeader({ subtitulo = 'Vitral de Proveedores', acciones = '' } = {}) {
  const hdr = $('#hdr');
  if (!hdr) return;
  const logo = CFG.logoUrl
    ? `<img class="hdr-logo" src="${esc(CFG.logoUrl)}" alt="CLRAH"><span class="hdr-sep" aria-hidden="true"></span>` : '';
  hdr.innerHTML = `
    <a class="hdr-marca" href="index.html">
      ${logo}
      <span class="hdr-textos">
        <span class="hdr-titulo">Observatorio del CLRAH</span>
        <span class="hdr-sub">${esc(subtitulo)}</span>
      </span>
    </a>
    <nav class="hdr-acciones" aria-label="Acciones">${acciones}</nav>`;
}

/** Acciones del header según la sesión (para páginas públicas). */
export async function accionesSesionPublica() {
  const r = configurado ? await cargarPerfil().catch(() => null) : null;
  if (r?.perfil) {
    const destino = r.perfil.rol === 'admin' ? 'admin.html' : 'panel.html';
    const txt = r.perfil.rol === 'admin' ? 'Administración' : 'Mi panel';
    return `<a class="btn btn-hdr destacado" href="${destino}">${txt}</a>`;
  }
  return `<a class="btn btn-hdr" href="registro.html"><span class="txt-largo">Registrar mi empresa</span><span class="txt-corto">Registro</span></a>
          <a class="btn btn-hdr destacado" href="acceso.html"><span class="txt-largo">Acceso proveedores</span><span class="txt-corto">Acceso</span></a>`;
}

/** Aviso visible cuando la instalación no tiene Supabase configurado. */
export function avisoSinConfiguracion(destino) {
  destino.innerHTML = `
    <div class="alerta aviso">
      <strong>Configuración pendiente</strong>
      El Vitral aún no está conectado a su base de datos. Edite <code>js/config.js</code> con la URL y la clave
      pública de Supabase (ver Manual técnico, sección 3). No se muestran datos de ejemplo.
    </div>`;
}

export function pie() {
  const p = $('#pie');
  if (p) p.innerHTML = `<span>Centro Logístico Regional de Asistencia Humanitaria · Observatorio del CLRAH</span>
    <span>Contacto: <a href="mailto:${esc(CFG.correoContacto)}">${esc(CFG.correoContacto)}</a></span>`;
}

/* ---------------------------------------------------------------------
   Pestañas accesibles: botones [role=tab][data-tab] y paneles [data-panel]
   --------------------------------------------------------------------- */
export function activarTabs(raiz, alCambiar) {
  const tabs = $$('[role=tab]', raiz);
  const ir = id => {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== id; });
    history.replaceState(null, '', '#' + id);
    alCambiar?.(id);
  };
  tabs.forEach(t => t.addEventListener('click', () => ir(t.dataset.tab)));
  raiz.addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); n.click();
  });
  const inicial = location.hash.slice(1);
  ir(tabs.some(t => t.dataset.tab === inicial) ? inicial : tabs[0].dataset.tab);
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (tabs.some(t => t.dataset.tab === h)) ir(h);
  });
  return ir;
}

/** Lee un formulario a objeto; convierte vacíos en null. */
export function leerForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { if (!el.dataset.grupo) o[el.name] = el.checked; continue; }
    const v = el.value.trim();
    o[el.name] = v === '' ? null : v;
  }
  return o;
}

/** Muestra errores de validación junto a cada campo. errores: { nombre: 'mensaje' } */
export function marcarErrores(form, errores) {
  $$('.error-campo', form).forEach(e => e.remove());
  $$('[aria-invalid]', form).forEach(e => e.removeAttribute('aria-invalid'));
  let primero = null;
  for (const [nombre, msg] of Object.entries(errores)) {
    const el = form.elements[nombre];
    if (!el) continue;
    el.setAttribute('aria-invalid', 'true');
    const s = document.createElement('span');
    s.className = 'error-campo';
    s.textContent = msg;
    (el.closest('.campo') || el.parentElement).appendChild(s);
    primero ??= el;
  }
  primero?.focus();
  return !primero;
}

export const correoValido = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || '');

/**
 * Descarga todas las filas de una consulta en bloques de 1000
 * (Supabase limita cada respuesta a 1000 filas por defecto).
 * crear: función que devuelve un query builder nuevo en cada llamada.
 */
export async function todos(crear, bloque = 1000) {
  const out = [];
  for (let desde = 0; ; desde += bloque) {
    const { data, error } = await crear().range(desde, desde + bloque - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < bloque) return out;
  }
}

/** Nombre de archivo seguro para Storage. */
export function nombreArchivo(nombre) {
  const ext = (String(nombre).match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
  const base = normalizar(String(nombre).replace(/\.[^.]+$/, '')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'archivo';
  return `${Date.now()}-${base}${ext}`;
}

/** Abre un documento privado mediante una URL firmada de corta duración. */
export async function verDocumento(ruta) {
  const ventana = window.open('', '_blank');
  const { data, error } = await sb.storage.from('documentos').createSignedUrl(ruta, 120);
  if (error) { ventana?.close(); toast(mensajeError(error), 'error'); return; }
  if (ventana) ventana.location = data.signedUrl; else location.href = data.signedUrl;
}
