/* =====================================================================
   admin.js — Panel de administración del CLRAH (admin.html)
   Solo accesible con rol "admin". Cada operación es validada de nuevo
   por la base de datos (es_admin()), aunque alguien modificara este código.
   ===================================================================== */
import {
  sb, $, $$, esc, normalizar, fecha, badge, mensajeError, toast, abrirModal, confirmar, conCarga, leerForm,
  marcarErrores, exigirSesion, cerrarSesion, pintarHeader, pie, activarTabs, todos, verDocumento,
  ESTADOS, ESTADOS_CERT
} from './comun.js';
import { filaBitacora, CABECERA_BITACORA } from './bitacora.js';

const S = { usuario: null, empresas: [], certs: [], requisitos: [], categorias: [], cuentas: [], config: {} };
const nombreEmpresa = id => S.empresas.find(e => e.id === id)?.nombre_comercial || '—';
const cargados = new Set();

init();

async function init() {
  pie();
  const r = await exigirSesion('admin');
  if (!r) return;
  S.usuario = r.usuario;
  pintarHeader({
    subtitulo: 'Administración',
    acciones: `<span class="hdr-usuario">${esc(r.usuario.email)}</span>
      <a class="btn btn-hdr" href="index.html"><span class="txt-largo">Ver el vitral</span><span class="txt-corto">Vitral</span></a>
      <button class="btn btn-hdr" id="salir"><span class="txt-largo">Cerrar sesión</span><span class="txt-corto">Salir</span></button>`
  });
  $('#salir').addEventListener('click', cerrarSesion);
  try { await cargarBase(); }
  catch (e) { $('#p-solicitudes').innerHTML = `<div class="alerta error"><strong>No fue posible cargar.</strong>${esc(mensajeError(e))}</div>`; return; }
  pintarKPIs();
  activarTabs($('.tabs'), abrirSeccion);
}

async function cargarBase() {
  const [emp, certs, reqs, cats, cfg, ctas] = await Promise.all([
    todos(() => sb.from('resumen_empresas').select('*').order('nombre_comercial')),
    todos(() => sb.from('certificaciones_empresa').select('*').order('actualizado_en', { ascending: false })),
    sb.from('requisitos_certificacion').select('*').order('orden').order('nombre'),
    sb.from('categorias').select('*').order('orden').order('nombre'),
    sb.from('configuracion').select('*'),
    sb.rpc('admin_listar_cuentas')
  ]);
  for (const x of [reqs, cats, cfg, ctas]) if (x.error) throw x.error;
  S.empresas = emp; S.certs = certs; S.requisitos = reqs.data; S.categorias = cats.data;
  S.config = Object.fromEntries(cfg.data.map(c => [c.clave, c.valor]));
  S.cuentas = ctas.data;
}

async function refrescar() {
  await cargarBase();
  pintarKPIs();
  const actual = $('[role=tab][aria-selected=true]')?.dataset.tab;
  cargados.clear();
  if (actual) abrirSeccion(actual);
}

function pintarKPIs() {
  const pub = S.empresas.filter(e => e.estado === 'aprobado');
  const rev = S.empresas.filter(e => ['enviada', 'en_revision'].includes(e.estado)).length;
  const certPend = S.certs.filter(c => c.estado === 'pendiente').length;
  $('#k-pub').textContent = pub.length;
  $('#k-pub-sub').textContent = `${pub.filter(e => e.cuenta_activa).length} con cuenta activa`;
  $('#k-rev').textContent = rev;
  $('#k-cert').textContent = certPend;
  $('#k-ubic').textContent = pub.filter(e => e.lat == null).length;
  $('#c-sol').textContent = rev;
  $('#c-cert').textContent = certPend;
  $('#c-cat').textContent = S.categorias.filter(c => !c.activa && c.propuesta_por).length;
  $('#c-cta').textContent = S.cuentas.filter(c => c.solicita_empresa_id).length;
}

function abrirSeccion(id) {
  if (cargados.has(id) && id !== 'bitacora') return;
  cargados.add(id);
  ({ solicitudes: pintarSolicitudes, proveedores: pintarProveedores, certificaciones: pintarCertificaciones,
     requisitos: pintarRequisitos, categorias: pintarCategorias, cuentas: pintarCuentas, bitacora: pintarBitacora })[id]?.();
}

/* ======================================================================
   SOLICITUDES
   ====================================================================== */
const GRUPOS = {
  revisar: { txt: 'Por revisar', estados: ['enviada', 'en_revision'] },
  proveedor: { txt: 'Esperando al proveedor', estados: ['requiere_correcciones', 'pendiente_documentacion'] },
  borrador: { txt: 'Borradores', estados: ['borrador'] },
  rechazado: { txt: 'Rechazadas', estados: ['rechazado'] },
  suspendido: { txt: 'Suspendidas', estados: ['suspendido'] }
};
let grupoSol = 'revisar';

function pintarSolicitudes() {
  const lista = S.empresas.filter(e => GRUPOS[grupoSol].estados.includes(e.estado))
    .sort((a, b) => String(b.enviada_en || b.creado_en).localeCompare(String(a.enviada_en || a.creado_en)));
  $('#p-solicitudes').innerHTML = `
  <div class="contadores" role="group" aria-label="Filtrar solicitudes">
    ${Object.entries(GRUPOS).map(([k, g]) => `<button class="contador-btn" data-grupo="${k}" aria-pressed="${k === grupoSol}">
      <strong>${S.empresas.filter(e => g.estados.includes(e.estado)).length}</strong>${esc(g.txt)}</button>`).join('')}
  </div>
  <section class="card">
    ${lista.length ? `<div class="tabla-cont alto"><table class="tabla">
      <thead><tr><th>Empresa</th><th>Estado</th><th>Enviada</th><th>Provincia</th><th>Categorías</th>
        <th class="num">Inventario</th><th class="num">Certificaciones</th><th>Observaciones</th><th class="acc">Acción</th></tr></thead>
      <tbody>${lista.map(e => `<tr>
        <td><div class="principal">${esc(e.nombre_comercial)}</div><div class="secundario">${esc(e.correo || '')}</div></td>
        <td>${badge(ESTADOS, e.estado)}</td>
        <td style="white-space:nowrap">${fecha(e.enviada_en)}</td>
        <td>${esc(e.provincia || '—')}</td>
        <td>${esc(e.categorias || '—')}</td>
        <td class="num">${e.n_items}</td>
        <td class="num">${e.n_certificaciones}${e.n_cert_pendientes ? ` <span class="badge b-info sin-punto">${e.n_cert_pendientes} por revisar</span>` : ''}</td>
        <td>${e.n_obs_abiertas ? `<span class="badge b-aviso">${e.n_obs_abiertas} abierta${e.n_obs_abiertas > 1 ? 's' : ''}</span>` : '—'}</td>
        <td class="acc"><button class="btn btn-primario btn-sm" data-revisar="${e.id}">Revisar</button></td>
      </tr>`).join('')}</tbody></table></div>`
    : `<div class="vacio"><strong>Sin solicitudes en este grupo</strong>${grupoSol === 'revisar' ? 'No hay solicitudes pendientes de revisión.' : ''}</div>`}
  </section>`;
  $$('#p-solicitudes [data-grupo]').forEach(b => b.addEventListener('click', () => { grupoSol = b.dataset.grupo; pintarSolicitudes(); }));
  $$('#p-solicitudes [data-revisar]').forEach(b => b.addEventListener('click', () => revisar(b.dataset.revisar)));
}

async function revisar(id) {
  const m = abrirModal('<div class="cargando-bloque"><span class="spinner"></span>Cargando solicitud…</div>', { titulo: 'Revisión de solicitud', tam: 'grande' });
  const [e, p, ec, prods, certs, obs, falt] = await Promise.all([
    sb.from('empresas').select('*').eq('id', id).single(),
    sb.from('empresas_privado').select('*').eq('empresa_id', id).maybeSingle(),
    sb.from('empresa_categorias').select('categoria_id').eq('empresa_id', id),
    sb.from('productos').select('nombre, tipo, disponibilidad', { count: 'exact' }).eq('empresa_id', id).order('nombre').limit(12),
    sb.from('certificaciones_empresa').select('*').eq('empresa_id', id).order('nombre'),
    sb.from('observaciones').select('*').eq('empresa_id', id).order('creado_en', { ascending: false }),
    sb.rpc('verificar_requisitos', { p_empresa: id })
  ]);
  if (e.error) { m.el.querySelector('.modal-cuerpo').innerHTML = `<div class="alerta error">${esc(mensajeError(e.error))}</div>`; return; }
  const emp = e.data, priv = p.data || {};
  const cats = S.categorias.filter(c => (ec.data || []).some(x => x.categoria_id === c.id)).map(c => c.nombre + (c.activa ? '' : ' (propuesta)'));
  const faltantes = falt.data || [];
  const fila = (t, v) => `<dt>${t}</dt><dd>${v || '<span class="texto-gris">—</span>'}</dd>`;
  m.el.querySelector('#modal-tit').textContent = emp.nombre_comercial;
  m.el.querySelector('.modal-cuerpo').innerHTML = `
    <div class="flex" style="margin-bottom:14px">${badge(ESTADOS, emp.estado)}
      <span class="texto-chico texto-gris">${emp.origen === 'base_inicial' ? 'Ficha de la base inicial del CLRAH' : 'Registrada por el proveedor'} · Creada ${fecha(emp.creado_en)}${emp.enviada_en ? ' · Enviada ' + fecha(emp.enviada_en, true) : ''}</span>
      <span class="crece"></span>
      <a class="btn btn-sec btn-sm" href="panel.html?empresa=${encodeURIComponent(id)}">Editar datos e inventario</a>
      <a class="btn btn-sec btn-sm" href="empresa.html?id=${encodeURIComponent(id)}" target="_blank" rel="noopener">Ver perfil</a></div>

    ${faltantes.length ? `<div class="alerta aviso"><strong>Requisitos incompletos</strong><ul>${faltantes.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`
      : '<div class="alerta exito">La solicitud cumple todos los requisitos obligatorios configurados.</div>'}

    <div class="rejilla c2" style="align-items:start">
      <div>
        <div class="seccion-titulo">Datos de la empresa</div>
        <dl class="dl" style="grid-template-columns:130px 1fr">
          ${fila('Razón social', esc(priv.razon_social))}${fila('RUC / ID fiscal', esc(priv.identificacion_fiscal))}
          ${fila('Actividad', esc(emp.actividad_principal))}${fila('Descripción', esc(emp.descripcion))}
          ${fila('Dirección', esc([emp.direccion, emp.distrito, emp.provincia, emp.pais].filter(Boolean).join(', ')))}
          ${fila('Mapa', emp.lat != null ? `${emp.lat}, ${emp.lng}` : '')}
          ${fila('Correo', esc(emp.correo))}${fila('Teléfono', esc(emp.telefono))}
          ${fila('Contacto', esc(emp.persona_contacto))}${fila('Sitio web', esc(emp.sitio_web))}
          ${fila('Categorías', esc(cats.join(', ')))}
        </dl>
      </div>
      <div>
        <div class="seccion-titulo">Inventario (${prods.count ?? 0} registros)</div>
        ${(prods.data || []).length ? `<ul style="margin:0 0 14px;padding-left:18px;font-size:13px;color:var(--text2)">
          ${prods.data.map(x => `<li>${esc(x.nombre)} <span class="texto-gris">· ${x.tipo}</span></li>`).join('')}
          ${prods.count > 12 ? `<li class="texto-gris">y ${prods.count - 12} más</li>` : ''}</ul>` : '<p class="texto-gris texto-chico" style="margin-bottom:14px">Sin productos registrados.</p>'}
        <div class="seccion-titulo">Certificaciones</div>
        ${(certs.data || []).length ? `<div class="tabla-cont"><table class="tabla"><tbody>${certs.data.map(c => `<tr>
          <td><div class="principal">${esc(c.nombre)}</div><div class="secundario">${esc([c.organismo, c.vigencia_hasta && 'Vigente hasta ' + fecha(c.vigencia_hasta)].filter(Boolean).join(' · '))}</div></td>
          <td>${badge(ESTADOS_CERT, c.estado)}</td>
          <td class="acc">${c.documento_path ? `<button class="btn btn-texto btn-sm" data-doc="${esc(c.documento_path)}">Documento</button>` : '<span class="secundario">Sin documento</span>'}
            ${c.estado !== 'validada' ? `<button class="btn btn-texto btn-sm" data-validar="${c.id}">Validar</button>` : ''}
            ${c.estado !== 'rechazada' ? `<button class="btn btn-texto btn-sm" style="color:var(--error-text)" data-rechazar="${c.id}">Rechazar</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="texto-gris texto-chico">Sin certificaciones registradas.</p>'}
      </div>
    </div>

    <div class="seccion-titulo mt" style="margin-top:18px">Historial de observaciones</div>
    ${(obs.data || []).length ? obs.data.map(o => `<div class="obs ${o.atendida ? '' : 'abierta'}">
      <div class="meta">${fecha(o.creado_en, true)} ${o.estado_asignado ? badge(ESTADOS, o.estado_asignado) : ''} ${o.atendida ? 'Atendida' : '<b>Pendiente</b>'}</div>
      <p>${esc(o.mensaje)}</p></div>`).join('') : '<p class="texto-gris texto-chico">Sin observaciones.</p>'}

    <form id="f-decision" class="card mt mb0" style="background:var(--fila-alterna)" novalidate>
      <div class="card-titulo">Decisión</div>
      <div class="rejilla c3 mt">
        <div class="campo"><label for="d-estado">Nuevo estado</label>
          <select id="d-estado" name="estado">${Object.entries(ESTADOS).map(([k, v]) =>
            `<option value="${k}" ${k === emp.estado ? 'selected' : ''}>${esc(v.txt)}</option>`).join('')}</select></div>
        <div class="campo" style="grid-column: span 2"><label for="d-msg">Observación para el proveedor</label>
          <textarea id="d-msg" name="mensaje" rows="3" maxlength="2000" placeholder="Obligatoria al pedir correcciones, documentación, rechazar o suspender"></textarea></div>
      </div>
      <div class="acciones der mt">
        ${['enviada'].includes(emp.estado) ? '<button type="button" class="btn btn-sec" data-rapido="en_revision">Tomar en revisión</button>' : ''}
        ${emp.estado !== 'aprobado' ? '<button type="button" class="btn btn-sec" data-rapido="aprobado">Aprobar y publicar</button>' : ''}
        <button type="submit" class="btn btn-primario">Aplicar decisión</button>
      </div>
    </form>`;

  const cuerpo = m.el.querySelector('.modal-cuerpo');
  cuerpo.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => verDocumento(b.dataset.doc)));
  cuerpo.querySelectorAll('[data-validar]').forEach(b => b.addEventListener('click', async () => {
    if (await revisarCert(b.dataset.validar, 'validada')) { m.cerrar(); revisar(id); }
  }));
  cuerpo.querySelectorAll('[data-rechazar]').forEach(b => b.addEventListener('click', async () => {
    if (await revisarCert(b.dataset.rechazar, 'rechazada')) { m.cerrar(); revisar(id); }
  }));
  const f = cuerpo.querySelector('#f-decision');
  const aplicar = async (estado, mensaje, boton) => {
    const requiere = ['requiere_correcciones', 'pendiente_documentacion', 'rechazado', 'suspendido'].includes(estado);
    if (requiere && !mensaje) { marcarErrores(f, { mensaje: 'Explique el motivo al proveedor.' }); return; }
    if (estado === 'aprobado' && faltantes.length &&
        !await confirmar('La solicitud tiene requisitos incompletos. ¿Desea aprobarla de todos modos?', { aceptar: 'Aprobar' })) return;
    if (['rechazado', 'suspendido'].includes(estado) &&
        !await confirmar(`La empresa dejará de mostrarse en el vitral y no podrá editar su información.\n\nEstado: ${ESTADOS[estado].txt}`, { aceptar: 'Confirmar', peligro: true })) return;
    await conCarga(boton, async () => {
      const { error } = await sb.rpc('admin_cambiar_estado', { p_empresa: id, p_estado: estado, p_mensaje: mensaje });
      if (error) { toast(mensajeError(error), 'error', 7000); return; }
      toast(`Estado actualizado: ${ESTADOS[estado].txt}.`, 'exito');
      m.cerrar();
      await refrescar();
    });
  };
  f.addEventListener('submit', ev => { ev.preventDefault(); aplicar(f.estado.value, f.mensaje.value.trim() || null, f.querySelector('[type=submit]')); });
  cuerpo.querySelectorAll('[data-rapido]').forEach(b => b.addEventListener('click', () => aplicar(b.dataset.rapido, f.mensaje.value.trim() || null, b)));
}

/** Valida o rechaza una certificación. Devuelve true si se guardó. */
async function revisarCert(certId, estado) {
  let obs = null;
  if (estado !== 'validada') {
    obs = await pedirTexto(estado === 'rechazada' ? 'Motivo del rechazo' : 'Observación', 'Este comentario lo verá el proveedor.');
    if (obs === null) return false;
  }
  const { error } = await sb.from('certificaciones_empresa').update({ estado, observaciones: obs }).eq('id', certId);
  if (error) { toast(mensajeError(error), 'error'); return false; }
  toast(`Certificación: ${ESTADOS_CERT[estado].txt}.`, 'exito');
  const c = S.certs.find(x => x.id === certId);
  if (c) { c.estado = estado; c.observaciones = obs; }
  pintarKPIs();
  return true;
}

function pedirTexto(titulo, ayuda) {
  return new Promise(res => {
    let hecho = false;
    const m = abrirModal(`<div class="campo"><label for="txt-libre">${esc(titulo)}<span class="req">*</span></label>
      <textarea id="txt-libre" rows="3" maxlength="1000"></textarea><span class="ayuda">${esc(ayuda)}</span></div>`, {
      titulo, tam: 'chico',
      pie: '<button class="btn btn-sec" data-r="0">Cancelar</button><button class="btn btn-primario" data-r="1">Guardar</button>',
      alCerrar: () => { if (!hecho) res(null); }
    });
    m.el.querySelector('[data-r="0"]').addEventListener('click', m.cerrar);
    m.el.querySelector('[data-r="1"]').addEventListener('click', () => {
      const v = m.el.querySelector('#txt-libre').value.trim();
      if (!v) { m.el.querySelector('#txt-libre').setAttribute('aria-invalid', 'true'); return; }
      hecho = true; res(v); m.cerrar();
    });
  });
}

/* ======================================================================
   PROVEEDORES
   ====================================================================== */
const fProv = { q: '', estado: '', registro: '', sinUbic: false };

function pintarProveedores() {
  $('#p-proveedores').innerHTML = `
  <section class="card">
    <div class="barra">
      <div class="campo crece"><label for="pv-q">Buscar</label><input type="search" id="pv-q" value="${esc(fProv.q)}" placeholder="Nombre, correo o provincia"></div>
      <div class="campo"><label for="pv-estado">Estado</label><select id="pv-estado"><option value="">Todos</option>
        ${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${fProv.estado === k ? 'selected' : ''}>${esc(v.txt)}</option>`).join('')}</select></div>
      <div class="campo"><label for="pv-reg">Registro</label><select id="pv-reg">
        <option value="">Todos</option><option value="cuenta">Con cuenta activa</option><option value="sin">Sin cuenta</option>
        <option value="base">Base inicial</option></select></div>
      <label class="check" style="padding-bottom:7px"><input type="checkbox" id="pv-ubic" ${fProv.sinUbic ? 'checked' : ''}> Sin ubicación en mapa</label>
      <div class="acciones"><button class="btn btn-primario" id="nueva-emp">Nueva empresa</button></div>
    </div>
    <div id="pv-tabla"></div>
  </section>`;
  $('#pv-reg').value = fProv.registro;
  $('#pv-q').addEventListener('input', ev => { fProv.q = ev.target.value; tablaProv(); });
  $('#pv-estado').addEventListener('change', ev => { fProv.estado = ev.target.value; tablaProv(); });
  $('#pv-reg').addEventListener('change', ev => { fProv.registro = ev.target.value; tablaProv(); });
  $('#pv-ubic').addEventListener('change', ev => { fProv.sinUbic = ev.target.checked; tablaProv(); });
  $('#nueva-emp').addEventListener('click', nuevaEmpresa);
  tablaProv();
}

function tablaProv() {
  const q = normalizar(fProv.q);
  const lista = S.empresas.filter(e =>
    (!q || normalizar(`${e.nombre_comercial} ${e.correo || ''} ${e.provincia || ''}`).includes(q)) &&
    (!fProv.estado || e.estado === fProv.estado) &&
    (fProv.registro !== 'cuenta' || e.cuenta_activa) && (fProv.registro !== 'sin' || !e.cuenta_activa) &&
    (fProv.registro !== 'base' || e.origen === 'base_inicial') &&
    (!fProv.sinUbic || e.lat == null));
  $('#pv-tabla').innerHTML = `<p class="texto-chico texto-gris" style="margin-bottom:8px">${lista.length} de ${S.empresas.length} empresas</p>
  <div class="tabla-cont alto"><table class="tabla">
    <thead><tr><th>Empresa</th><th>Estado</th><th>Registro</th><th>Provincia</th><th>Mapa</th><th class="num">Inventario</th><th>Actualizada</th><th class="acc">Acciones</th></tr></thead>
    <tbody>${lista.map(e => `<tr>
      <td><div class="principal">${esc(e.nombre_comercial)}</div><div class="secundario">${esc(e.categorias || '')}</div></td>
      <td>${badge(ESTADOS, e.estado)}</td>
      <td>${e.cuenta_activa ? '<span class="badge b-exito">Cuenta activa</span>' : '<span class="badge b-neutro">Sin cuenta</span>'}
        <div class="secundario">${e.origen === 'base_inicial' ? 'Base inicial' : 'Registro'}</div></td>
      <td>${esc(e.provincia || '—')}</td>
      <td>${e.lat != null ? 'Sí' : '<span class="texto-gris">No</span>'}</td>
      <td class="num">${e.n_items}</td>
      <td style="white-space:nowrap">${fecha(e.actualizado_en)}</td>
      <td class="acc">
        <button class="btn btn-texto btn-sm" data-revisar="${e.id}">Estado</button>
        <a class="btn btn-texto btn-sm" href="panel.html?empresa=${encodeURIComponent(e.id)}">Editar</a>
        <a class="btn btn-texto btn-sm" href="empresa.html?id=${encodeURIComponent(e.id)}" target="_blank" rel="noopener">Perfil</a>
        <button class="btn btn-texto btn-sm" style="color:var(--error-text)" data-borrar="${e.id}">Eliminar</button>
      </td></tr>`).join('') || '<tr><td colspan="8" class="vacio">Sin resultados.</td></tr>'}</tbody></table></div>`;
  $$('#pv-tabla [data-revisar]').forEach(b => b.addEventListener('click', () => revisar(b.dataset.revisar)));
  $$('#pv-tabla [data-borrar]').forEach(b => b.addEventListener('click', () => borrarEmpresa(S.empresas.find(e => e.id === b.dataset.borrar))));
}

function nuevaEmpresa() {
  const m = abrirModal(`<form id="f-nueva" class="rejilla" novalidate>
      <div class="campo"><label for="n-nombre">Nombre comercial<span class="req">*</span></label><input type="text" id="n-nombre" name="nombre_comercial" maxlength="200"></div>
      <p class="texto-chico texto-gris">Se crea como borrador de la base del CLRAH. Después podrá completar sus datos, inventario y ubicación, y publicarla.</p>
    </form>`, {
    titulo: 'Nueva empresa', tam: 'chico',
    pie: '<button class="btn btn-sec" data-c>Cancelar</button><button class="btn btn-primario" data-g>Crear y completar datos</button>'
  });
  m.el.querySelector('[data-c]').addEventListener('click', m.cerrar);
  m.el.querySelector('[data-g]').addEventListener('click', async ev => {
    const f = m.el.querySelector('#f-nueva');
    const nombre = f.nombre_comercial.value.trim();
    if (!marcarErrores(f, nombre.length >= 2 ? {} : { nombre_comercial: 'Escriba el nombre.' })) return;
    await conCarga(ev.target, async () => {
      const { data, error } = await sb.from('empresas').insert({ nombre_comercial: nombre, estado: 'borrador', origen: 'base_inicial' }).select('id').single();
      if (error) { toast(mensajeError(error), 'error'); return; }
      await sb.from('empresas_privado').insert({ empresa_id: data.id });
      location.href = `panel.html?empresa=${encodeURIComponent(data.id)}#empresa`;
    });
  });
}

async function borrarEmpresa(e) {
  const ok = await confirmar(`Se eliminará DEFINITIVAMENTE "${e.nombre_comercial}" con todo su inventario (${e.n_items} registros), certificaciones y observaciones. Las cuentas vinculadas quedarán sin empresa.\n\nEsta acción no se puede deshacer. Si solo desea ocultarla, use el estado "Suspendido".`,
    { titulo: 'Eliminar empresa', aceptar: 'Eliminar definitivamente', peligro: true });
  if (!ok) return;
  const { data, error } = await sb.from('empresas').delete().eq('id', e.id).select('id');
  if (error || !data.length) { toast(error ? mensajeError(error) : 'No fue posible eliminar.', 'error'); return; }
  const archivos = await sb.storage.from('documentos').list(e.id);
  if (archivos.data?.length) await sb.storage.from('documentos').remove(archivos.data.map(a => `${e.id}/${a.name}`));
  toast('Empresa eliminada.', 'exito');
  await refrescar();
}

/* ======================================================================
   CERTIFICACIONES
   ====================================================================== */
let fCert = 'pendiente';

function pintarCertificaciones() {
  const lista = S.certs.filter(c => !fCert || c.estado === fCert);
  $('#p-certificaciones').innerHTML = `
  <section class="card">
    <div class="barra">
      <div class="campo"><label for="ct-estado">Estado</label><select id="ct-estado"><option value="">Todos</option>
        ${Object.entries(ESTADOS_CERT).map(([k, v]) => `<option value="${k}" ${fCert === k ? 'selected' : ''}>${esc(v.txt)}</option>`).join('')}</select></div>
      <p class="texto-chico texto-gris crece" style="padding-bottom:8px">${lista.length} certificaciones</p>
    </div>
    <div class="tabla-cont alto"><table class="tabla">
      <thead><tr><th>Empresa</th><th>Certificación</th><th>Organismo</th><th>Vigencia</th><th>Estado</th><th>Actualizada</th><th class="acc">Acciones</th></tr></thead>
      <tbody>${lista.map(c => {
        const vencida = c.vigencia_hasta && c.vigencia_hasta < new Date().toISOString().slice(0, 10);
        return `<tr>
        <td class="principal">${esc(nombreEmpresa(c.empresa_id))}</td>
        <td>${esc(c.nombre)}${c.observaciones ? `<div class="secundario" style="max-width:260px">${esc(c.observaciones)}</div>` : ''}</td>
        <td>${esc(c.organismo || '—')}</td>
        <td style="white-space:nowrap">${c.vigencia_hasta ? fecha(c.vigencia_hasta) : '—'}${vencida && c.estado !== 'vencida' ? ' <span class="badge b-aviso sin-punto">Expiró</span>' : ''}</td>
        <td>${badge(ESTADOS_CERT, c.estado)}</td>
        <td style="white-space:nowrap">${fecha(c.actualizado_en)}</td>
        <td class="acc">
          ${c.documento_path ? `<button class="btn btn-texto btn-sm" data-doc="${esc(c.documento_path)}">Documento</button>` : '<span class="secundario">Sin documento</span>'}
          ${c.estado !== 'validada' ? `<button class="btn btn-texto btn-sm" data-est="validada" data-id="${c.id}">Validar</button>` : ''}
          ${c.estado !== 'rechazada' ? `<button class="btn btn-texto btn-sm" style="color:var(--error-text)" data-est="rechazada" data-id="${c.id}">Rechazar</button>` : ''}
          ${c.estado !== 'vencida' && c.vigencia_hasta ? `<button class="btn btn-texto btn-sm" data-est="vencida" data-id="${c.id}">Marcar vencida</button>` : ''}
        </td></tr>`;
      }).join('') || '<tr><td colspan="7" class="vacio">Sin certificaciones en este estado.</td></tr>'}</tbody></table></div>
  </section>`;
  $('#ct-estado').addEventListener('change', ev => { fCert = ev.target.value; pintarCertificaciones(); });
  $$('#p-certificaciones [data-doc]').forEach(b => b.addEventListener('click', () => verDocumento(b.dataset.doc)));
  $$('#p-certificaciones [data-est]').forEach(b => b.addEventListener('click', async () => {
    if (await revisarCert(b.dataset.id, b.dataset.est)) pintarCertificaciones();
  }));
}

/* ======================================================================
   REQUISITOS DE CERTIFICACIÓN
   ====================================================================== */
function pintarRequisitos() {
  const uso = id => S.certs.filter(c => c.requisito_id === id).length;
  $('#p-requisitos').innerHTML = `
  <section class="card">
    <div class="card-cab">
      <div><div class="card-titulo">Requisitos de certificación</div>
        <div class="card-sub">Defina qué certificaciones se solicitan, cuáles son obligatorias y si requieren documento. Los proveedores ven esta lista en su panel.</div></div>
      <button class="btn btn-primario" id="nuevo-req">Nuevo requisito</button>
    </div>
    <div class="tabla-cont"><table class="tabla">
      <thead><tr><th>Requisito</th><th>Obligatoria</th><th>Requiere documento</th><th>Activo</th><th class="num">Empresas</th><th class="num">Orden</th><th class="acc">Acciones</th></tr></thead>
      <tbody>${S.requisitos.map(r => `<tr>
        <td><div class="principal">${esc(r.nombre)}</div><div class="secundario">${esc(r.descripcion || '')}</div></td>
        <td><label class="check"><input type="checkbox" data-oblig="${r.id}" ${r.obligatoria ? 'checked' : ''}> ${r.obligatoria ? 'Obligatoria' : 'Opcional'}</label></td>
        <td>${r.requiere_documento ? 'Sí' : 'No'}</td>
        <td>${r.activo ? '<span class="badge b-exito">Activo</span>' : '<span class="badge b-neutro">Inactivo</span>'}</td>
        <td class="num">${uso(r.id)}</td><td class="num">${r.orden}</td>
        <td class="acc"><button class="btn btn-texto btn-sm" data-editar="${r.id}">Editar</button>
          <button class="btn btn-texto btn-sm" style="color:var(--error-text)" data-borrar="${r.id}">Eliminar</button></td>
      </tr>`).join('') || '<tr><td colspan="7" class="vacio">No hay requisitos configurados.</td></tr>'}</tbody></table></div>
    <p class="texto-chico texto-gris mt">Marcar una certificación como obligatoria aplica a las solicitudes que se envíen o reenvíen a partir de ese momento; no retira de la publicación a las empresas ya aprobadas.</p>
  </section>`;
  $('#nuevo-req').addEventListener('click', () => editarRequisito(null));
  $$('#p-requisitos [data-editar]').forEach(b => b.addEventListener('click', () => editarRequisito(S.requisitos.find(r => r.id === b.dataset.editar))));
  $$('#p-requisitos [data-oblig]').forEach(c => c.addEventListener('change', async () => {
    const r = S.requisitos.find(x => x.id === c.dataset.oblig);
    const ok = await confirmar(c.checked
      ? `"${r.nombre}" pasará a ser OBLIGATORIA. Los proveedores no podrán enviar su solicitud sin ella${r.requiere_documento ? ' y su documento' : ''}.`
      : `"${r.nombre}" pasará a ser opcional.`, { titulo: 'Cambiar requisito', aceptar: 'Confirmar' });
    if (!ok) { c.checked = !c.checked; return; }
    const { error } = await sb.from('requisitos_certificacion').update({ obligatoria: c.checked }).eq('id', r.id);
    if (error) { toast(mensajeError(error), 'error'); c.checked = !c.checked; return; }
    r.obligatoria = c.checked;
    toast('Requisito actualizado.', 'exito');
    pintarRequisitos();
  }));
  $$('#p-requisitos [data-borrar]').forEach(b => b.addEventListener('click', async () => {
    const r = S.requisitos.find(x => x.id === b.dataset.borrar);
    const n = uso(r.id);
    if (!await confirmar(`Se eliminará el requisito "${r.nombre}".${n ? `\n\n${n} empresas lo tienen registrado: sus certificaciones se conservarán como "certificación adicional".` : ''}\n\nSi solo desea dejar de solicitarlo, edítelo y desactívelo.`,
      { titulo: 'Eliminar requisito', aceptar: 'Eliminar', peligro: true })) return;
    const { error } = await sb.from('requisitos_certificacion').delete().eq('id', r.id);
    if (error) { toast(mensajeError(error), 'error'); return; }
    toast('Requisito eliminado.', 'exito');
    await refrescar();
  }));
}

function editarRequisito(r) {
  const nuevo = !r;
  r = r || { obligatoria: false, requiere_documento: true, activo: true, orden: (S.requisitos.length + 1) * 10 };
  const m = abrirModal(`<form id="f-req" class="rejilla" novalidate>
      <div class="campo"><label for="r-nombre">Nombre<span class="req">*</span></label><input type="text" id="r-nombre" name="nombre" value="${esc(r.nombre || '')}" maxlength="150"></div>
      <div class="campo"><label for="r-desc">Descripción</label><textarea id="r-desc" name="descripcion" rows="2" maxlength="500">${esc(r.descripcion || '')}</textarea></div>
      <div class="campo" style="max-width:140px"><label for="r-orden">Orden</label><input type="number" id="r-orden" name="orden" value="${r.orden}" step="1"></div>
      <label class="check"><input type="checkbox" name="obligatoria" ${r.obligatoria ? 'checked' : ''}> Obligatoria para enviar la solicitud</label>
      <label class="check"><input type="checkbox" name="requiere_documento" ${r.requiere_documento ? 'checked' : ''}> Requiere documento comprobatorio</label>
      <label class="check"><input type="checkbox" name="activo" ${r.activo ? 'checked' : ''}> Activo (visible para los proveedores)</label>
    </form>`, {
    titulo: nuevo ? 'Nuevo requisito' : 'Editar requisito',
    pie: '<button class="btn btn-sec" data-c>Cancelar</button><button class="btn btn-primario" data-g>Guardar</button>'
  });
  m.el.querySelector('[data-c]').addEventListener('click', m.cerrar);
  m.el.querySelector('[data-g]').addEventListener('click', async ev => {
    const f = m.el.querySelector('#f-req');
    const d = leerForm(f);
    if (!marcarErrores(f, d.nombre ? {} : { nombre: 'Escriba el nombre.' })) return;
    const fila = { nombre: d.nombre, descripcion: d.descripcion, orden: Number(d.orden) || 100,
      obligatoria: d.obligatoria, requiere_documento: d.requiere_documento, activo: d.activo };
    await conCarga(ev.target, async () => {
      const { error } = nuevo ? await sb.from('requisitos_certificacion').insert(fila)
        : await sb.from('requisitos_certificacion').update(fila).eq('id', r.id);
      if (error) { toast(mensajeError(error), 'error'); return; }
      m.cerrar(); toast('Requisito guardado.', 'exito');
      await refrescar();
    });
  });
}

/* ======================================================================
   CATEGORÍAS
   ====================================================================== */
function pintarCategorias() {
  const propuestas = S.categorias.filter(c => !c.activa && c.propuesta_por);
  $('#p-categorias').innerHTML = `
  <section class="card">
    <div class="card-cab">
      <div><div class="card-titulo">Categorías de productos y servicios</div>
        <div class="card-sub">Se usan para clasificar empresas e inventarios y como filtro del vitral.</div></div>
      <button class="btn btn-primario" id="nueva-cat">Nueva categoría</button>
    </div>
    <label class="check" style="margin-bottom:12px"><input type="checkbox" id="cfg-prop" ${S.config.proveedores_proponen_categorias === true ? 'checked' : ''}>
      Permitir que los proveedores propongan nuevas categorías (requieren su aprobación)</label>
    ${propuestas.length ? `<div class="alerta info">${propuestas.length} categoría${propuestas.length > 1 ? 's' : ''} propuesta${propuestas.length > 1 ? 's' : ''} por proveedores en espera de aprobación.</div>` : ''}
    <div class="tabla-cont"><table class="tabla">
      <thead><tr><th>Categoría</th><th>Estado</th><th>Propuesta por</th><th class="num">Orden</th><th class="acc">Acciones</th></tr></thead>
      <tbody>${S.categorias.map(c => `<tr>
        <td><div class="principal">${esc(c.nombre)}</div><div class="secundario">${esc(c.descripcion || '')}</div></td>
        <td>${c.activa ? '<span class="badge b-exito">Activa</span>' : c.propuesta_por ? '<span class="badge b-aviso">Propuesta</span>' : '<span class="badge b-neutro">Inactiva</span>'}</td>
        <td>${c.propuesta_por ? esc(nombreEmpresa(c.propuesta_por)) : '—'}</td>
        <td class="num">${c.orden}</td>
        <td class="acc">${!c.activa ? `<button class="btn btn-texto btn-sm" data-aprobar="${c.id}">${c.propuesta_por ? 'Aprobar' : 'Activar'}</button>` : ''}
          <button class="btn btn-texto btn-sm" data-editar="${c.id}">Editar</button>
          <button class="btn btn-texto btn-sm" style="color:var(--error-text)" data-borrar="${c.id}">Eliminar</button></td>
      </tr>`).join('')}</tbody></table></div>
  </section>`;
  $('#cfg-prop').addEventListener('change', async ev => {
    const { error } = await sb.from('configuracion').update({ valor: ev.target.checked }).eq('clave', 'proveedores_proponen_categorias');
    if (error) { toast(mensajeError(error), 'error'); ev.target.checked = !ev.target.checked; return; }
    S.config.proveedores_proponen_categorias = ev.target.checked;
    toast('Configuración guardada.', 'exito');
  });
  $('#nueva-cat').addEventListener('click', () => editarCategoria(null));
  $$('#p-categorias [data-editar]').forEach(b => b.addEventListener('click', () => editarCategoria(S.categorias.find(c => c.id === b.dataset.editar))));
  $$('#p-categorias [data-aprobar]').forEach(b => b.addEventListener('click', async () => {
    const { error } = await sb.from('categorias').update({ activa: true }).eq('id', b.dataset.aprobar);
    if (error) { toast(mensajeError(error), 'error'); return; }
    toast('Categoría activada.', 'exito'); await refrescar();
  }));
  $$('#p-categorias [data-borrar]').forEach(b => b.addEventListener('click', async () => {
    const c = S.categorias.find(x => x.id === b.dataset.borrar);
    if (!await confirmar(`Se eliminará la categoría "${c.nombre}". Las empresas y productos que la usan quedarán sin esa categoría.\n\nEsta acción no se puede deshacer.`,
      { titulo: 'Eliminar categoría', aceptar: 'Eliminar', peligro: true })) return;
    const { error } = await sb.from('categorias').delete().eq('id', c.id);
    if (error) { toast(mensajeError(error), 'error'); return; }
    toast('Categoría eliminada.', 'exito'); await refrescar();
  }));
}

function editarCategoria(c) {
  const nuevo = !c;
  c = c || { activa: true, orden: 100 };
  const m = abrirModal(`<form id="f-cat" class="rejilla" novalidate>
      <div class="campo"><label for="ca-nombre">Nombre<span class="req">*</span></label><input type="text" id="ca-nombre" name="nombre" value="${esc(c.nombre || '')}" maxlength="80"></div>
      <div class="campo"><label for="ca-desc">Descripción</label><textarea id="ca-desc" name="descripcion" rows="2" maxlength="300">${esc(c.descripcion || '')}</textarea></div>
      <div class="campo" style="max-width:140px"><label for="ca-orden">Orden</label><input type="number" id="ca-orden" name="orden" value="${c.orden}" step="1"></div>
      <label class="check"><input type="checkbox" name="activa" ${c.activa ? 'checked' : ''}> Activa (visible en el vitral y en los formularios)</label>
    </form>`, {
    titulo: nuevo ? 'Nueva categoría' : 'Editar categoría', tam: 'chico',
    pie: '<button class="btn btn-sec" data-c>Cancelar</button><button class="btn btn-primario" data-g>Guardar</button>'
  });
  m.el.querySelector('[data-c]').addEventListener('click', m.cerrar);
  m.el.querySelector('[data-g]').addEventListener('click', async ev => {
    const f = m.el.querySelector('#f-cat');
    const d = leerForm(f);
    if (!marcarErrores(f, d.nombre ? {} : { nombre: 'Escriba el nombre.' })) return;
    const fila = { nombre: d.nombre, descripcion: d.descripcion, orden: Number(d.orden) || 100, activa: d.activa };
    await conCarga(ev.target, async () => {
      const { error } = nuevo ? await sb.from('categorias').insert(fila) : await sb.from('categorias').update(fila).eq('id', c.id);
      if (error) { toast(mensajeError(error), 'error'); return; }
      m.cerrar(); toast('Categoría guardada.', 'exito'); await refrescar();
    });
  });
}

/* ======================================================================
   CUENTAS
   ====================================================================== */
function pintarCuentas() {
  const solicitudes = S.cuentas.filter(c => c.solicita_empresa_id);
  $('#p-cuentas').innerHTML = `
  ${solicitudes.length ? `<div class="alerta aviso"><strong>${solicitudes.length} solicitud${solicitudes.length > 1 ? 'es' : ''} de vinculación</strong>
    Antes de vincular, verifique que la persona representa a la empresa (por ejemplo, contactándola al correo o teléfono de la ficha).</div>` : ''}
  <section class="card">
    <div class="card-cab"><div><div class="card-titulo">Cuentas de usuario</div>
      <div class="card-sub">Para crear un administrador: la persona crea su cuenta en "Registrar mi empresa" (sin completar empresa) y aquí se le asigna el rol.</div></div></div>
    <div class="tabla-cont alto"><table class="tabla">
      <thead><tr><th>Cuenta</th><th>Rol</th><th>Empresa vinculada</th><th>Solicitud de vinculación</th><th>Estado</th><th>Último acceso</th><th class="acc">Acciones</th></tr></thead>
      <tbody>${S.cuentas.map(c => `<tr>
        <td><div class="principal">${esc(c.correo)}</div><div class="secundario">${esc(c.nombre || '')} · creada ${fecha(c.creado_en)}${c.correo_confirmado ? '' : ' · <b>correo sin confirmar</b>'}</div></td>
        <td>${c.rol === 'admin' ? '<span class="badge b-info">Administrador</span>' : '<span class="badge b-neutro">Proveedor</span>'}</td>
        <td>${esc(c.empresa_nombre || '—')}</td>
        <td>${c.solicita_empresa_id ? `${esc(c.solicita_empresa_nombre)} <button class="btn btn-sec btn-sm" data-vincular="${c.id}">Vincular</button>` : '—'}</td>
        <td>${c.activo ? '<span class="badge b-exito">Activa</span>' : '<span class="badge b-error">Desactivada</span>'}</td>
        <td style="white-space:nowrap">${c.ultimo_acceso ? fecha(c.ultimo_acceso, true) : 'Nunca'}</td>
        <td class="acc"><button class="btn btn-texto btn-sm" data-editar="${c.id}">Editar</button></td>
      </tr>`).join('') || '<tr><td colspan="7" class="vacio">Sin cuentas.</td></tr>'}</tbody></table></div>
  </section>`;
  $$('#p-cuentas [data-editar]').forEach(b => b.addEventListener('click', () => editarCuenta(S.cuentas.find(c => c.id === b.dataset.editar))));
  $$('#p-cuentas [data-vincular]').forEach(b => b.addEventListener('click', async () => {
    const c = S.cuentas.find(x => x.id === b.dataset.vincular);
    if (!await confirmar(`${c.correo} podrá administrar la información y el inventario de "${c.solicita_empresa_nombre}".\n\n¿Verificó que representa a la empresa?`,
      { titulo: 'Vincular cuenta', aceptar: 'Vincular' })) return;
    const { error } = await sb.rpc('admin_actualizar_cuenta', { p_usuario: c.id, p_rol: 'proveedor', p_empresa: c.solicita_empresa_id, p_activo: true });
    if (error) { toast(mensajeError(error), 'error'); return; }
    toast('Cuenta vinculada.', 'exito'); await refrescar();
  }));
}

function editarCuenta(c) {
  const opciones = S.empresas.map(e => `<option value="${esc(e.id)}" ${e.id === c.empresa_id ? 'selected' : ''}>${esc(e.nombre_comercial)}</option>`).join('');
  const propia = c.id === S.usuario.id;
  const m = abrirModal(`<form id="f-cta" class="rejilla" novalidate>
      <div class="campo"><span class="etq">Cuenta</span><div>${esc(c.correo)}</div></div>
      <div class="campo"><label for="u-rol">Rol</label><select id="u-rol" name="rol" ${propia ? 'disabled' : ''}>
        <option value="proveedor" ${c.rol === 'proveedor' ? 'selected' : ''}>Proveedor</option>
        <option value="admin" ${c.rol === 'admin' ? 'selected' : ''}>Administrador del CLRAH</option></select></div>
      <div class="campo" id="u-emp-campo"><label for="u-emp">Empresa que administra</label><select id="u-emp" name="empresa">
        <option value="">Sin empresa</option>${opciones}</select>
        <span class="ayuda">Una empresa puede tener varias cuentas; cada cuenta administra una sola empresa.</span></div>
      <label class="check"><input type="checkbox" name="activo" ${c.activo ? 'checked' : ''} ${propia ? 'disabled' : ''}> Cuenta activa</label>
      ${propia ? '<p class="texto-chico texto-gris">No puede quitarse a sí mismo el rol de administrador ni desactivar su propia cuenta.</p>' : ''}
    </form>`, {
    titulo: 'Editar cuenta', tam: 'chico',
    pie: '<button class="btn btn-sec" data-c>Cancelar</button><button class="btn btn-primario" data-g>Guardar</button>'
  });
  const f = m.el.querySelector('#f-cta');
  const sync = () => { m.el.querySelector('#u-emp-campo').hidden = f.rol.value === 'admin'; };
  f.rol.addEventListener('change', sync); sync();
  m.el.querySelector('[data-c]').addEventListener('click', m.cerrar);
  m.el.querySelector('[data-g]').addEventListener('click', async ev => {
    const rol = f.rol.value, activo = f.activo.checked, empresa = f.empresa.value || null;
    if (rol === 'admin' && c.rol !== 'admin' &&
        !await confirmar(`${c.correo} tendrá acceso total: aprobar proveedores, editar cualquier inventario y gestionar cuentas.`, { aceptar: 'Asignar administrador' })) return;
    await conCarga(ev.target, async () => {
      const { error } = await sb.rpc('admin_actualizar_cuenta', { p_usuario: c.id, p_rol: rol, p_empresa: empresa, p_activo: activo });
      if (error) { toast(mensajeError(error), 'error'); return; }
      m.cerrar(); toast('Cuenta actualizada.', 'exito'); await refrescar();
    });
  });
}

/* ======================================================================
   BITÁCORA
   ====================================================================== */
const fBit = { empresa: '', tabla: '', accion: '', desde: '' };
let bitDatos = [];

async function pintarBitacora() {
  if (!$('#bit-tabla')) {
    $('#p-bitacora').innerHTML = `
    <section class="card">
      <div class="barra">
        <div class="campo crece"><label for="b-emp">Empresa</label><select id="b-emp"><option value="">Todas</option>
          ${S.empresas.map(e => `<option value="${esc(e.id)}">${esc(e.nombre_comercial)}</option>`).join('')}</select></div>
        <div class="campo"><label for="b-tabla">Sección</label><select id="b-tabla"><option value="">Todas</option>
          <option value="productos">Inventario</option><option value="empresas">Perfil de empresa</option>
          <option value="certificaciones_empresa">Certificaciones</option><option value="empresa_categorias">Categorías</option>
          <option value="empresas_privado">Datos fiscales</option><option value="perfiles">Cuentas</option></select></div>
        <div class="campo"><label for="b-acc">Acción</label><select id="b-acc"><option value="">Todas</option>
          <option value="INSERT">Alta</option><option value="UPDATE">Modificación</option><option value="DELETE">Eliminación</option><option value="ESTADO">Cambio de estado</option></select></div>
        <div class="campo"><label for="b-desde">Desde</label><input type="date" id="b-desde"></div>
      </div>
      <div class="tabla-cont alto"><table class="tabla" id="bit-tabla">${CABECERA_BITACORA(true)}<tbody></tbody></table></div>
      <div class="paginacion"><span id="bit-info"></span><button class="btn btn-sec btn-sm" id="bit-mas">Cargar más</button></div>
    </section>`;
    [['#b-emp', 'empresa'], ['#b-tabla', 'tabla'], ['#b-acc', 'accion'], ['#b-desde', 'desde']].forEach(([s, k]) =>
      $(s).addEventListener('change', ev => { fBit[k] = ev.target.value; cargarBitacora(true); }));
    $('#bit-mas').addEventListener('click', () => cargarBitacora(false));
  }
  cargarBitacora(true);
}

async function cargarBitacora(reiniciar) {
  const LOTE = 200;
  if (reiniciar) bitDatos = [];
  let q = sb.from('bitacora').select('*').order('creado_en', { ascending: false });
  if (fBit.empresa) q = q.eq('empresa_id', fBit.empresa);
  if (fBit.tabla) q = q.eq('tabla', fBit.tabla);
  if (fBit.accion) q = q.eq('accion', fBit.accion);
  if (fBit.desde) q = q.gte('creado_en', fBit.desde);
  const { data, error } = await q.range(bitDatos.length, bitDatos.length + LOTE - 1);
  if (error) { toast(mensajeError(error), 'error'); return; }
  bitDatos.push(...data);
  $('#bit-tabla tbody').innerHTML = bitDatos.length
    ? bitDatos.map(r => filaBitacora(r, { conEmpresa: true, nombreEmpresa: nombreEmpresa(r.empresa_id) })).join('')
    : '<tr><td colspan="6" class="vacio">Sin movimientos con estos filtros.</td></tr>';
  $('#bit-info').textContent = `${bitDatos.length} movimientos mostrados`;
  $('#bit-mas').hidden = data.length < LOTE;
}
