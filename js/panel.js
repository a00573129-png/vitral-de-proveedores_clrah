/* =====================================================================
   panel.js — Panel privado del proveedor (panel.html)
   - Proveedor: administra SOLO su empresa (perfil.empresa_id).
   - Administrador: puede abrir panel.html?empresa=<id> para corregir datos.
   La interfaz oculta lo que no corresponde, pero quien decide es la base
   de datos (RLS): cualquier intento sobre otra empresa es rechazado.
   ===================================================================== */
import {
  sb, $, $$, esc, normalizar, fecha, badge, mensajeError, toast, abrirModal, confirmar, conCarga, leerForm,
  marcarErrores, exigirSesion, cerrarSesion, pintarHeader, pie, activarTabs, parametro, todos, nombreArchivo, verDocumento,
  ESTADOS, ESTADOS_CERT, DISPONIBILIDAD
} from './comun.js';
import { htmlDatosGenerales, htmlUbicacion, htmlCategorias, activarUbicacion, categoriasMarcadas, validar, separar } from './form-empresa.js';
import { tablaInventario, monograma } from './fichas.js';
import { filaBitacora, CABECERA_BITACORA } from './bitacora.js';

const S = {
  usuario: null, perfil: null, esAdmin: false, empresaId: null, empresa: null, privado: {},
  categorias: [], catEmpresa: new Set(), productos: [], requisitos: [], certs: [], obs: [], faltantes: [], config: {}
};
const EDITABLES_ENVIO = ['borrador', 'requiere_correcciones', 'pendiente_documentacion'];
let selectorMapa = null;
let historialCargado = false;

init();

/* ----------------------------------------------------------------------
   Carga
   ---------------------------------------------------------------------- */
async function init() {
  pie();
  const r = await exigirSesion();
  if (!r) return;
  Object.assign(S, r);
  S.esAdmin = r.perfil.rol === 'admin';
  S.empresaId = S.esAdmin ? parametro('empresa') : r.perfil.empresa_id;
  if (S.esAdmin && !S.empresaId) { location.href = 'admin.html'; return; }
  if (!S.esAdmin && !S.empresaId) { location.href = 'registro.html'; return; }

  pintarHeader({
    subtitulo: S.esAdmin ? 'Administración · edición de proveedor' : 'Panel del proveedor',
    acciones: `<span class="hdr-usuario">${esc(r.usuario.email)}</span>
      ${S.esAdmin ? '<a class="btn btn-hdr" href="admin.html#proveedores">Volver a administración</a>' : '<a class="btn btn-hdr" href="index.html"><span class="txt-largo">Ver el vitral</span><span class="txt-corto">Vitral</span></a>'}
      <button class="btn btn-hdr" id="salir"><span class="txt-largo">Cerrar sesión</span><span class="txt-corto">Salir</span></button>`
  });
  $('#salir').addEventListener('click', cerrarSesion);

  try {
    await cargar();
  } catch (e) {
    $('#p-solicitud').innerHTML = `<div class="alerta error"><strong>No fue posible cargar el panel.</strong>${esc(mensajeError(e))}</div>`;
    return;
  }
  if (!S.empresa) {
    $('#p-solicitud').innerHTML = '<div class="alerta error">La empresa no existe o no tiene permiso para administrarla.</div>';
    return;
  }
  pintarTodo();
  if (parametro('nuevo')) toast('Empresa guardada como borrador. Agregue sus productos o servicios.', 'exito', 6000);
  activarTabs($('.tabs'), id => {
    if (id === 'empresa') selectorMapa?.invalidar();
    if (id === 'historial' && !historialCargado) cargarHistorial();
  });
}

async function cargar() {
  const id = S.empresaId;
  const [emp, priv, cats, ec, prods, reqs, certs, obs, cfg] = await Promise.all([
    sb.from('empresas').select('*').eq('id', id).maybeSingle(),
    sb.from('empresas_privado').select('*').eq('empresa_id', id).maybeSingle(),
    sb.from('categorias').select('*').order('orden').order('nombre'),
    sb.from('empresa_categorias').select('categoria_id').eq('empresa_id', id),
    todos(() => sb.from('productos').select('*').eq('empresa_id', id).order('nombre')).then(data => ({ data }), error => ({ error })),
    sb.from('requisitos_certificacion').select('*').eq('activo', true).order('orden').order('nombre'),
    sb.from('certificaciones_empresa').select('*').eq('empresa_id', id).order('nombre'),
    sb.from('observaciones').select('*').eq('empresa_id', id).order('creado_en', { ascending: false }),
    sb.from('configuracion').select('*')
  ]);
  for (const x of [emp, priv, cats, ec, prods, reqs, certs, obs, cfg]) if (x.error) throw x.error;
  S.empresa = emp.data;
  S.privado = priv.data || {};
  S.categorias = cats.data;
  S.catEmpresa = new Set(ec.data.map(x => x.categoria_id));
  S.productos = prods.data;
  S.requisitos = reqs.data;
  S.certs = certs.data;
  S.obs = obs.data;
  S.config = Object.fromEntries(cfg.data.map(c => [c.clave, c.valor]));
  if (S.empresa) {
    const f = await sb.rpc('verificar_requisitos', { p_empresa: id });
    S.faltantes = f.error ? [] : f.data;
  }
}

async function recargar(...secciones) {
  await cargar();
  const todas = !secciones.length;
  pintarEncabezado();
  pintarSolicitud();   // el avance y los requisitos dependen de todas las secciones
  if (todas || secciones.includes('empresa')) pintarEmpresa();
  if (todas || secciones.includes('inventario')) pintarInventario();
  if (todas || secciones.includes('certificaciones')) pintarCertificaciones();
  historialCargado = false;
}

const editable = () => S.esAdmin || !['rechazado', 'suspendido'].includes(S.empresa.estado);
const nombresCat = () => new Map(S.categorias.map(c => [c.id, c.nombre]));

function pintarTodo() {
  pintarEncabezado();
  pintarSolicitud();
  pintarEmpresa();
  pintarInventario();
  pintarCertificaciones();
}

function pintarEncabezado() {
  const e = S.empresa;
  $('#titulo').textContent = e.nombre_comercial;
  $('#subtitulo').innerHTML = `${badge(ESTADOS, e.estado)} <span class="texto-gris" style="margin-left:6px">Última actualización: ${fecha(e.actualizado_en, true)}</span>`;
  $('#acciones-titulo').innerHTML = `<a class="btn btn-sec" href="empresa.html?id=${encodeURIComponent(e.id)}" target="_blank" rel="noopener">${e.estado === 'aprobado' ? 'Ver perfil público' : 'Vista previa del perfil'}</a>`;
  $('#banner').innerHTML = S.esAdmin
    ? `<div class="banner-admin"><span>Está editando esta empresa como <b>administrador del CLRAH</b>. Los cambios quedan registrados en la bitácora con su usuario.</span>
       <a class="btn btn-sec btn-sm" href="admin.html#solicitudes">Gestionar estado de la solicitud</a></div>`
    : (!editable() ? `<div class="alerta error"><strong>Edición no disponible</strong>La empresa está ${esc(ESTADOS[e.estado].txt.toLowerCase())}. Puede consultar su información, pero no modificarla. Comuníquese con el CLRAH.</div>` : '');
  $('#c-inv').textContent = S.productos.length;
  $('#c-cert').textContent = S.certs.length;
}

/* ----------------------------------------------------------------------
   Pestaña: Estado de la solicitud
   ---------------------------------------------------------------------- */
const TEXTO_ESTADO = {
  borrador: 'Su solicitud aún no ha sido enviada. Complete los puntos pendientes y envíela para que el CLRAH la revise.',
  enviada: 'Su solicitud fue enviada y está en espera de revisión por el CLRAH. Puede seguir actualizando su inventario.',
  en_revision: 'El CLRAH está revisando su información. Le notificaremos el resultado en este panel.',
  pendiente_documentacion: 'El CLRAH necesita documentación adicional. Revise las observaciones, cargue los documentos y reenvíe la solicitud.',
  requiere_correcciones: 'El CLRAH solicitó correcciones. Revise las observaciones, corrija la información y reenvíe la solicitud.',
  aprobado: 'Su empresa está publicada en el Vitral de Proveedores. Mantenga actualizado su inventario y sus certificaciones.',
  rechazado: 'La solicitud no fue aprobada. Consulte las observaciones o comuníquese con el CLRAH.',
  suspendido: 'La publicación de su empresa está suspendida temporalmente. Consulte las observaciones o comuníquese con el CLRAH.'
};

function pintarSolicitud() {
  const e = S.empresa;
  const puedeEnviar = EDITABLES_ENVIO.includes(e.estado) && !S.esAdmin;
  const listo = !S.faltantes.length;
  const obligatorias = S.requisitos.filter(r => r.obligatoria);
  const pasos = [
    ['Cuenta de acceso', true], ['Datos de la empresa', true],
    ['Ubicación y categorías', S.catEmpresa.size > 0 && !!e.provincia],
    ['Productos y servicios', S.productos.length > 0],
    ['Certificaciones', !S.faltantes.some(f => f.startsWith('Certificación'))],
    ['Envío y revisión', !['borrador'].includes(e.estado)]
  ];
  const actual = pasos.findIndex(p => !p[1]);
  const abiertas = S.obs.filter(o => !o.atendida);

  $('#p-solicitud').innerHTML = `
    <ol class="pasos" aria-label="Avance">${pasos.map(([n, ok], i) =>
      `<li class="${ok ? 'hecho' : (i === actual ? 'actual' : '')}"><span class="p-nombre">${esc(n)}</span></li>`).join('')}</ol>

    <div class="rejilla c2" style="align-items:start">
      <section class="card mb0">
        <div class="estado-cab">${badge(ESTADOS, e.estado)}
          ${e.enviada_en ? `<span class="texto-chico texto-gris">Enviada: ${fecha(e.enviada_en, true)}</span>` : ''}
          ${e.aprobada_en ? `<span class="texto-chico texto-gris">Aprobada: ${fecha(e.aprobada_en)}</span>` : ''}</div>
        <p class="mt" style="font-size:13px;color:var(--text2)">${esc(TEXTO_ESTADO[e.estado])}</p>

        <div class="seccion-titulo mt" style="margin-top:18px">Requisitos para enviar la solicitud</div>
        ${listo ? '<ul class="checklist"><li class="ok">Toda la información obligatoria está completa.</li></ul>'
          : `<ul class="checklist">${S.faltantes.map(f => `<li class="falta">${esc(f)}</li>`).join('')}</ul>`}
        <div class="seccion-titulo mt" style="margin-top:16px">Recomendado</div>
        <ul class="checklist">
          <li class="${e.lat != null ? 'ok' : ''}">Ubicación marcada en el mapa</li>
          <li class="${e.logo_path ? 'ok' : ''}">Logotipo de la empresa</li>
          <li class="${S.productos.some(p => p.disponibilidad !== 'sin_especificar') ? 'ok' : ''}">Disponibilidad indicada en el inventario</li>
          ${obligatorias.length ? '' : `<li class="${S.certs.length ? 'ok' : ''}">Certificaciones con su documento</li>`}
        </ul>
        ${puedeEnviar ? `<div class="acciones mt" style="margin-top:18px">
          <button class="btn btn-primario" id="enviar" ${listo ? '' : 'disabled'}>${e.estado === 'borrador' ? 'Enviar solicitud al CLRAH' : 'Reenviar solicitud corregida'}</button>
          ${listo ? '' : '<span class="texto-chico texto-gris">Complete los requisitos para habilitar el envío.</span>'}</div>` : ''}
      </section>

      <section class="card mb0">
        <div class="card-titulo">Observaciones del CLRAH</div>
        <div class="card-sub">${abiertas.length ? `${abiertas.length} pendiente${abiertas.length > 1 ? 's' : ''} de atender` : 'Sin observaciones pendientes'}</div>
        <div class="mt">${S.obs.length ? S.obs.map(o => `
          <div class="obs ${o.atendida ? '' : 'abierta'}">
            <div class="meta">${fecha(o.creado_en, true)} ${o.estado_asignado ? badge(ESTADOS, o.estado_asignado) : ''}
              ${o.atendida ? '<span>Atendida</span>' : '<span><b>Pendiente</b></span>'}</div>
            <p>${esc(o.mensaje)}</p>
          </div>`).join('') : '<p class="texto-gris texto-chico">Cuando el CLRAH revise su solicitud, sus comentarios aparecerán aquí.</p>'}</div>
      </section>
    </div>`;

  $('#enviar')?.addEventListener('click', async ev => {
    const ok = await confirmar('Se enviará su solicitud al CLRAH para revisión. Podrá seguir actualizando su inventario mientras tanto.',
      { titulo: 'Enviar solicitud', aceptar: 'Enviar solicitud' });
    if (!ok) return;
    await conCarga(ev.target, async () => {
      const { data, error } = await sb.rpc('enviar_solicitud');
      if (error) { toast(mensajeError(error), 'error'); return; }
      if (!data.ok) { toast('Aún faltan requisitos: ' + data.faltantes.join('; '), 'error', 8000); }
      else toast('Solicitud enviada. El CLRAH la revisará.', 'exito');
      await recargar('solicitud');
    });
  });
}

/* ----------------------------------------------------------------------
   Pestaña: Mi empresa
   ---------------------------------------------------------------------- */
function pintarEmpresa() {
  const e = S.empresa;
  const bloqueados = (!S.esAdmin && e.estado === 'aprobado') ? ['nombre_comercial', 'razon_social', 'identificacion_fiscal'] : [];
  const puedeProponer = !S.esAdmin && S.config.proveedores_proponen_categorias === true;
  const visibles = S.categorias.filter(c => c.activa || S.catEmpresa.has(c.id) || c.propuesta_por === S.empresaId);
  const dis = editable() ? '' : 'disabled';
  $('#p-empresa').innerHTML = `
  <form id="f-emp" novalidate>
    <fieldset ${dis} style="border:0;padding:0;margin:0;min-width:0">
    <section class="card">
      <div class="card-cab"><div><div class="card-titulo">Datos generales</div>
        <div class="card-sub">Esta información se muestra en su perfil público, excepto los datos fiscales.</div></div></div>
      ${htmlDatosGenerales(e, S.privado, { bloqueados })}
      ${bloqueados.length ? '<p class="texto-chico texto-gris mt">El nombre comercial y los datos fiscales de una empresa aprobada solo los modifica el CLRAH. Si necesita cambiarlos, escríbanos.</p>' : ''}
    </section>
    <section class="card">
      <div class="card-titulo">Logotipo</div>
      <div class="logo-editor mt">
        ${monograma(e, true)}
        <div>
          <input type="file" id="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only">
          <div class="acciones">
            <label for="logo" class="btn btn-sec">${e.logo_path ? 'Cambiar logotipo' : 'Subir logotipo'}</label>
            ${e.logo_path ? '<button type="button" class="btn btn-peligro" id="quitar-logo">Quitar</button>' : ''}
          </div>
          <p class="ayuda texto-chico texto-gris mt" style="margin-top:6px">PNG, JPG, WEBP o SVG · máximo 1 MB · de preferencia cuadrado.</p>
        </div>
      </div>
    </section>
    <section class="card">
      <div class="card-titulo">Ubicación</div>
      <div class="mt">${htmlUbicacion(e)}</div>
    </section>
    <section class="card">
      <div class="card-titulo">Categorías de productos y servicios</div>
      <div class="card-sub">Seleccione todas las que apliquen.</div>
      <div class="mt">${htmlCategorias(visibles, S.catEmpresa)}</div>
      <p class="error-campo" id="err-cat" hidden></p>
      ${puedeProponer ? `<div class="flex mt">
        <div class="campo crece" style="max-width:360px"><label for="nueva-cat">Proponer una categoría nueva</label>
          <input type="text" id="nueva-cat" maxlength="80" placeholder="Nombre de la categoría"></div>
        <button type="button" class="btn btn-sec" id="proponer" style="align-self:flex-end">Enviar propuesta</button></div>
        <p class="ayuda texto-chico texto-gris" style="margin-top:6px">El CLRAH revisará la propuesta antes de publicarla.</p>` : ''}
    </section>
    <div class="acciones der"><button type="submit" class="btn btn-primario">Guardar cambios</button></div>
    </fieldset>
  </form>`;

  const f = $('#f-emp');
  selectorMapa = activarUbicacion(f, e);
  f.addEventListener('submit', guardarEmpresa);
  $('#logo')?.addEventListener('change', subirLogo);
  $('#quitar-logo')?.addEventListener('click', quitarLogo);
  $('#proponer')?.addEventListener('click', proponerCategoria);
}

async function guardarEmpresa(ev) {
  ev.preventDefault();
  const f = ev.target;
  const d = leerForm(f);
  const cats = categoriasMarcadas(f);
  const err = validar(d, { exigirCategoria: true, categorias: cats });
  $('#err-cat').hidden = !err._categorias;
  $('#err-cat').textContent = err._categorias || '';
  delete err._categorias;
  if (!marcarErrores(f, err) || !cats.length) return;
  const { publico, privado } = separar(d);
  await conCarga(f.querySelector('[type=submit]'), async () => {
    try {
      const r1 = await sb.from('empresas').update(publico).eq('id', S.empresaId).select('id');
      if (r1.error) throw r1.error;
      if (!r1.data.length) throw new Error('No tienes permiso para modificar esta empresa.');
      if (Object.keys(privado).length) {
        const r2 = await sb.from('empresas_privado').update(privado).eq('empresa_id', S.empresaId).select('empresa_id');
        if (r2.error) throw r2.error;
        if (!r2.data.length && S.esAdmin) {
          const r3 = await sb.from('empresas_privado').insert({ empresa_id: S.empresaId, ...privado });
          if (r3.error) throw r3.error;
        }
      }
      const nuevas = cats.filter(c => !S.catEmpresa.has(c));
      const quitadas = [...S.catEmpresa].filter(c => !cats.includes(c));
      if (nuevas.length) {
        const r = await sb.from('empresa_categorias').insert(nuevas.map(c => ({ empresa_id: S.empresaId, categoria_id: c })));
        if (r.error) throw r.error;
      }
      if (quitadas.length) {
        const r = await sb.from('empresa_categorias').delete().eq('empresa_id', S.empresaId).in('categoria_id', quitadas);
        if (r.error) throw r.error;
      }
      toast('Cambios guardados.', 'exito');
      await recargar('empresa');
    } catch (e) { toast(mensajeError(e), 'error', 7000); }
  });
}

async function subirLogo(ev) {
  const archivo = ev.target.files[0];
  if (!archivo) return;
  if (archivo.size > 1024 * 1024) { toast('El logotipo debe pesar máximo 1 MB.', 'error'); return; }
  const ruta = `${S.empresaId}/${nombreArchivo(archivo.name)}`;
  const anterior = S.empresa.logo_path;
  const up = await sb.storage.from('logos').upload(ruta, archivo, { upsert: false, contentType: archivo.type });
  if (up.error) { toast(mensajeError(up.error), 'error'); return; }
  const r = await sb.from('empresas').update({ logo_path: ruta }).eq('id', S.empresaId);
  if (r.error) { toast(mensajeError(r.error), 'error'); await sb.storage.from('logos').remove([ruta]); return; }
  if (anterior) await sb.storage.from('logos').remove([anterior]);
  toast('Logotipo actualizado.', 'exito');
  await recargar('empresa');
}

async function quitarLogo() {
  if (!await confirmar('¿Quitar el logotipo de la empresa?', { aceptar: 'Quitar', peligro: true })) return;
  const anterior = S.empresa.logo_path;
  const r = await sb.from('empresas').update({ logo_path: null }).eq('id', S.empresaId);
  if (r.error) { toast(mensajeError(r.error), 'error'); return; }
  await sb.storage.from('logos').remove([anterior]);
  await recargar('empresa');
}

async function proponerCategoria(ev) {
  const nombre = $('#nueva-cat').value.trim();
  if (nombre.length < 3) { toast('Escriba el nombre de la categoría.', 'error'); return; }
  await conCarga(ev.target, async () => {
    const { error } = await sb.from('categorias').insert({ nombre, activa: false, propuesta_por: S.empresaId });
    if (error) { toast(mensajeError(error), 'error'); return; }
    toast('Propuesta enviada al CLRAH. Puede asignarla a su empresa mientras se revisa.', 'exito', 6000);
    await recargar('empresa');
  });
}

/* ----------------------------------------------------------------------
   Pestaña: Inventario
   ---------------------------------------------------------------------- */
const filtrosInv = { q: '', tipo: '', disp: '', cat: '' };

function pintarInventario() {
  const usadas = [...new Set(S.productos.map(p => p.categoria_id).filter(Boolean))];
  const cats = nombresCat();
  $('#p-inventario').innerHTML = `
  <section class="card">
    <div class="card-cab">
      <div><div class="card-titulo">Inventario de productos y servicios</div>
        <div class="card-sub">Lo que registre aquí se publica de inmediato en su perfil${S.empresa.estado === 'aprobado' ? '' : ' cuando la empresa sea aprobada'}.</div></div>
    </div>
    <div class="barra">
      <div class="campo crece"><label for="iv-q">Buscar</label><input type="search" id="iv-q" value="${esc(filtrosInv.q)}" placeholder="Nombre o descripción"></div>
      <div class="campo"><label for="iv-tipo">Tipo</label><select id="iv-tipo"><option value="">Todos</option>
        <option value="producto" ${filtrosInv.tipo === 'producto' ? 'selected' : ''}>Productos</option>
        <option value="servicio" ${filtrosInv.tipo === 'servicio' ? 'selected' : ''}>Servicios</option></select></div>
      <div class="campo"><label for="iv-cat">Categoría</label><select id="iv-cat"><option value="">Todas</option>
        ${usadas.map(id => `<option value="${esc(id)}" ${filtrosInv.cat === id ? 'selected' : ''}>${esc(cats.get(id) || '')}</option>`).join('')}</select></div>
      <div class="campo"><label for="iv-disp">Disponibilidad</label><select id="iv-disp"><option value="">Todas</option>
        ${Object.entries(DISPONIBILIDAD).map(([k, v]) => `<option value="${k}" ${filtrosInv.disp === k ? 'selected' : ''}>${esc(v.txt)}</option>`).join('')}</select></div>
      <div class="acciones">${editable() ? '<button class="btn btn-primario" id="agregar">Agregar producto o servicio</button>' : ''}</div>
    </div>
    <div id="iv-tabla"></div>
  </section>`;
  ['q', 'tipo', 'cat', 'disp'].forEach(k => $(`#iv-${k}`).addEventListener('input', ev => { filtrosInv[k] = ev.target.value; pintarTablaInv(); }));
  $('#agregar')?.addEventListener('click', () => editarProducto(null));
  pintarTablaInv();
}

function pintarTablaInv() {
  const q = normalizar(filtrosInv.q);
  const lista = S.productos.filter(p =>
    (!q || normalizar(`${p.nombre} ${p.descripcion || ''}`).includes(q)) &&
    (!filtrosInv.tipo || p.tipo === filtrosInv.tipo) &&
    (!filtrosInv.cat || p.categoria_id === filtrosInv.cat) &&
    (!filtrosInv.disp || p.disponibilidad === filtrosInv.disp));
  const cont = $('#iv-tabla');
  if (!S.productos.length) {
    cont.innerHTML = `<div class="vacio"><strong>Aún no hay productos ni servicios</strong>
      Agregue lo que su empresa ofrece: nombre, categoría, disponibilidad y las características que considere útiles.</div>`;
    return;
  }
  if (!lista.length) { cont.innerHTML = '<div class="vacio"><strong>Sin resultados</strong>Ningún registro coincide con los filtros.</div>'; return; }
  const acciones = editable() ? p => `
    <label class="sr-only" for="d-${p.id}">Disponibilidad de ${esc(p.nombre)}</label>
    <select class="sel-inline" id="d-${p.id}" data-disp="${p.id}">${Object.entries(DISPONIBILIDAD)
      .map(([k, v]) => `<option value="${k}" ${p.disponibilidad === k ? 'selected' : ''}>${esc(v.txt)}</option>`).join('')}</select>
    <button class="btn btn-texto btn-sm" data-editar="${p.id}">Editar</button>
    <button class="btn btn-texto btn-sm" style="color:var(--error-text)" data-borrar="${p.id}">Eliminar</button>` : null;
  cont.innerHTML = `<p class="texto-chico texto-gris" style="margin-bottom:8px">${lista.length} de ${S.productos.length} registros</p>` +
    tablaInventario(lista, nombresCat(), { acciones });
  cont.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => editarProducto(S.productos.find(p => p.id === b.dataset.editar))));
  cont.querySelectorAll('[data-borrar]').forEach(b => b.addEventListener('click', () => borrarProducto(S.productos.find(p => p.id === b.dataset.borrar))));
  cont.querySelectorAll('[data-disp]').forEach(s => s.addEventListener('change', async () => {
    const id = s.dataset.disp;
    const { data, error } = await sb.from('productos').update({ disponibilidad: s.value }).eq('id', id).select().single();
    if (error) { toast(mensajeError(error), 'error'); return; }
    Object.assign(S.productos.find(p => p.id === id), data);
    toast('Disponibilidad actualizada.', 'exito', 2500);
    pintarTablaInv();
  }));
}

function filaSpec(s = {}) {
  return `<div class="spec-fila">
    <input type="text" data-spec="clave" value="${esc(s.clave || '')}" placeholder="Característica (p. ej. Talla)" maxlength="80" aria-label="Característica">
    <input type="text" data-spec="valor" value="${esc(s.valor || '')}" placeholder="Valor (p. ej. M, L, XL)" maxlength="200" aria-label="Valor">
    <button type="button" class="btn btn-texto btn-sm" data-quitar-spec aria-label="Quitar característica">Quitar</button></div>`;
}

function editarProducto(p) {
  const nuevo = !p;
  p = p || { tipo: 'producto', disponibilidad: 'sin_especificar', activo: true, especificaciones: [] };
  const cats = S.categorias.filter(c => c.activa || S.catEmpresa.has(c.id));
  const m = abrirModal(`
    <form id="f-prod" class="rejilla c2" novalidate>
      <div class="campo ancho-total"><span class="etq">Tipo</span>
        <div class="chips-sel">
          <label class="chip-sel"><input type="radio" name="tipo" value="producto" ${p.tipo === 'producto' ? 'checked' : ''}> Producto</label>
          <label class="chip-sel"><input type="radio" name="tipo" value="servicio" ${p.tipo === 'servicio' ? 'checked' : ''}> Servicio</label>
        </div></div>
      <div class="campo ancho-total"><label for="p-nombre">Nombre<span class="req">*</span></label>
        <input type="text" id="p-nombre" name="nombre" value="${esc(p.nombre || '')}" maxlength="300"></div>
      <div class="campo"><label for="p-cat">Categoría</label>
        <select id="p-cat" name="categoria_id"><option value="">Sin categoría</option>
          ${cats.map(c => `<option value="${esc(c.id)}" ${p.categoria_id === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
      <div class="campo"><label for="p-disp">Disponibilidad</label>
        <select id="p-disp" name="disponibilidad">${Object.entries(DISPONIBILIDAD)
          .map(([k, v]) => `<option value="${k}" ${p.disponibilidad === k ? 'selected' : ''}>${esc(v.txt)}</option>`).join('')}</select></div>
      <div class="campo ancho-total"><label for="p-desc">Descripción</label>
        <textarea id="p-desc" name="descripcion" rows="3" maxlength="2000">${esc(p.descripcion || '')}</textarea></div>
      <div class="campo"><label for="p-exist">Existencia</label>
        <input type="number" id="p-exist" name="existencia" min="0" step="any" value="${p.existencia ?? ''}">
        <span class="ayuda">Cantidad disponible (opcional).</span></div>
      <div class="campo"><label for="p-unidad">Unidad de medida</label>
        <input type="text" id="p-unidad" name="unidad_medida" value="${esc(p.unidad_medida || '')}" maxlength="60" placeholder="p. ej. cajas, unidades, m³"></div>
      <div class="campo"><label for="p-pres">Presentación o formato</label>
        <input type="text" id="p-pres" name="presentacion" value="${esc(p.presentacion || '')}" maxlength="200" placeholder="p. ej. Caja de 100 unidades"></div>
      <div class="campo"><label for="p-cap">Capacidad de suministro</label>
        <input type="text" id="p-cap" name="capacidad_suministro" value="${esc(p.capacidad_suministro || '')}" maxlength="200" placeholder="p. ej. 5,000 unidades al mes"></div>
      <div class="campo ancho-total"><span class="etq">Especificaciones o características</span>
        <div class="specs-editor" id="specs">${(p.especificaciones || []).map(filaSpec).join('')}</div>
        <button type="button" class="btn btn-sec btn-sm" id="mas-spec" style="align-self:flex-start;margin-top:6px">Agregar característica</button></div>
      <div class="campo ancho-total"><label for="p-info">Información adicional</label>
        <textarea id="p-info" name="informacion_adicional" rows="2" maxlength="1000">${esc(p.informacion_adicional || '')}</textarea></div>
      <label class="check ancho-total"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}> Visible en el perfil público</label>
    </form>`, {
    titulo: nuevo ? 'Agregar producto o servicio' : 'Editar producto o servicio', tam: 'grande',
    pie: `<button class="btn btn-sec" type="button" data-cancelar>Cancelar</button>
          <button class="btn btn-primario" type="button" data-guardar>${nuevo ? 'Agregar al inventario' : 'Guardar cambios'}</button>`
  });
  const f = m.el.querySelector('#f-prod');
  const specs = m.el.querySelector('#specs');
  m.el.querySelector('#mas-spec').addEventListener('click', () => { specs.insertAdjacentHTML('beforeend', filaSpec()); specs.lastElementChild.querySelector('input').focus(); });
  specs.addEventListener('click', ev => { if (ev.target.matches('[data-quitar-spec]')) ev.target.closest('.spec-fila').remove(); });
  m.el.querySelector('[data-cancelar]').addEventListener('click', m.cerrar);
  m.el.querySelector('[data-guardar]').addEventListener('click', async ev => {
    const d = leerForm(f);
    if (!marcarErrores(f, d.nombre ? {} : { nombre: 'Escriba el nombre.' })) return;
    if (d.existencia !== null && (isNaN(Number(d.existencia)) || Number(d.existencia) < 0)) { marcarErrores(f, { existencia: 'Debe ser un número mayor o igual a cero.' }); return; }
    const fila = {
      tipo: f.tipo.value, nombre: d.nombre, categoria_id: d.categoria_id, disponibilidad: d.disponibilidad,
      descripcion: d.descripcion, existencia: d.existencia === null ? null : Number(d.existencia), unidad_medida: d.unidad_medida,
      presentacion: d.presentacion, capacidad_suministro: d.capacidad_suministro, informacion_adicional: d.informacion_adicional,
      activo: f.activo.checked,
      especificaciones: [...specs.querySelectorAll('.spec-fila')].map(r => ({
        clave: r.querySelector('[data-spec=clave]').value.trim(), valor: r.querySelector('[data-spec=valor]').value.trim()
      })).filter(s => s.clave || s.valor)
    };
    await conCarga(ev.target, async () => {
      const q = nuevo
        ? sb.from('productos').insert({ ...fila, empresa_id: S.empresaId }).select().single()
        : sb.from('productos').update(fila).eq('id', p.id).select().single();
      const { data, error } = await q;
      if (error) { toast(mensajeError(error), 'error', 7000); return; }
      if (nuevo) S.productos.push(data); else Object.assign(S.productos.find(x => x.id === p.id), data);
      S.productos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      m.cerrar();
      toast(nuevo ? 'Agregado al inventario.' : 'Cambios guardados.', 'exito');
      pintarEncabezado();
      pintarTablaInv();
      if (nuevo && S.productos.length === 1) recargar('solicitud');
    });
  });
}

async function borrarProducto(p) {
  const ok = await confirmar(`Se eliminará "${p.nombre}" del inventario. Esta acción no se puede deshacer.\n\nSi solo quiere dejar de mostrarlo, edítelo y desmarque "Visible en el perfil público".`,
    { titulo: 'Eliminar del inventario', aceptar: 'Eliminar', peligro: true });
  if (!ok) return;
  const { data, error } = await sb.from('productos').delete().eq('id', p.id).select('id');
  if (error || !data.length) { toast(error ? mensajeError(error) : 'No tienes permiso para eliminar este registro.', 'error'); return; }
  S.productos = S.productos.filter(x => x.id !== p.id);
  toast('Registro eliminado.', 'exito');
  pintarEncabezado();
  pintarTablaInv();
}

/* ----------------------------------------------------------------------
   Pestaña: Certificaciones
   ---------------------------------------------------------------------- */
function pintarCertificaciones() {
  const porReq = new Map();
  S.certs.forEach(c => { if (c.requisito_id) porReq.set(c.requisito_id, c); });
  const otras = S.certs.filter(c => !c.requisito_id || !S.requisitos.some(r => r.id === c.requisito_id));
  const ed = editable();
  const fila = (nombre, req, c) => `
    <tr>
      <td><div class="principal">${esc(nombre)}</div>${req?.descripcion ? `<div class="secundario">${esc(req.descripcion)}</div>` : ''}</td>
      <td>${req ? (req.obligatoria ? '<span class="badge b-aviso">Obligatoria</span>' : '<span class="badge b-neutro">Opcional</span>') : '<span class="badge b-neutro">Adicional</span>'}</td>
      <td>${c ? badge(ESTADOS_CERT, c.estado) : '<span class="texto-gris">No registrada</span>'}
        ${c?.observaciones ? `<div class="secundario" style="max-width:260px">CLRAH: ${esc(c.observaciones)}</div>` : ''}</td>
      <td>${esc(c?.organismo || '—')}</td>
      <td style="white-space:nowrap">${c?.vigencia_hasta ? fecha(c.vigencia_hasta) : '—'}</td>
      <td>${c?.documento_path ? `<button class="btn btn-texto btn-sm" data-doc="${esc(c.documento_path)}">Ver documento</button>` : (req?.requiere_documento ? '<span class="secundario">Pendiente</span>' : '—')}</td>
      <td class="acc">${ed ? (c
        ? `<button class="btn btn-texto btn-sm" data-cert="${c.id}">Actualizar</button>
           <button class="btn btn-texto btn-sm" style="color:var(--error-text)" data-borrar-cert="${c.id}">Eliminar</button>`
        : `<button class="btn btn-sec btn-sm" data-nuevo-req="${req.id}">Registrar</button>`) : ''}</td>
    </tr>`;
  $('#p-certificaciones').innerHTML = `
  <section class="card">
    <div class="card-cab">
      <div><div class="card-titulo">Certificaciones y documentación</div>
        <div class="card-sub">Cada documento que cargue será revisado por el CLRAH. Al actualizar una certificación, vuelve a revisión.</div></div>
      ${ed ? '<button class="btn btn-primario" id="otra-cert">Agregar otra certificación</button>' : ''}
    </div>
    <div class="tabla-cont">
      <table class="tabla">
        <thead><tr><th>Certificación</th><th>Requisito</th><th>Estado</th><th>Organismo certificador</th><th>Vigencia</th><th>Documento</th><th class="acc">Acciones</th></tr></thead>
        <tbody>
          ${S.requisitos.map(r => fila(r.nombre, r, porReq.get(r.id))).join('')}
          ${otras.map(c => fila(c.nombre, null, c)).join('')}
          ${!S.requisitos.length && !otras.length ? '<tr><td colspan="7" class="vacio">No hay certificaciones configuradas.</td></tr>' : ''}
        </tbody>
      </table>
    </div>
    <p class="texto-chico texto-gris mt">Formatos aceptados: PDF, JPG o PNG · máximo 10 MB. Los documentos son privados: solo los ve su empresa y el CLRAH.</p>
  </section>`;
  const c = $('#p-certificaciones');
  c.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => verDocumento(b.dataset.doc)));
  c.querySelectorAll('[data-cert]').forEach(b => b.addEventListener('click', () => editarCert(S.certs.find(x => x.id === b.dataset.cert))));
  c.querySelectorAll('[data-nuevo-req]').forEach(b => b.addEventListener('click', () => editarCert(null, b.dataset.nuevoReq)));
  c.querySelectorAll('[data-borrar-cert]').forEach(b => b.addEventListener('click', () => borrarCert(S.certs.find(x => x.id === b.dataset.borrarCert))));
  $('#otra-cert')?.addEventListener('click', () => editarCert(null, null));
}

function editarCert(c, requisitoId) {
  const nuevo = !c;
  const reqId = c?.requisito_id ?? requisitoId ?? '';
  const req = S.requisitos.find(r => r.id === reqId);
  const m = abrirModal(`
    <form id="f-cert" class="rejilla c2" novalidate>
      <div class="campo ancho-total"><label for="c-req">Certificación</label>
        <select id="c-req" name="requisito_id" ${!nuevo ? 'disabled' : ''}>
          <option value="">Otra (especificar)</option>
          ${S.requisitos.map(r => `<option value="${esc(r.id)}" ${r.id === reqId ? 'selected' : ''}>${esc(r.nombre)}${r.obligatoria ? ' (obligatoria)' : ''}</option>`).join('')}
        </select></div>
      <div class="campo ancho-total" id="c-nombre-campo" ${reqId ? 'hidden' : ''}><label for="c-nombre">Nombre de la certificación<span class="req">*</span></label>
        <input type="text" id="c-nombre" name="nombre" value="${esc(!reqId ? c?.nombre || '' : '')}" maxlength="150"></div>
      <div class="campo ancho-total"><label for="c-org">Organismo certificador</label>
        <input type="text" id="c-org" name="organismo" value="${esc(c?.organismo || '')}" maxlength="200"></div>
      <div class="campo"><label for="c-emi">Fecha de emisión</label>
        <input type="date" id="c-emi" name="fecha_emision" value="${esc(c?.fecha_emision || '')}"></div>
      <div class="campo"><label for="c-vig">Vigente hasta</label>
        <input type="date" id="c-vig" name="vigencia_hasta" value="${esc(c?.vigencia_hasta || '')}"></div>
      <div class="campo ancho-total"><label for="c-doc">Documento comprobatorio${req?.requiere_documento ? '<span class="req">*</span>' : ''}</label>
        ${c?.documento_path ? `<div class="archivo-actual">Documento actual cargado <button type="button" class="btn btn-texto btn-sm" data-ver>Ver</button></div>` : ''}
        <input type="file" id="c-doc" accept="application/pdf,image/png,image/jpeg">
        <span class="ayuda">${c?.documento_path ? 'Seleccione un archivo solo si desea reemplazar el actual.' : 'PDF, JPG o PNG, máximo 10 MB.'}</span></div>
    </form>
    ${!nuevo && c.estado === 'validada' ? '<div class="alerta aviso mt mb0">Esta certificación está validada. Si la modifica, volverá a revisión del CLRAH.</div>' : ''}`, {
    titulo: nuevo ? 'Registrar certificación' : 'Actualizar certificación',
    pie: `<button class="btn btn-sec" type="button" data-cancelar>Cancelar</button>
          <button class="btn btn-primario" type="button" data-guardar>Guardar y enviar a revisión</button>`
  });
  const f = m.el.querySelector('#f-cert');
  f.requisito_id.addEventListener('change', () => { m.el.querySelector('#c-nombre-campo').hidden = !!f.requisito_id.value; });
  m.el.querySelector('[data-ver]')?.addEventListener('click', () => verDocumento(c.documento_path));
  m.el.querySelector('[data-cancelar]').addEventListener('click', m.cerrar);
  m.el.querySelector('[data-guardar]').addEventListener('click', async ev => {
    const d = leerForm(f);
    const rid = nuevo ? f.requisito_id.value : c.requisito_id;
    const r = S.requisitos.find(x => x.id === rid);
    const archivo = f.querySelector('#c-doc').files[0];
    const err = {};
    if (!rid && !d.nombre) err.nombre = 'Escriba el nombre de la certificación.';
    if (archivo && archivo.size > 10 * 1024 * 1024) err['c-doc'] = 'El archivo supera 10 MB.';
    if (d.fecha_emision && d.vigencia_hasta && d.vigencia_hasta < d.fecha_emision) err.vigencia_hasta = 'La vigencia debe ser posterior a la emisión.';
    if (r?.requiere_documento && !archivo && !c?.documento_path) err['c-doc'] = 'Este requisito necesita un documento.';
    if (!marcarErrores(f, err)) return;
    await conCarga(ev.target, async () => {
      let ruta = c?.documento_path || null;
      if (archivo) {
        ruta = `${S.empresaId}/${nombreArchivo(archivo.name)}`;
        const up = await sb.storage.from('documentos').upload(ruta, archivo, { contentType: archivo.type });
        if (up.error) { toast(mensajeError(up.error), 'error'); return; }
      }
      const fila = {
        requisito_id: rid || null, nombre: r ? r.nombre : d.nombre, organismo: d.organismo,
        fecha_emision: d.fecha_emision, vigencia_hasta: d.vigencia_hasta, documento_path: ruta
      };
      const q = nuevo
        ? sb.from('certificaciones_empresa').insert({ ...fila, empresa_id: S.empresaId })
        : sb.from('certificaciones_empresa').update(fila).eq('id', c.id);
      const { error } = await q;
      if (error) {
        if (archivo) await sb.storage.from('documentos').remove([ruta]);
        toast(mensajeError(error), 'error', 7000); return;
      }
      if (archivo && c?.documento_path) await sb.storage.from('documentos').remove([c.documento_path]);
      m.cerrar();
      toast('Certificación guardada. Quedó en revisión del CLRAH.', 'exito');
      await recargar('certificaciones');
    });
  });
}

async function borrarCert(c) {
  const ok = await confirmar(`Se eliminará la certificación "${c.nombre}" y su documento. Esta acción no se puede deshacer.`,
    { titulo: 'Eliminar certificación', aceptar: 'Eliminar', peligro: true });
  if (!ok) return;
  const { data, error } = await sb.from('certificaciones_empresa').delete().eq('id', c.id).select('id');
  if (error || !data.length) { toast(error ? mensajeError(error) : 'No tienes permiso para eliminar este registro.', 'error'); return; }
  if (c.documento_path) await sb.storage.from('documentos').remove([c.documento_path]);
  toast('Certificación eliminada.', 'exito');
  await recargar('certificaciones');
}

/* ----------------------------------------------------------------------
   Pestaña: Historial
   ---------------------------------------------------------------------- */
async function cargarHistorial() {
  const cont = $('#p-historial');
  cont.innerHTML = '<div class="card"><div class="cargando-bloque"><span class="spinner"></span>Cargando historial…</div></div>';
  const { data, error } = await sb.from('bitacora').select('*').eq('empresa_id', S.empresaId)
    .order('creado_en', { ascending: false }).limit(500);
  if (error) { cont.innerHTML = `<div class="alerta error">${esc(mensajeError(error))}</div>`; return; }
  historialCargado = true;
  const pintar = solo => {
    const filas = data.filter(r => !solo || r.tabla === solo);
    cont.querySelector('tbody').innerHTML = filas.length ? filas.map(r => filaBitacora(r)).join('')
      : '<tr><td colspan="5" class="vacio">Sin movimientos registrados.</td></tr>';
  };
  cont.innerHTML = `
  <section class="card">
    <div class="card-cab">
      <div><div class="card-titulo">Historial de modificaciones</div>
        <div class="card-sub">Registro automático de cada cambio en su empresa: quién lo hizo y cuándo. Se muestran los últimos 500.</div></div>
      <div class="campo"><label for="h-sec">Sección</label>
        <select id="h-sec"><option value="">Todas</option><option value="productos">Inventario</option>
          <option value="empresas">Perfil de empresa</option><option value="certificaciones_empresa">Certificaciones</option>
          <option value="empresa_categorias">Categorías</option></select></div>
    </div>
    <div class="tabla-cont alto"><table class="tabla">${CABECERA_BITACORA(false)}<tbody></tbody></table></div>
  </section>`;
  $('#h-sec').addEventListener('change', ev => pintar(ev.target.value));
  pintar('');
}
