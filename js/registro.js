/* =====================================================================
   registro.js — Alta de cuenta y de empresa (pasos 1 a 3).
   Los pasos 4 a 6 (inventario, certificaciones y envío) se completan en
   el panel del proveedor, donde también se pueden corregir después.
   ===================================================================== */
import {
  sb, configurado, config, $, esc, mensajeError, pintarHeader, pie, conCarga, leerForm, marcarErrores,
  correoValido, cargarPerfil, avisoSinConfiguracion, toast, cerrarSesion
} from './comun.js';
import { htmlDatosGenerales, htmlUbicacion, htmlCategorias, activarUbicacion, categoriasMarcadas, validar, separar } from './form-empresa.js';

const cont = $('#contenido');
const datos = {};   // acumulado de los pasos 2 y 3
let categorias = [];

init();

function marcarPaso(n) {
  document.querySelectorAll('#pasos li').forEach(li => {
    const p = Number(li.dataset.paso);
    li.classList.toggle('hecho', p < n);
    li.classList.toggle('actual', p === n);
    if (p === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function init() {
  pie();
  pintarHeader({ subtitulo: 'Registro de proveedores', acciones: '<a class="btn btn-hdr" href="index.html">Ver el vitral</a>' });
  if (!configurado) { avisoSinConfiguracion($('#aviso')); cont.innerHTML = ''; return; }

  const r = await cargarPerfil().catch(() => null);
  if (!r) return pasoCuenta();

  pintarHeader({ subtitulo: 'Registro de proveedores',
    acciones: `<span class="hdr-usuario">${esc(r.usuario.email)}</span><button class="btn btn-hdr" id="salir">Cerrar sesión</button>` });
  $('#salir').addEventListener('click', cerrarSesion);

  if (r.perfil?.rol === 'admin') { location.href = 'admin.html'; return; }
  if (r.perfil?.empresa_id) { location.href = 'panel.html'; return; }
  const solicitada = r.usuario.user_metadata?.solicita_empresa;
  if (solicitada) return pasoVinculo(solicitada);

  const { data, error } = await sb.from('categorias').select('id, nombre, activa').eq('activa', true).order('orden').order('nombre');
  if (error) { cont.innerHTML = `<div class="alerta error">${esc(mensajeError(error))}</div>`; return; }
  categorias = data;
  pasoEmpresa();
}

/* Paso 1 ----------------------------------------------------------------- */
async function pasoCuenta() {
  marcarPaso(1);
  const { data: existentes } = await sb.from('vitral_empresas').select('id, nombre_comercial, cuenta_activa').order('nombre_comercial');
  const sinCuenta = (existentes || []).filter(e => !e.cuenta_activa);
  cont.innerHTML = `
  <section class="card">
    <div class="card-cab"><div>
      <div class="card-titulo">Paso 1 · Cree su cuenta de acceso</div>
      <div class="card-sub">Con esta cuenta podrá guardar su avance, administrar su inventario y consultar el estado de su solicitud.</div>
    </div></div>
    <div id="msg"></div>
    <form id="f-cuenta" class="rejilla c2" novalidate>
      <div class="campo ancho-total"><span class="etq">Tipo de registro</span>
        <div class="chips-sel">
          <label class="chip-sel"><input type="radio" name="tipo" value="nueva" checked> Mi empresa no aparece en el vitral</label>
          <label class="chip-sel"><input type="radio" name="tipo" value="vincular" ${sinCuenta.length ? '' : 'disabled'}> Mi empresa ya aparece como ficha de referencia</label>
        </div>
      </div>
      <div class="campo ancho-total" id="c-existente" hidden><label for="solicita_empresa">Empresa que representa<span class="req">*</span></label>
        <select id="solicita_empresa" name="solicita_empresa"><option value="">Seleccione…</option>
          ${sinCuenta.map(e => `<option value="${esc(e.id)}">${esc(e.nombre_comercial)}</option>`).join('')}</select>
        <span class="ayuda">El CLRAH verificará que usted representa a la empresa antes de darle acceso a su ficha.</span></div>
      <div class="campo ancho-total"><label for="nombre">Nombre de la persona responsable<span class="req">*</span></label>
        <input type="text" id="nombre" name="nombre" autocomplete="name" maxlength="150"></div>
      <div class="campo ancho-total"><label for="correo_cuenta">Correo electrónico de acceso<span class="req">*</span></label>
        <input type="email" id="correo_cuenta" name="correo_cuenta" autocomplete="email" maxlength="200">
        <span class="ayuda">Se usará para iniciar sesión y recibir avisos. No se publica.</span></div>
      <div class="campo"><label for="clave">Contraseña<span class="req">*</span></label>
        <input type="password" id="clave" name="clave" autocomplete="new-password" minlength="8">
        <span class="ayuda">Mínimo 8 caracteres. Combine letras y números.</span></div>
      <div class="campo"><label for="clave2">Confirmar contraseña<span class="req">*</span></label>
        <input type="password" id="clave2" name="clave2" autocomplete="new-password"></div>
      <label class="check ancho-total"><input type="checkbox" name="acepto"> Confirmo que la información que registraré es verídica y que estoy autorizado para representar a la empresa.</label>
      <div class="acciones der ancho-total">
        <a class="btn btn-sec" href="acceso.html">Ya tengo cuenta</a>
        <button type="submit" class="btn btn-primario">Crear cuenta y continuar</button>
      </div>
    </form>
  </section>`;
  const f = $('#f-cuenta');
  f.addEventListener('change', () => { $('#c-existente').hidden = f.tipo.value !== 'vincular'; });
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const d = leerForm(f);
    const err = {};
    if (!d.nombre) err.nombre = 'Escriba su nombre.';
    if (!correoValido(d.correo_cuenta)) err.correo_cuenta = 'Escriba un correo válido.';
    if (!d.clave || d.clave.length < 8) err.clave = 'Mínimo 8 caracteres.';
    else if (d.clave !== d.clave2) err.clave2 = 'Las contraseñas no coinciden.';
    if (f.tipo.value === 'vincular' && !d.solicita_empresa) err.solicita_empresa = 'Seleccione la empresa.';
    if (!f.acepto.checked) err.acepto = 'Debe confirmar para continuar.';
    if (!marcarErrores(f, err)) return;
    await conCarga(f.querySelector('[type=submit]'), async () => {
      const meta = { nombre: d.nombre };
      if (f.tipo.value === 'vincular') meta.solicita_empresa = d.solicita_empresa;
      const { data, error } = await sb.auth.signUp({
        email: d.correo_cuenta, password: d.clave,
        options: { data: meta, emailRedirectTo: new URL('registro.html', location.href).href }
      });
      if (error) { $('#msg').innerHTML = `<div class="alerta error">${esc(mensajeError(error))}</div>`; return; }
      if (!data.session) {
        cont.innerHTML = `<section class="card"><div class="alerta info mb0"><strong>Revise su correo</strong>
          Enviamos un enlace de confirmación a <b>${esc(d.correo_cuenta)}</b>. Al abrirlo regresará a esta página para continuar el registro.
          Si no lo encuentra, revise la carpeta de spam.</div></section>`;
        return;
      }
      location.reload();
    });
  });
}

/* Solicitud de vinculación con una ficha existente ---------------------- */
async function pasoVinculo(empresaId) {
  marcarPaso(1);
  const { data } = await sb.from('vitral_empresas').select('nombre_comercial').eq('id', empresaId).maybeSingle();
  cont.innerHTML = `
  <section class="card">
    <div class="card-titulo">Solicitud de vinculación enviada</div>
    <p class="mt" style="font-size:13px;color:var(--text2)">Su cuenta fue creada y solicitó administrar la ficha de
      <b>${esc(data?.nombre_comercial || 'la empresa seleccionada')}</b>. El CLRAH verificará su representación y le dará acceso.
      Cuando eso ocurra, al iniciar sesión entrará directamente al panel de su empresa.</p>
    <p class="mt texto-chico texto-gris">Para agilizar la verificación puede escribir a
      <a href="mailto:${esc(config.correoContacto)}">${esc(config.correoContacto)}</a> desde un correo de la empresa.</p>
    <div class="acciones mt">
      <a class="btn btn-sec" href="index.html">Volver al vitral</a>
      <button class="btn btn-texto" id="cambiar">Mejor registrar una empresa nueva</button>
    </div>
  </section>`;
  $('#cambiar').addEventListener('click', async () => {
    await sb.auth.updateUser({ data: { solicita_empresa: null } });
    location.reload();
  });
}

/* Paso 2 ----------------------------------------------------------------- */
function pasoEmpresa() {
  marcarPaso(2);
  cont.innerHTML = `
  <section class="card">
    <div class="card-cab"><div>
      <div class="card-titulo">Paso 2 · Datos de la empresa u organización</div>
      <div class="card-sub">Los campos con <span style="color:var(--rojo)">*</span> son obligatorios.</div>
    </div></div>
    <form id="f-empresa" novalidate>
      ${htmlDatosGenerales(datos, datos)}
      <div class="acciones der mt"><button type="submit" class="btn btn-primario">Continuar</button></div>
    </form>
  </section>`;
  const f = $('#f-empresa');
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const d = leerForm(f);
    if (!marcarErrores(f, validar(d, { exigirUbicacion: false }))) return;
    Object.assign(datos, d);
    pasoUbicacion();
  });
}

/* Paso 3 ----------------------------------------------------------------- */
function pasoUbicacion() {
  marcarPaso(3);
  cont.innerHTML = `
  <section class="card">
    <div class="card-cab"><div>
      <div class="card-titulo">Paso 3 · Ubicación y categorías</div>
      <div class="card-sub">La ubicación permite a los usuarios encontrar a su empresa en el mapa del vitral.</div>
    </div></div>
    <div id="msg"></div>
    <form id="f-ubic" novalidate>
      ${htmlUbicacion(datos)}
      <div class="mt">
        <div class="seccion-titulo" style="margin-top:8px">Categorías de productos y servicios<span style="color:var(--rojo)">*</span></div>
        ${htmlCategorias(categorias, new Set(datos.categorias || []))}
        <p class="ayuda texto-chico texto-gris mt" style="margin-top:6px">Si su categoría no aparece podrá proponerla al CLRAH desde su panel.</p>
        <p class="error-campo" id="err-cat" hidden></p>
      </div>
      <div class="acciones der mt">
        <button type="button" class="btn btn-sec" id="atras">Atrás</button>
        <button type="submit" class="btn btn-primario">Guardar y continuar</button>
      </div>
    </form>
  </section>`;
  const f = $('#f-ubic');
  activarUbicacion(f, { lat: datos.lat != null ? Number(datos.lat) : null, lng: datos.lng != null ? Number(datos.lng) : null });
  $('#atras').addEventListener('click', () => { Object.assign(datos, leerForm(f), { categorias: categoriasMarcadas(f) }); pasoEmpresa(); });
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const d = leerForm(f);
    const cats = categoriasMarcadas(f);
    const err = validar(d, { exigirCategoria: true, categorias: cats });
    $('#err-cat').hidden = !err._categorias;
    $('#err-cat').textContent = err._categorias || '';
    delete err._categorias;
    if (!marcarErrores(f, err) || !cats.length) return;
    Object.assign(datos, d, { categorias: cats });
    await conCarga(f.querySelector('[type=submit]'), async () => {
      const { publico, privado } = separar(datos);
      const { error } = await sb.rpc('registrar_empresa', { p: { ...publico, ...privado, categorias: cats } });
      if (error) { $('#msg').innerHTML = `<div class="alerta error">${esc(mensajeError(error))}</div>`; return; }
      toast('Empresa guardada como borrador. Continúe con su inventario.', 'exito');
      location.href = 'panel.html?nuevo=1#inventario';
    });
  });
}
