/* =====================================================================
   vitral.js — Directorio público de proveedores (index.html)
   Fuente de datos: vista pública "vitral_empresas" (solo empresas aprobadas).
   ===================================================================== */
import {
  sb, configurado, $, esc, normalizar, urlSegura, mensajeError,
  pintarHeader, accionesSesionPublica, avisoSinConfiguracion, pie, activarTabs, ESTADOS_CERT
} from './comun.js';
import { mapaDirectorio } from './mapa.js';
import { badgeRegistro, monograma } from './fichas.js';

let empresas = [];
let mapa = null;
let seleccion = null;

const f = {
  q: $('#f-q'), cat: $('#f-cat'), prov: $('#f-prov'), cert: $('#f-cert'),
  tipo: $('#f-tipo'), reg: $('#f-reg'), orden: $('#orden')
};

init();

async function init() {
  pie();
  pintarHeader({ acciones: await accionesSesionPublica() });
  activarTabs($('.tabs'), id => {
    if (id === 'mapa') {
      if (!mapa && window.L) { mapa = mapaDirectorio($('#mapa')); pintarMapa(); }
      mapa?.invalidar();
    }
  });

  if (!configurado) {
    avisoSinConfiguracion($('#aviso'));
    $('#lista').innerHTML = '';
    $('#conteo').textContent = '';
    return;
  }

  try {
    const { data, error } = await sb.from('vitral_empresas').select('*').order('nombre_comercial');
    if (error) throw error;
    empresas = data.map(e => ({
      ...e,
      _busca: normalizar([e.nombre_comercial, e.descripcion, e.actividad_principal, e.texto_inventario,
        (e.categorias || []).map(c => c.nombre).join(' ')].join(' '))
    }));
  } catch (e) {
    $('#lista').innerHTML = `<div class="alerta error" style="grid-column:1/-1"><strong>No fue posible cargar el directorio.</strong>${esc(mensajeError(e))}
      <div class="mt"><button class="btn btn-sec btn-sm" onclick="location.reload()">Reintentar</button></div></div>`;
    $('#conteo').textContent = '';
    return;
  }

  llenarFiltros();
  leerFiltrosURL();
  ['input', 'change'].forEach(ev => $('#filtros').addEventListener(ev, aplicar));
  f.orden.addEventListener('change', aplicar);
  $('#filtros').addEventListener('reset', () => setTimeout(aplicar));
  pintarKPIs();
  aplicar();
}

function llenarFiltros() {
  const cats = new Map(), provs = new Set(), certs = new Set();
  for (const e of empresas) {
    (e.categorias || []).forEach(c => cats.set(c.id, c.nombre));
    String(e.provincia || '').split(',').map(s => s.trim()).filter(Boolean).forEach(p => provs.add(p));
    (e.certificaciones || []).forEach(c => certs.add(c.nombre));
  }
  const opc = (sel, items) => sel.insertAdjacentHTML('beforeend',
    items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(''));
  opc(f.cat, [...cats].sort((a, b) => a[1].localeCompare(b[1], 'es')));
  opc(f.prov, [...provs].sort((a, b) => a.localeCompare(b, 'es')).map(p => [p, p]));
  opc(f.cert, [...certs].sort((a, b) => a.localeCompare(b, 'es')).map(c => [c, c]));
}

function leerFiltrosURL() {
  const p = new URLSearchParams(location.search);
  if (p.get('q')) f.q.value = p.get('q');
  if (p.get('categoria')) f.cat.value = p.get('categoria');
  if (p.get('provincia')) f.prov.value = p.get('provincia');
}

function filtrar() {
  const q = normalizar(f.q.value.trim());
  const palabras = q.split(/\s+/).filter(Boolean);
  return empresas.filter(e => {
    if (palabras.length && !palabras.every(w => e._busca.includes(w))) return false;
    if (f.cat.value && !(e.categorias || []).some(c => c.id === f.cat.value)) return false;
    if (f.prov.value && !String(e.provincia || '').split(',').map(s => s.trim()).includes(f.prov.value)) return false;
    if (f.cert.value === '__alguna' && !(e.certificaciones || []).length) return false;
    if (f.cert.value && f.cert.value !== '__alguna' && !(e.certificaciones || []).some(c => c.nombre === f.cert.value)) return false;
    if (f.tipo.value === 'producto' && !e.n_productos) return false;
    if (f.tipo.value === 'servicio' && !e.n_servicios) return false;
    if (f.tipo.value === 'frio' && e.camara_frigorifica !== true) return false;
    if (f.reg.value === 'cuenta' && !e.cuenta_activa) return false;
    if (f.reg.value === 'referencia' && e.cuenta_activa) return false;
    return true;
  }).sort((a, b) => {
    if (f.orden.value === 'inventario') return (b.n_productos + b.n_servicios) - (a.n_productos + a.n_servicios);
    if (f.orden.value === 'reciente') return String(b.actualizado_en).localeCompare(String(a.actualizado_en));
    return a.nombre_comercial.localeCompare(b.nombre_comercial, 'es');
  });
}

function aplicar() {
  const lista = filtrar();
  const filtrado = lista.length !== empresas.length;
  $('#conteo').innerHTML = `<strong>${lista.length}</strong> ${lista.length === 1 ? 'proveedor' : 'proveedores'}` +
    (filtrado ? ` de ${empresas.length}` : '');
  pintarLista(lista);
  pintarMapa(lista);
}

function pintarKPIs() {
  const n = empresas.length;
  const conCuenta = empresas.filter(e => e.cuenta_activa).length;
  const conCert = empresas.filter(e => (e.certificaciones || []).length).length;
  const validadas = empresas.filter(e => (e.certificaciones || []).some(c => c.estado === 'validada')).length;
  $('#k-prov').textContent = n.toLocaleString('es-PA');
  $('#k-prov-sub').textContent = `${conCuenta} con cuenta activa`;
  $('#k-prod').textContent = empresas.reduce((s, e) => s + Number(e.n_productos || 0), 0).toLocaleString('es-PA');
  $('#k-serv').textContent = empresas.reduce((s, e) => s + Number(e.n_servicios || 0), 0).toLocaleString('es-PA');
  $('#k-cert').textContent = conCert.toLocaleString('es-PA');
  $('#k-cert-sub').textContent = `${validadas} con certificación validada por el CLRAH`;
}

function coincidencias(e) {
  const q = normalizar(f.q.value.trim());
  if (q.length < 3 || normalizar(e.nombre_comercial).includes(q) || !e.texto_inventario) return '';
  const items = e.texto_inventario.split(' | ').filter(t => normalizar(t).includes(q));
  if (!items.length) return '';
  const muestra = items.slice(0, 3).map(esc).join(', ') + (items.length > 3 ? ` y ${items.length - 3} más` : '');
  return `<div class="prov-coinc">En su inventario: ${muestra}</div>`;
}

function tarjeta(e) {
  const url = `empresa.html?id=${encodeURIComponent(e.id)}`;
  const web = urlSegura(e.sitio_web);
  const cats = (e.categorias || []).map(c => `<span class="etiqueta azul">${esc(c.nombre)}</span>`).join('');
  const certs = (e.certificaciones || []).slice(0, 4)
    .map(c => `<span class="etiqueta" title="${esc(ESTADOS_CERT[c.estado]?.ayuda || '')}">${esc(c.nombre)}${c.estado === 'validada' ? ' · validada' : ''}</span>`).join('');
  const extra = (e.certificaciones || []).length > 4 ? `<span class="etiqueta">+${e.certificaciones.length - 4}</span>` : '';
  const ubic = [e.provincia, e.pais].filter(Boolean).join(', ');
  return `
  <article class="prov">
    <div class="prov-cab">
      ${monograma(e)}
      <div class="crece">
        <h2 class="prov-nombre"><a href="${url}">${esc(e.nombre_comercial)}</a></h2>
        <div class="prov-ubic">${esc(ubic || 'Ubicación no registrada')}</div>
        <div class="mt" style="margin-top:6px">${badgeRegistro(e)}</div>
      </div>
    </div>
    <div class="prov-cuerpo">
      ${e.descripcion || e.actividad_principal ? `<p class="prov-desc">${esc(e.descripcion || e.actividad_principal)}</p>` : ''}
      ${cats ? `<div class="prov-etiquetas">${cats}</div>` : ''}
      ${coincidencias(e)}
      ${certs ? `<div><div class="etq" style="margin-bottom:4px">Certificaciones</div><div class="prov-etiquetas">${certs}${extra}</div></div>` : ''}
      <div class="prov-datos">
        <div><span class="etq">Teléfono</span>${e.telefono ? `<a href="tel:${esc(e.telefono.replace(/[^\d+]/g, ''))}">${esc(e.telefono)}</a>` : '<span class="v texto-gris">—</span>'}</div>
        <div><span class="etq">Correo</span>${e.correo ? `<a href="mailto:${esc(e.correo.split(/[\s/]+/)[0])}">${esc(e.correo)}</a>` : '<span class="v texto-gris">—</span>'}</div>
        ${web ? `<div><span class="etq">Sitio web</span><a href="${esc(web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></div>` : ''}
        ${e.camara_frigorifica ? '<div><span class="etq">Almacenamiento</span><span class="v">Cámara frigorífica</span></div>' : ''}
      </div>
    </div>
    <div class="prov-pie">
      <span class="prov-conteo"><strong>${e.n_productos}</strong> productos · <strong>${e.n_servicios}</strong> servicios</span>
      <a class="btn btn-primario btn-sm" href="${url}">Ver perfil e inventario</a>
    </div>
  </article>`;
}

function pintarLista(lista) {
  $('#lista').innerHTML = lista.length
    ? lista.map(tarjeta).join('')
    : `<div class="card vacio" style="grid-column:1/-1"><strong>Sin resultados</strong>
         No hay proveedores que coincidan con los filtros seleccionados.
         <div class="mt"><button class="btn btn-sec btn-sm" type="button" onclick="document.getElementById('filtros').reset()">Limpiar filtros</button></div></div>`;
}

function pintarMapa(lista = filtrar()) {
  if (!mapa) return;
  const con = lista.filter(e => e.lat != null && e.lng != null);
  const sin = lista.length - con.length;
  mapa.pintar(con, e => seleccionar(e.id));
  $('#mapa-sub').textContent = con.length
    ? `${con.length} de ${lista.length} proveedores tienen ubicación registrada.` + (sin ? ` ${sin} aún sin coordenadas.` : '')
    : 'Ninguno de los proveedores filtrados tiene coordenadas registradas todavía.';
  $('#mapa-lista').innerHTML = lista.length ? lista.map(e => `
    <button class="mapa-item" type="button" data-id="${esc(e.id)}" ${seleccion === e.id ? 'aria-current="true"' : ''}>
      <div class="n">${esc(e.nombre_comercial)}</div>
      <div class="s">${esc(e.provincia || '—')}${e.lat == null ? ' · sin ubicación en mapa' : ''}</div>
    </button>`).join('') : '<div class="vacio">Sin resultados</div>';
  $('#mapa-lista').querySelectorAll('.mapa-item').forEach(b => b.addEventListener('click', () => {
    const e = empresas.find(x => x.id === b.dataset.id);
    if (seleccion === e.id) { location.href = `empresa.html?id=${encodeURIComponent(e.id)}`; return; }
    seleccionar(e.id);
  }));
}

function seleccionar(id) {
  seleccion = id;
  const e = empresas.find(x => x.id === id);
  mapa?.resaltar(id);
  $('#mapa-lista').querySelectorAll('.mapa-item').forEach(b => b.toggleAttribute('aria-current', b.dataset.id === id));
  $('#mapa-sub').innerHTML = `<strong>${esc(e.nombre_comercial)}</strong> · ${esc(e.direccion || e.provincia || '')} ·
    <a href="empresa.html?id=${encodeURIComponent(id)}">Ver perfil e inventario</a>`;
}

