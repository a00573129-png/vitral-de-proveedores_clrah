/* =====================================================================
   form-empresa.js — Formulario de datos de la empresa (registro y panel)
   ===================================================================== */
import { esc, PROVINCIAS, correoValido, urlSegura } from './comun.js';
import { selectorUbicacion } from './mapa.js';

const v = x => esc(x ?? '');

export function htmlDatosGenerales(e = {}, p = {}, { bloqueados = [] } = {}) {
  const dis = n => bloqueados.includes(n) ? 'disabled title="Solo el administrador puede modificar este dato en una empresa aprobada"' : '';
  return `
  <div class="rejilla c2">
    <div class="campo"><label for="nombre_comercial">Nombre comercial<span class="req">*</span></label>
      <input type="text" id="nombre_comercial" name="nombre_comercial" value="${v(e.nombre_comercial)}" maxlength="200" required ${dis('nombre_comercial')}></div>
    <div class="campo"><label for="razon_social">Razón social</label>
      <input type="text" id="razon_social" name="razon_social" value="${v(p.razon_social)}" maxlength="200" ${dis('razon_social')}>
      <span class="ayuda">Si es distinta del nombre comercial.</span></div>
    <div class="campo"><label for="identificacion_fiscal">RUC o identificación fiscal</label>
      <input type="text" id="identificacion_fiscal" name="identificacion_fiscal" value="${v(p.identificacion_fiscal)}" maxlength="60" ${dis('identificacion_fiscal')}>
      <span class="ayuda">Dato privado: solo lo ve el CLRAH para la validación.</span></div>
    <div class="campo"><label for="actividad_principal">Actividad principal</label>
      <input type="text" id="actividad_principal" name="actividad_principal" value="${v(e.actividad_principal)}" maxlength="200"
        placeholder="p. ej. Venta de insumos médicos"></div>
    <div class="campo ancho-total"><label for="descripcion">Descripción de la empresa<span class="req">*</span></label>
      <textarea id="descripcion" name="descripcion" maxlength="2000" rows="4"
        placeholder="Qué hace la empresa, qué tipo de clientes atiende y qué la distingue">${v(e.descripcion)}</textarea></div>
    <div class="campo"><label for="correo">Correo de contacto<span class="req">*</span></label>
      <input type="email" id="correo" name="correo" value="${v(e.correo)}" maxlength="200">
      <span class="ayuda">Se publica en el vitral.</span></div>
    <div class="campo"><label for="telefono">Teléfono<span class="req">*</span></label>
      <input type="tel" id="telefono" name="telefono" value="${v(e.telefono)}" maxlength="120" placeholder="(507) 000-0000"></div>
    <div class="campo"><label for="persona_contacto">Persona de contacto</label>
      <input type="text" id="persona_contacto" name="persona_contacto" value="${v(e.persona_contacto)}" maxlength="200"></div>
    <div class="campo"><label for="sitio_web">Sitio web</label>
      <input type="url" id="sitio_web" name="sitio_web" value="${v(e.sitio_web)}" maxlength="300" placeholder="https://"></div>
    <div class="campo"><label for="camara_frigorifica">Cámara frigorífica</label>
      <select id="camara_frigorifica" name="camara_frigorifica">
        <option value="" ${e.camara_frigorifica == null ? 'selected' : ''}>Sin especificar</option>
        <option value="true" ${e.camara_frigorifica === true ? 'selected' : ''}>Sí cuenta</option>
        <option value="false" ${e.camara_frigorifica === false ? 'selected' : ''}>No cuenta</option>
      </select>
      <span class="ayuda">Capacidad de almacenamiento en frío.</span></div>
  </div>`;
}

export function htmlUbicacion(e = {}) {
  const provs = PROVINCIAS.includes(e.provincia) || !e.provincia ? PROVINCIAS : [e.provincia, ...PROVINCIAS];
  return `
  <div class="rejilla c3">
    <div class="campo"><label for="pais">País</label>
      <input type="text" id="pais" name="pais" value="${v(e.pais || 'Panamá')}" maxlength="80"></div>
    <div class="campo"><label for="provincia">Provincia<span class="req">*</span></label>
      <select id="provincia" name="provincia"><option value="">Seleccione…</option>
        ${provs.map(p => `<option ${p === e.provincia ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
    <div class="campo"><label for="distrito">Distrito o municipio</label>
      <input type="text" id="distrito" name="distrito" value="${v(e.distrito)}" maxlength="120"></div>
    <div class="campo ancho-total"><label for="direccion">Dirección<span class="req">*</span></label>
      <input type="text" id="direccion" name="direccion" value="${v(e.direccion)}" maxlength="400"
        placeholder="Calle, edificio, local, zona"></div>
  </div>
  <div class="mt">
    <div class="flex entre" style="margin-bottom:6px">
      <span class="etq">Ubicación en el mapa</span>
      <span class="texto-chico texto-gris" id="coords">${e.lat != null ? `${e.lat}, ${e.lng}` : 'Sin ubicación marcada'}</span>
    </div>
    <div class="mapa selector" id="selector-mapa" aria-label="Haga clic en el mapa para marcar la ubicación"></div>
    <div class="flex entre mt" style="margin-top:6px">
      <span class="ayuda texto-chico texto-gris">Haga clic en el mapa o arrastre el marcador hasta la ubicación de la empresa.</span>
      <button type="button" class="btn btn-texto btn-sm" id="quitar-ubic">Quitar ubicación</button>
    </div>
    <input type="hidden" name="lat" value="${v(e.lat)}"><input type="hidden" name="lng" value="${v(e.lng)}">
  </div>`;
}

export function htmlCategorias(categorias, seleccion = new Set()) {
  return `<div class="chips-sel" role="group" aria-label="Categorías">${categorias.map(c => `
    <label class="chip-sel"><input type="checkbox" name="categoria" data-grupo="1" value="${esc(c.id)}" ${seleccion.has(c.id) ? 'checked' : ''}>
      ${esc(c.nombre)}${c.activa === false ? ' <span class="texto-gris">(propuesta)</span>' : ''}</label>`).join('')}</div>`;
}

/** Inicializa el mapa selector dentro de form. */
export function activarUbicacion(form, e = {}) {
  const el = form.querySelector('#selector-mapa');
  if (!el || !window.L) return null;
  const sel = selectorUbicacion(el, e.lat ?? null, e.lng ?? null, (la, ln) => {
    form.elements.lat.value = la ?? '';
    form.elements.lng.value = ln ?? '';
    form.querySelector('#coords').textContent = la != null ? `${la}, ${ln}` : 'Sin ubicación marcada';
  });
  form.querySelector('#quitar-ubic').addEventListener('click', () => sel.quitar());
  return sel;
}

export function categoriasMarcadas(form) {
  return [...form.querySelectorAll('input[name=categoria]:checked')].map(i => i.value);
}

/** Valida los campos presentes en el formulario. Devuelve {errores}. */
export function validar(d, { exigirUbicacion = true, exigirCategoria = false, categorias = [] } = {}) {
  const err = {};
  if ('nombre_comercial' in d && (!d.nombre_comercial || d.nombre_comercial.length < 2)) err.nombre_comercial = 'Escriba el nombre comercial.';
  if ('descripcion' in d && !d.descripcion) err.descripcion = 'Describa brevemente la empresa.';
  if ('correo' in d && !correoValido(d.correo)) err.correo = 'Escriba un correo válido.';
  if ('telefono' in d && !d.telefono) err.telefono = 'Escriba un teléfono de contacto.';
  if ('sitio_web' in d && d.sitio_web && !urlSegura(d.sitio_web)) err.sitio_web = 'Escriba una dirección web válida.';
  if (exigirUbicacion && 'provincia' in d && !d.provincia) err.provincia = 'Seleccione la provincia.';
  if (exigirUbicacion && 'direccion' in d && !d.direccion) err.direccion = 'Escriba la dirección.';
  if (exigirCategoria && !categorias.length) err._categorias = 'Seleccione al menos una categoría.';
  return err;
}

/** Separa los datos leídos en campos públicos y privados. */
export function separar(d) {
  const publico = {}, privado = {};
  const privados = ['razon_social', 'identificacion_fiscal'];
  const publicos = ['nombre_comercial', 'descripcion', 'actividad_principal', 'pais', 'provincia', 'distrito', 'direccion',
    'lat', 'lng', 'sitio_web', 'correo', 'telefono', 'persona_contacto', 'camara_frigorifica'];
  for (const k of publicos) if (k in d) publico[k] = d[k];
  for (const k of privados) if (k in d) privado[k] = d[k];
  if ('lat' in publico) publico.lat = publico.lat === null ? null : Number(publico.lat);
  if ('lng' in publico) publico.lng = publico.lng === null ? null : Number(publico.lng);
  if ('camara_frigorifica' in publico) publico.camara_frigorifica = publico.camara_frigorifica === null ? null : publico.camara_frigorifica === 'true';
  if (publico.sitio_web) publico.sitio_web = urlSegura(publico.sitio_web);
  return { publico, privado };
}
