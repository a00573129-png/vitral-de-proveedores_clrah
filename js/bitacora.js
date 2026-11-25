/* =====================================================================
   bitacora.js — Presentación legible del historial de cambios
   ===================================================================== */
import { esc, fecha, ESTADOS } from './comun.js';

const TABLAS = {
  empresas: 'Perfil de empresa', empresas_privado: 'Datos fiscales', productos: 'Inventario',
  certificaciones_empresa: 'Certificación', empresa_categorias: 'Categorías', perfiles: 'Cuenta'
};
const ACCIONES = { INSERT: 'Alta', UPDATE: 'Modificación', DELETE: 'Eliminación', ESTADO: 'Cambio de estado' };
const CAMPOS = {
  nombre: 'nombre', nombre_comercial: 'nombre comercial', descripcion: 'descripción', disponibilidad: 'disponibilidad',
  existencia: 'existencia', unidad_medida: 'unidad', capacidad_suministro: 'capacidad de suministro', presentacion: 'presentación',
  especificaciones: 'especificaciones', categoria_id: 'categoría', activo: 'visibilidad', tipo: 'tipo', estado: 'estado',
  telefono: 'teléfono', correo: 'correo', direccion: 'dirección', provincia: 'provincia', lat: 'latitud', lng: 'longitud',
  sitio_web: 'sitio web', persona_contacto: 'contacto', logo_path: 'logo', vigencia_hasta: 'vigencia', documento_path: 'documento',
  organismo: 'organismo', rol: 'rol', empresa_id: 'empresa', informacion_adicional: 'información adicional',
  identificacion_fiscal: 'RUC', razon_social: 'razón social', camara_frigorifica: 'cámara frigorífica', actividad_principal: 'actividad'
};
const IGNORAR = new Set(['actualizado_en', 'actualizado_por', 'creado_en', 'revisado_en', 'revisado_por', 'enviada_en', 'aprobada_en']);

const corto = v => {
  if (v === null || v === undefined || v === '') return '—';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
};

export function sujeto(r) {
  const d = r.datos_despues || r.datos_antes || {};
  return d.nombre || d.nombre_comercial || (r.tabla === 'empresa_categorias' ? 'Categoría asignada' : '');
}

export function diferencias(r) {
  if (r.accion !== 'UPDATE' && r.accion !== 'ESTADO') return '';
  const a = r.datos_antes || {}, b = r.datos_despues || {};
  const cambios = Object.keys(b).filter(k => !IGNORAR.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (!cambios.length) return '';
  return `<ul class="dif">${cambios.slice(0, 6).map(k => {
    const fmt = v => k === 'estado' ? (ESTADOS[v]?.txt || v) : corto(v);
    return `<li>${esc(CAMPOS[k] || k)}: <del>${esc(fmt(a[k]))}</del> → <ins>${esc(fmt(b[k]))}</ins></li>`;
  }).join('')}${cambios.length > 6 ? `<li>y ${cambios.length - 6} campos más</li>` : ''}</ul>`;
}

export function filaBitacora(r, { conEmpresa = false, nombreEmpresa = '' } = {}) {
  return `<tr>
    <td style="white-space:nowrap">${fecha(r.creado_en, true)}</td>
    ${conEmpresa ? `<td>${esc(nombreEmpresa || '—')}</td>` : ''}
    <td>${esc(r.usuario_correo || (r.usuario ? 'Usuario ' + String(r.usuario).slice(0, 8) : 'Sistema / carga inicial'))}</td>
    <td>${esc(TABLAS[r.tabla] || r.tabla)}</td>
    <td>${esc(ACCIONES[r.accion] || r.accion)}</td>
    <td style="min-width:240px"><div class="principal">${esc(sujeto(r))}</div>${diferencias(r)}</td>
  </tr>`;
}

export const CABECERA_BITACORA = conEmpresa => `<thead><tr><th>Fecha</th>${conEmpresa ? '<th>Empresa</th>' : ''}<th>Usuario</th><th>Sección</th><th>Acción</th><th>Detalle</th></tr></thead>`;
