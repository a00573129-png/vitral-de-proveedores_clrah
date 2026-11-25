/* =====================================================================
   mapa.js — Mapas con Leaflet (directorio, perfil y selector de ubicación)
   ===================================================================== */
import { config, esc } from './comun.js';

const L = window.L;
if (L) L.Icon.Default.imagePath = new URL('./vendor/leaflet/images/', import.meta.url).href;

function base(el, opciones = {}) {
  const m = L.map(el, { scrollWheelZoom: false, ...opciones })
    .setView(config.mapa.centro, config.mapa.zoom);
  L.tileLayer(config.mapa.teselas, { maxZoom: 18, attribution: config.mapa.atribucion }).addTo(m);
  m.on('focus', () => m.scrollWheelZoom.enable());
  m.on('blur', () => m.scrollWheelZoom.disable());
  return m;
}

/** Mapa del directorio. Devuelve { pintar(lista, alClic), resaltar(id), invalidar() } */
export function mapaDirectorio(el) {
  const m = base(el);
  const capa = L.layerGroup().addTo(m);
  const marcadores = new Map();
  return {
    pintar(lista, alClic) {
      capa.clearLayers();
      marcadores.clear();
      const pts = [];
      for (const e of lista) {
        if (e.lat == null || e.lng == null) continue;
        const mk = L.circleMarker([e.lat, e.lng], {
          radius: 8, color: '#FFFFFF', weight: 2, fillColor: '#1A57B4', fillOpacity: 1
        }).addTo(capa);
        mk.bindTooltip(esc(e.nombre_comercial), { direction: 'top', offset: [0, -6] });
        mk.on('click', () => alClic?.(e));
        marcadores.set(e.id, mk);
        pts.push([e.lat, e.lng]);
      }
      if (pts.length === 1) m.setView(pts[0], 13);
      else if (pts.length > 1) m.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
      return pts.length;
    },
    resaltar(id) {
      marcadores.forEach((mk, k) => mk.setStyle({ fillColor: k === id ? '#F90525' : '#1A57B4', radius: k === id ? 10 : 8 }));
      const mk = marcadores.get(id);
      if (mk) m.panTo(mk.getLatLng());
    },
    invalidar() { setTimeout(() => m.invalidateSize(), 50); }
  };
}

/** Mapa de un solo punto (perfil de empresa). */
export function mapaPunto(el, lat, lng, etiqueta) {
  const m = base(el, { zoomControl: true });
  m.setView([lat, lng], 14);
  L.circleMarker([lat, lng], { radius: 9, color: '#FFFFFF', weight: 2, fillColor: '#1A57B4', fillOpacity: 1 })
    .addTo(m).bindTooltip(esc(etiqueta), { permanent: false });
  return m;
}

/**
 * Selector de ubicación: clic en el mapa o arrastrar el marcador.
 * alCambiar(lat, lng) se llama con valores redondeados a 6 decimales.
 */
export function selectorUbicacion(el, lat, lng, alCambiar) {
  const m = base(el);
  let mk = null;
  const fijar = (la, ln, centrar = false) => {
    la = Math.round(la * 1e6) / 1e6;
    ln = Math.round(ln * 1e6) / 1e6;
    if (!mk) {
      mk = L.marker([la, ln], { draggable: true, keyboard: true, title: 'Ubicación de la empresa' }).addTo(m);
      mk.on('dragend', () => { const p = mk.getLatLng(); fijar(p.lat, p.lng); });
    } else mk.setLatLng([la, ln]);
    if (centrar) m.setView([la, ln], 14);
    alCambiar?.(la, ln);
  };
  if (lat != null && lng != null) fijar(lat, lng, true);
  m.on('click', e => fijar(e.latlng.lat, e.latlng.lng));
  return {
    fijar,
    quitar() { if (mk) { m.removeLayer(mk); mk = null; } alCambiar?.(null, null); },
    invalidar() { setTimeout(() => m.invalidateSize(), 50); }
  };
}
