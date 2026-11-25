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

  <div class="ubic-coords mt">
    <div class="seccion-titulo">Coordenadas para el mapa</div>
    <div class="rejilla c3" style="align-items:end">
      <div class="campo"><label for="lat">Latitud</label>
        <input type="text" id="lat" name="lat" inputmode="decimal" value="${v(e.lat)}" placeholder="p. ej. 9.3548" autocomplete="off"></div>
      <div class="campo"><label for="lng">Longitud</label>
        <input type="text" id="lng" name="lng" inputmode="decimal" value="${v(e.lng)}" placeholder="p. ej. -79.8994" autocomplete="off"></div>
      <div class="acciones">
        <button type="button" class="btn btn-sec" id="buscar-dir">Ubicar mi dirección</button>
        <button type="button" class="btn btn-texto btn-sm" id="quitar-ubic">Quitar</button>
      </div>
    </div>
    <p class="ayuda texto-chico texto-gris" style="margin-top:6px">
      Tres formas de ubicar la empresa: escriba la latitud y la longitud; pegue en "Latitud" las coordenadas copiadas de
      Google Maps (clic derecho sobre el lugar → copiar las coordenadas, p. ej. <i>9.3548, -79.8994</i>);
      o haga clic en el mapa y arrastre el marcador. "Ubicar mi dirección" busca la dirección escrita arriba como aproximación.</p>
    <p class="texto-chico" id="msg-ubic" role="status" aria-live="polite"></p>
    <div class="mapa selector" id="selector-mapa" aria-label="Mapa: haga clic para marcar la ubicación"></div>
  </div>`;
}

/**
 * Selector de categorías: lista desplegable con las categorías existentes
 * + opción "Otra categoría" para escribir una nueva.
 * Las elegidas se muestran como etiquetas que se pueden quitar.
 */
export function htmlCategorias(categorias, seleccion = new Set(), { permitirNueva = true } = {}) {
  const elegidas = categorias.filter(c => seleccion.has(c.id));
  return `
  <div class="cat-selector" data-cat-selector>
    <div class="cat-elegidas" aria-live="polite">${elegidas.map(etiquetaCat).join('')}</div>
    <p class="texto-chico texto-gris cat-ninguna" ${elegidas.length ? 'hidden' : ''}>Aún no ha elegido categorías.</p>
    <div class="flex mt" style="margin-top:8px">
      <label class="sr-only" for="cat-lista">Agregar una categoría</label>
      <select id="cat-lista" class="cat-lista" style="max-width:380px">
        ${opcionesCat(categorias, seleccion, permitirNueva)}
      </select>
    </div>
    <div class="cat-nueva flex mt" style="margin-top:8px" hidden>
      <label class="sr-only" for="cat-nueva-nombre">Nombre de la nueva categoría</label>
      <input type="text" id="cat-nueva-nombre" maxlength="80" placeholder="Escriba la nueva categoría" style="max-width:300px">
      <button type="button" class="btn btn-primario btn-sm" data-cat-crear>Agregar</button>
      <button type="button" class="btn btn-texto btn-sm" data-cat-cancelar>Cancelar</button>
    </div>
  </div>`;
}

function etiquetaCat(c) {
  return `<span class="cat-etiqueta" data-id="${esc(c.id)}">
    <input type="checkbox" name="categoria" data-grupo="1" value="${esc(c.id)}" checked hidden>
    ${esc(c.nombre)}${c.activa === false ? ' <span class="texto-gris">(pendiente)</span>' : ''}
    <button type="button" class="cat-quitar" aria-label="Quitar ${esc(c.nombre)}">&times;</button></span>`;
}

function opcionesCat(categorias, seleccion, permitirNueva) {
  const libres = categorias.filter(c => !seleccion.has(c.id)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return `<option value="">${libres.length ? 'Seleccione una categoría para agregarla…' : 'No hay más categorías en la lista'}</option>
    ${libres.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}${c.activa === false ? ' (pendiente)' : ''}</option>`).join('')}
    ${permitirNueva ? '<option value="__nueva">+ Otra categoría (escribir una nueva)…</option>' : ''}`;
}

/**
 * Activa el selector de categorías dentro de raiz.
 * crearCategoria(nombre) → Promise<{id, nombre, activa}> (llama a la base de datos)
 * alCambiar() se invoca cada vez que cambia la selección.
 */
export function activarCategorias(raiz, categorias, { permitirNueva = true, crearCategoria, alCambiar } = {}) {
  const cont = raiz.querySelector('[data-cat-selector]');
  if (!cont) return;
  const lista = cont.querySelector('.cat-lista');
  const nueva = cont.querySelector('.cat-nueva');
  const input = cont.querySelector('#cat-nueva-nombre');
  const elegidas = () => new Set([...cont.querySelectorAll('.cat-etiqueta')].map(e => e.dataset.id));
  const refrescar = () => {
    lista.innerHTML = opcionesCat(categorias, elegidas(), permitirNueva);
    cont.querySelector('.cat-ninguna').hidden = elegidas().size > 0;
    alCambiar?.();
  };
  const agregar = c => {
    if (!categorias.some(x => x.id === c.id)) categorias.push(c);
    if (!elegidas().has(c.id)) cont.querySelector('.cat-elegidas').insertAdjacentHTML('beforeend', etiquetaCat(c));
    refrescar();
  };
  lista.addEventListener('change', () => {
    if (lista.value === '__nueva') { nueva.hidden = false; input.focus(); lista.value = ''; return; }
    const c = categorias.find(x => x.id === lista.value);
    if (c) agregar(c);
  });
  cont.addEventListener('click', async ev => {
    if (ev.target.matches('.cat-quitar')) { ev.target.closest('.cat-etiqueta').remove(); refrescar(); return; }
    if (ev.target.matches('[data-cat-cancelar]')) { nueva.hidden = true; input.value = ''; return; }
    if (ev.target.matches('[data-cat-crear]')) {
      const nombre = input.value.trim();
      if (nombre.length < 2) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      const existente = categorias.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      try {
        ev.target.classList.add('cargando'); ev.target.disabled = true;
        const c = existente || await crearCategoria(nombre);
        agregar(c);
        input.value = ''; input.removeAttribute('aria-invalid'); nueva.hidden = true;
      } catch (e) {
        input.setAttribute('aria-invalid', 'true');
        cont.querySelector('.cat-nueva').insertAdjacentHTML('afterend', `<p class="error-campo cat-error">${esc(e.message || e)}</p>`);
        setTimeout(() => cont.querySelector('.cat-error')?.remove(), 6000);
      } finally { ev.target.classList.remove('cargando'); ev.target.disabled = false; }
    }
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); cont.querySelector('[data-cat-crear]').click(); }
  });
}

/** Convierte "9.35, -79.89" o "9,35" en números; devuelve null si no es válido. */
function numeroCoord(t) {
  if (t === null || t === undefined || String(t).trim() === '') return null;
  const n = Number(String(t).trim().replace(/\s/g, '').replace(/,(?=\d+$)/, '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Inicializa coordenadas + mapa dentro de form. */
export function activarUbicacion(form, e = {}) {
  const fLat = form.elements.lat, fLng = form.elements.lng;
  const msg = form.querySelector('#msg-ubic');
  const aviso = (t, tipo = '') => { if (msg) { msg.textContent = t; msg.style.color = tipo === 'error' ? 'var(--error-text)' : 'var(--gris)'; } };
  let sel = null;
  if (window.L && form.querySelector('#selector-mapa')) {
    sel = selectorUbicacion(form.querySelector('#selector-mapa'), e.lat ?? null, e.lng ?? null, (la, ln) => {
      fLat.value = la ?? '';
      fLng.value = ln ?? '';
    });
  }
  const desdeCampos = () => {
    // Coordenadas pegadas juntas en "Latitud": "9.3548, -79.8994"
    const par = fLat.value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (par) { fLat.value = par[1]; fLng.value = par[2]; }
    const la = numeroCoord(fLat.value), ln = numeroCoord(fLng.value);
    if (la === null || ln === null) return;
    if (Number.isNaN(la) || Number.isNaN(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
      aviso('Revise las coordenadas: la latitud va de -90 a 90 y la longitud de -180 a 180.', 'error'); return;
    }
    aviso(la > 0 && ln > 0 && (form.elements.pais?.value || '').toLowerCase().includes('pan')
      ? 'Atención: en Panamá la longitud es negativa (p. ej. -79.89).' : '');
    sel?.fijar(la, ln, true);
  };
  fLat.addEventListener('change', desdeCampos);
  fLng.addEventListener('change', desdeCampos);
  fLat.addEventListener('paste', () => setTimeout(desdeCampos, 0));
  form.querySelector('#quitar-ubic')?.addEventListener('click', () => { sel?.quitar(); fLat.value = ''; fLng.value = ''; aviso(''); });
  form.querySelector('#buscar-dir')?.addEventListener('click', async ev => {
    const partes = ['direccion', 'distrito', 'provincia', 'pais'].map(n => form.elements[n]?.value.trim()).filter(Boolean);
    if (!form.elements.direccion?.value.trim()) { aviso('Escriba primero la dirección.', 'error'); return; }
    const b = ev.target; b.classList.add('cargando'); b.disabled = true;
    try {
      const pais = (form.elements.pais?.value || '').toLowerCase();
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es'
        + (pais.includes('pan') ? '&countrycodes=pa' : '') + '&q=' + encodeURIComponent(partes.join(', '));
      let r = await (await fetch(url)).json();
      if (!r.length && partes.length > 2) {   // reintenta solo con distrito/provincia/país
        r = await (await fetch(url.replace(/&q=.*/, '&q=' + encodeURIComponent(partes.slice(1).join(', '))))).json();
        if (r.length) aviso('No se encontró la dirección exacta; se ubicó la zona. Ajuste el marcador al punto correcto.');
      } else if (r.length) aviso('Ubicación aproximada encontrada. Verifique y arrastre el marcador si hace falta.');
      if (!r.length) { aviso('No se encontró la dirección. Marque el punto en el mapa o pegue las coordenadas de Google Maps.', 'error'); return; }
      sel?.fijar(Number(r[0].lat), Number(r[0].lon), true);
    } catch {
      aviso('No fue posible consultar el buscador de direcciones. Marque el punto en el mapa o escriba las coordenadas.', 'error');
    } finally { b.classList.remove('cargando'); b.disabled = false; }
  });
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
  if ('lat' in d || 'lng' in d) {
    const la = d.lat === null ? null : Number(String(d.lat).replace(',', '.'));
    const ln = d.lng === null ? null : Number(String(d.lng).replace(',', '.'));
    if ((la === null) !== (ln === null)) err[la === null ? 'lat' : 'lng'] = 'Escriba latitud y longitud, o deje ambas vacías.';
    else if (la !== null && (!Number.isFinite(la) || la < -90 || la > 90)) err.lat = 'Latitud no válida (de -90 a 90).';
    else if (ln !== null && (!Number.isFinite(ln) || ln < -180 || ln > 180)) err.lng = 'Longitud no válida (de -180 a 180).';
  }
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
  if ('lat' in publico) publico.lat = publico.lat === null ? null : Number(String(publico.lat).replace(',', '.'));
  if ('lng' in publico) publico.lng = publico.lng === null ? null : Number(String(publico.lng).replace(',', '.'));
  if ('camara_frigorifica' in publico) publico.camara_frigorifica = publico.camara_frigorifica === null ? null : publico.camara_frigorifica === 'true';
  if (publico.sitio_web) publico.sitio_web = urlSegura(publico.sitio_web);
  return { publico, privado };
}
