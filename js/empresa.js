/* =====================================================================
   empresa.js — Perfil público de un proveedor e inventario (empresa.html?id=)
   El inventario mostrado pertenece EXCLUSIVAMENTE a la empresa del perfil.
   ===================================================================== */
import {
  sb, configurado, todos, $, esc, normalizar, fecha, urlSegura, mensajeError, parametro, badge,
  pintarHeader, accionesSesionPublica, avisoSinConfiguracion, pie, ESTADOS, ESTADOS_CERT, DISPONIBILIDAD
} from './comun.js';
import { mapaPunto } from './mapa.js';
import { badgeRegistro, monograma, tablaInventario, tarjetasInventario } from './fichas.js';

const POR_PAGINA = 40;
let items = [], cats = new Map(), vista = 'tabla', pagina = 1;

init();

async function init() {
  pie();
  pintarHeader({ acciones: await accionesSesionPublica() });
  const cont = $('#contenido');
  if (!configurado) { avisoSinConfiguracion(cont); return; }
  const id = parametro('id');
  if (!id) { cont.innerHTML = vacio('No se indicó el proveedor.'); return; }

  try {
    let { data: e, error } = await sb.from('vitral_empresas').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    let vistaPrevia = false;
    if (!e) {
      // El propietario o el admin pueden previsualizar una empresa aún no publicada
      const r = await sb.from('empresas').select('*').eq('id', id).maybeSingle();
      if (r.data) {
        const [ec, cs] = await Promise.all([
          sb.from('empresa_categorias').select('categoria_id').eq('empresa_id', id),
          sb.from('categorias').select('id, nombre')
        ]);
        const ids = new Set((ec.data || []).map(x => x.categoria_id));
        e = { ...r.data, categorias: (cs.data || []).filter(c => ids.has(c.id)), cuenta_activa: true };
        vistaPrevia = true;
      }
    }
    if (!e) { cont.innerHTML = vacio('Este proveedor no existe o no está publicado en el vitral.'); return; }

    const [prods, cs, certs] = await Promise.all([
      todos(() => sb.from('productos').select('*').eq('empresa_id', id).eq('activo', true).order('nombre')).then(data => ({ data }), error => ({ error })),
      sb.from('categorias').select('id, nombre'),
      sb.from('certificaciones_empresa').select('nombre, organismo, vigencia_hasta, estado')
        .eq('empresa_id', id).in('estado', ['validada', 'declarada', 'pendiente']).order('nombre')
    ]);
    if (prods.error) throw prods.error;
    items = prods.data;
    cats = new Map((cs.data || []).map(c => [c.id, c.nombre]));
    document.title = `${e.nombre_comercial} · Vitral de Proveedores CLRAH`;
    $('#miga-nombre').textContent = e.nombre_comercial;
    pintar(e, certs.data || [], vistaPrevia);
  } catch (err) {
    cont.innerHTML = `<div class="alerta error"><strong>No fue posible cargar el perfil.</strong>${esc(mensajeError(err))}</div>`;
  }
}

const vacio = t => `<div class="card vacio"><strong>Proveedor no disponible</strong>${esc(t)}
  <div class="mt"><a class="btn btn-sec btn-sm" href="index.html">Volver al directorio</a></div></div>`;

function fila(etq, valor) {
  return valor ? `<dt>${etq}</dt><dd>${valor}</dd>` : '';
}

function pintar(e, certs, vistaPrevia) {
  const web = urlSegura(e.sitio_web);
  const cont = $('#contenido');
  cont.innerHTML = `
    ${vistaPrevia ? `<div class="alerta aviso"><strong>Vista previa</strong>Esta empresa no está publicada en el vitral
      (estado: ${esc(ESTADOS[e.estado]?.txt || e.estado)}). Solo usted y el administrador pueden ver esta página.</div>` : ''}
    <section class="card">
      <div class="perfil-cab">
        ${monograma(e, true)}
        <div class="crece">
          <h1>${esc(e.nombre_comercial)}</h1>
          <div class="perfil-meta">
            ${badgeRegistro(e)}
            <span>${esc([e.provincia, e.pais].filter(Boolean).join(', ') || 'Ubicación no registrada')}</span>
            <span>·</span><span>Actualizado ${fecha(e.actualizado_en)}</span>
          </div>
          <div class="prov-etiquetas mt" style="margin-top:10px">
            ${(e.categorias || []).map(c => `<span class="etiqueta azul">${esc(c.nombre)}</span>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <div class="perfil-grid">
      <div>
        <section class="card">
          <div class="card-titulo">Información general</div>
          ${e.descripcion ? `<p class="mt" style="font-size:13px;color:var(--text2);white-space:pre-line">${esc(e.descripcion)}</p>` : ''}
          <dl class="dl mt">
            ${fila('Actividad principal', esc(e.actividad_principal))}
            ${fila('Dirección', esc(e.direccion))}
            ${fila('Provincia', esc([e.provincia, e.distrito].filter(Boolean).join(' · ')))}
            ${fila('Almacenamiento', e.camara_frigorifica === true ? 'Cuenta con cámara frigorífica' : e.camara_frigorifica === false ? 'Sin cámara frigorífica' : '')}
          </dl>
          ${!e.cuenta_activa ? `<p class="aviso-ref mt">Esta ficha fue elaborada por el CLRAH con información de referencia.
            La empresa aún no administra su propio perfil; la disponibilidad de su inventario no ha sido confirmada por el proveedor.</p>` : ''}
        </section>

        <section class="card" id="inventario">
          <div class="card-cab">
            <div>
              <div class="card-titulo">Inventario de productos y servicios</div>
              <div class="card-sub">${items.length} registros publicados por ${esc(e.nombre_comercial)}</div>
            </div>
            <div class="vista-toggle" role="group" aria-label="Vista del inventario">
              <button type="button" data-vista="tabla" aria-pressed="true">Tabla</button>
              <button type="button" data-vista="tarjetas" aria-pressed="false">Tarjetas</button>
            </div>
          </div>
          ${items.length ? `
          <div class="inv-filtros">
            <div class="campo campo-buscar"><label for="i-q">Buscar en el inventario</label>
              <input type="search" id="i-q" placeholder="Nombre, descripción o especificación"></div>
            <div class="campo"><label for="i-tipo">Tipo</label>
              <select id="i-tipo"><option value="">Todos</option><option value="producto">Productos</option><option value="servicio">Servicios</option></select></div>
            <div class="campo"><label for="i-cat">Categoría</label>
              <select id="i-cat"><option value="">Todas</option>${[...new Set(items.map(p => p.categoria_id).filter(Boolean))]
                .map(id => `<option value="${esc(id)}">${esc(cats.get(id) || '')}</option>`).join('')}</select></div>
            <div class="campo"><label for="i-disp">Disponibilidad</label>
              <select id="i-disp"><option value="">Todas</option>${Object.entries(DISPONIBILIDAD)
                .map(([k, v]) => `<option value="${k}">${esc(v.txt)}</option>`).join('')}</select></div>
          </div>
          <div id="inv"></div>` : '<div class="vacio"><strong>Sin inventario publicado</strong>Este proveedor aún no ha registrado productos o servicios.</div>'}
        </section>
      </div>

      <aside>
        <section class="card">
          <div class="card-titulo">Contacto</div>
          <dl class="dl mt" style="grid-template-columns:110px 1fr">
            ${fila('Persona', esc(e.persona_contacto))}
            ${fila('Teléfono', e.telefono ? esc(e.telefono) : '')}
            ${fila('Correo', e.correo ? e.correo.split(/\s*\/\s*/).map(c => `<a href="mailto:${esc(c)}">${esc(c)}</a>`).join('<br>') : '')}
            ${fila('Sitio web', web ? `<a href="${esc(web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\//, ''))}</a>` : '')}
          </dl>
          ${!e.telefono && !e.correo && !e.persona_contacto ? '<p class="texto-gris texto-chico mt">Sin datos de contacto registrados.</p>' : ''}
        </section>

        <section class="card">
          <div class="card-titulo">Certificaciones</div>
          ${certs.length ? `<ul class="lista-cert mt">${certs.map(c => `
            <li><div><div>${esc(c.nombre)}</div>
              <div class="org">${esc([c.organismo, c.vigencia_hasta ? 'Vigente hasta ' + fecha(c.vigencia_hasta) : ''].filter(Boolean).join(' · '))}</div></div>
              ${badge(ESTADOS_CERT, c.estado)}</li>`).join('')}</ul>
            <p class="texto-gris texto-chico mt">"Validada": documento revisado por el CLRAH. "Declarada": informada sin documento revisado.</p>`
          : '<p class="texto-gris texto-chico mt">No hay certificaciones registradas.</p>'}
        </section>

        <section class="card">
          <div class="card-titulo">Ubicación</div>
          ${e.lat != null && e.lng != null
            ? `<div class="mapa bajo mt" id="mapa-punto" aria-label="Mapa de ubicación"></div>
               <dl class="dl mt" style="grid-template-columns:90px 1fr">
                 <dt>Latitud</dt><dd>${e.lat}</dd><dt>Longitud</dt><dd>${e.lng}</dd>
               </dl>
               <div class="acciones mt">
                 <a class="btn btn-sec btn-sm" href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}" target="_blank" rel="noopener">Abrir en Google Maps</a>
                 <a class="btn btn-texto btn-sm" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank" rel="noopener">Cómo llegar</a>
               </div>`
            : `<p class="texto-gris texto-chico mt">${esc(e.direccion || 'Sin dirección registrada')}<br>Coordenadas aún no registradas.</p>`}
        </section>
      </aside>
    </div>`;

  if (e.lat != null && e.lng != null && window.L) mapaPunto($('#mapa-punto'), e.lat, e.lng, e.nombre_comercial);
  if (!items.length) return;
  cont.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => {
    vista = b.dataset.vista;
    cont.querySelectorAll('[data-vista]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    pintarInv();
  }));
  ['#i-q', '#i-tipo', '#i-cat', '#i-disp'].forEach(s => $(s).addEventListener('input', () => { pagina = 1; pintarInv(); }));
  pintarInv();
}

function pintarInv() {
  const q = normalizar($('#i-q').value.trim());
  const t = $('#i-tipo').value, c = $('#i-cat').value, d = $('#i-disp').value;
  const lista = items.filter(p =>
    (!q || normalizar([p.nombre, p.descripcion, p.presentacion, p.informacion_adicional,
      (p.especificaciones || []).map(s => `${s.clave} ${s.valor}`).join(' ')].join(' ')).includes(q)) &&
    (!t || p.tipo === t) && (!c || p.categoria_id === c) && (!d || p.disponibilidad === d));
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  pagina = Math.min(pagina, paginas);
  const tramo = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const html = !lista.length
    ? '<div class="vacio"><strong>Sin resultados</strong>Ningún registro coincide con la búsqueda.</div>'
    : (vista === 'tabla' ? tablaInventario(tramo, cats) : tarjetasInventario(tramo, cats));
  $('#inv').innerHTML = html + (lista.length > POR_PAGINA ? `
    <div class="paginacion">
      <span>Mostrando ${(pagina - 1) * POR_PAGINA + 1}–${Math.min(pagina * POR_PAGINA, lista.length)} de ${lista.length}</span>
      <span class="acciones">
        <button class="btn btn-sec btn-sm" data-p="-1" ${pagina === 1 ? 'disabled' : ''}>Anterior</button>
        <button class="btn btn-sec btn-sm" data-p="1" ${pagina === paginas ? 'disabled' : ''}>Siguiente</button>
      </span>
    </div>` : '');
  $('#inv').querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { pagina += Number(b.dataset.p); pintarInv(); }));
}
