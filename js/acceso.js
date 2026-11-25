/* =====================================================================
   acceso.js — Inicio de sesión, recuperación y cambio de contraseña.
   La verificación de la contraseña la hace Supabase Auth (bcrypt en el
   servidor); el navegador nunca guarda ni compara contraseñas.
   ===================================================================== */
import { sb, configurado, $, $$, esc, mensajeError, pintarHeader, conCarga, correoValido, marcarErrores, parametro } from './comun.js';

pintarHeader({ subtitulo: 'Acceso de proveedores', acciones: '<a class="btn btn-hdr" href="index.html">Ver el vitral</a>' });

const alerta = (id, tipo, html) => { $(id).innerHTML = html ? `<div class="alerta ${tipo}">${html}</div>` : ''; };

function modo(m) {
  $$('[data-modo]').forEach(s => { s.hidden = s.dataset.modo !== m; });
  $(`[data-modo="${m}"] input`)?.focus();
}
$$('[data-ir]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); modo(a.dataset.ir); }));

if (!configurado) {
  alerta('#msg-entrar', 'aviso', '<strong>Configuración pendiente</strong>El sistema aún no está conectado a su base de datos.');
  $$('form button').forEach(b => { b.disabled = true; });
} else {
  if (parametro('inactiva')) alerta('#msg-entrar', 'error', 'Su cuenta está desactivada. Comuníquese con el CLRAH.');
  if (parametro('confirmado')) alerta('#msg-entrar', 'exito', 'Correo confirmado. Ya puede iniciar sesión.');

  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') modo('nueva'); });
  if (parametro('modo') === 'nueva' || /type=recovery/.test(location.hash)) modo('nueva');
  else sb.auth.getSession().then(({ data }) => { if (data.session) redirigir(); });
}

async function redirigir() {
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return;
  const { data: p } = await sb.from('perfiles').select('rol, empresa_id, activo').eq('id', s.session.user.id).maybeSingle();
  if (!p || !p.activo) {
    await sb.auth.signOut();
    alerta('#msg-entrar', 'error', 'Su cuenta está desactivada. Comuníquese con el CLRAH.');
    return;
  }
  const volver = parametro('volver');
  if (volver && /^[\w.-]+\.html(\?[\w=&%.-]*)?$/.test(volver)) { location.href = volver; return; }
  location.href = p.rol === 'admin' ? 'admin.html' : (p.empresa_id ? 'panel.html' : 'registro.html');
}

$('#f-entrar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target, correo = f.correo.value.trim(), clave = f.clave.value;
  const err = {};
  if (!correoValido(correo)) err.correo = 'Escriba un correo válido.';
  if (!clave) err.clave = 'Escriba su contraseña.';
  if (!marcarErrores(f, err)) return;
  alerta('#msg-entrar');
  await conCarga(f.querySelector('button'), async () => {
    const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
    if (error) { alerta('#msg-entrar', 'error', esc(mensajeError(error))); return; }
    await redirigir();
  });
});

$('#f-recuperar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target, correo = f.correo.value.trim();
  if (!marcarErrores(f, correoValido(correo) ? {} : { correo: 'Escriba un correo válido.' })) return;
  await conCarga(f.querySelector('button'), async () => {
    const destino = new URL('acceso.html?modo=nueva', location.href).href;
    const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: destino });
    // Por seguridad se muestra el mismo mensaje exista o no la cuenta
    if (error && !/rate limit/i.test(error.message)) console.warn(error);
    alerta('#msg-recuperar', error && /rate limit/i.test(error.message) ? 'error' : 'exito',
      error && /rate limit/i.test(error.message) ? esc(mensajeError(error))
        : 'Si existe una cuenta con ese correo, recibirá un enlace en unos minutos. Revise también la carpeta de spam.');
  });
});

$('#f-nueva').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target;
  const err = {};
  if (f.clave.value.length < 8) err.clave = 'Mínimo 8 caracteres.';
  else if (f.clave.value !== f.clave2.value) err.clave2 = 'Las contraseñas no coinciden.';
  if (!marcarErrores(f, err)) return;
  await conCarga(f.querySelector('button'), async () => {
    const { error } = await sb.auth.updateUser({ password: f.clave.value });
    if (error) { alerta('#msg-nueva', 'error', esc(mensajeError(error)) + '<br>Si el enlace expiró, solicite uno nuevo.'); return; }
    alerta('#msg-nueva', 'exito', 'Contraseña actualizada. Redirigiendo…');
    setTimeout(redirigir, 1200);
  });
});
