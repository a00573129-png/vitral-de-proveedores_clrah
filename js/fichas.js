/* =====================================================================
   fichas.js — Piezas visuales compartidas entre páginas
   (monograma/logo, estado de registro, inventario en tabla o tarjetas)
   ===================================================================== */
import { esc, iniciales, urlLogo, badge, numero, fecha, DISPONIBILIDAD } from './comun.js';

export function badgeRegistro(e) {
  return e.cuenta_activa
    ? '<span class="badge b-exito" title="La empresa administra su propia información en el Vitral">Proveedor registrado</span>'
    : '<span class="badge b-neutro" title="Ficha elaborada por el CLRAH; la empresa aún no ha activado su cuenta">Ficha de referencia</span>';
}

export function monograma(e, grande = false) {
  const logo = urlLogo(e.logo_path);
  return `<div class="monograma ${grande ? 'grande' : ''}" aria-hidden="true">${
    logo ? `<img src="${esc(logo)}" alt="">` : esc(iniciales(e.nombre_comercial))}</div>`;
}

export function listaSpecs(specs) {
  if (!Array.isArray(specs) || !specs.length) return '';
  return `<ul class="specs">${specs.filter(s => s && (s.clave || s.valor))
    .map(s => `<li><b>${esc(s.clave || 'Dato')}:</b> ${esc(s.valor || '—')}</li>`).join('')}</ul>`;
}

/**
 * Tabla de inventario. opciones.acciones(p) devuelve HTML de botones por fila
 * (solo en el panel privado). nombresCat: Map id → nombre.
 */
export function tablaInventario(items, nombresCat, opciones = {}) {
  const acc = opciones.acciones;
  return `
  <div class="tabla-cont alto">
    <table class="tabla">
      <thead><tr>
        <th>Producto o servicio</th><th>Tipo</th><th>Categoría</th><th>Especificaciones</th>
        <th>Presentación / unidad</th><th>Disponibilidad</th><th class="num">Existencia</th>
        <th>Capacidad de suministro</th><th>Actualizado</th>${acc ? '<th class="acc">Acciones</th>' : ''}
      </tr></thead>
      <tbody>${items.map(p => `
        <tr>
          <td style="min-width:220px"><div class="principal">${esc(p.nombre)}</div>
            ${p.descripcion ? `<div class="secundario">${esc(p.descripcion)}</div>` : ''}
            ${p.informacion_adicional ? `<div class="secundario">${esc(p.informacion_adicional)}</div>` : ''}
            ${p.activo === false ? '<span class="badge b-neutro">Oculto al público</span>' : ''}</td>
          <td>${p.tipo === 'servicio' ? 'Servicio' : 'Producto'}</td>
          <td>${esc(nombresCat.get(p.categoria_id) || '—')}</td>
          <td style="min-width:160px">${listaSpecs(p.especificaciones) || '<span class="texto-gris">—</span>'}</td>
          <td>${esc([p.presentacion, p.unidad_medida].filter(Boolean).join(' · ') || '—')}</td>
          <td>${badge(DISPONIBILIDAD, p.disponibilidad)}</td>
          <td class="num">${p.existencia != null ? numero(p.existencia) + (p.unidad_medida ? ` <span class="secundario">${esc(p.unidad_medida)}</span>` : '') : '—'}</td>
          <td>${esc(p.capacidad_suministro || '—')}</td>
          <td class="secundario" style="white-space:nowrap">${fecha(p.actualizado_en)}</td>
          ${acc ? `<td class="acc">${acc(p)}</td>` : ''}
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

export function tarjetasInventario(items, nombresCat, opciones = {}) {
  const acc = opciones.acciones;
  return `<div class="inv-tarjetas">${items.map(p => `
    <article class="inv-item">
      <div class="flex entre" style="align-items:flex-start">
        <h3 class="crece">${esc(p.nombre)}</h3>
        ${badge(DISPONIBILIDAD, p.disponibilidad)}
      </div>
      <div class="flex" style="gap:5px">
        <span class="etiqueta">${p.tipo === 'servicio' ? 'Servicio' : 'Producto'}</span>
        ${nombresCat.get(p.categoria_id) ? `<span class="etiqueta azul">${esc(nombresCat.get(p.categoria_id))}</span>` : ''}
      </div>
      ${p.descripcion ? `<p class="d">${esc(p.descripcion)}</p>` : ''}
      ${listaSpecs(p.especificaciones)}
      <div class="inv-datos">
        ${p.existencia != null ? `<span>Existencia: <strong>${numero(p.existencia)} ${esc(p.unidad_medida || '')}</strong></span>` : ''}
        ${p.presentacion ? `<span>Presentación: <strong>${esc(p.presentacion)}</strong></span>` : ''}
        ${p.capacidad_suministro ? `<span>Capacidad: <strong>${esc(p.capacidad_suministro)}</strong></span>` : ''}
        <span>Actualizado: ${fecha(p.actualizado_en)}</span>
      </div>
      ${p.informacion_adicional ? `<p class="d texto-gris">${esc(p.informacion_adicional)}</p>` : ''}
      ${acc ? `<div class="acciones der">${acc(p)}</div>` : ''}
    </article>`).join('')}</div>`;
}
