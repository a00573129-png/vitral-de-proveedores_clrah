/* =====================================================================
   config.js — Configuración de la instalación
   ÚNICO archivo que hay que editar al instalar el Vitral.

   supabaseUrl / supabaseAnonKey:
     Supabase > Project Settings > API > Project URL y "anon public".
     La clave "anon" es PÚBLICA por diseño: solo permite lo que autorizan
     las políticas de seguridad (RLS) de la base de datos.
     NUNCA colocar aquí la clave "service_role".
   ===================================================================== */
window.VITRAL_CONFIG = {
  supabaseUrl: 'https://wwiskhqnswewtuxyqhod.supabase.co',
  supabaseAnonKey: 'sb_publishable_5uMeIiu09vzhMSb3TAHTRA_hylOIHnd',   // clave pública (publishable)

  // Correo institucional que aparece para dudas y vinculación de cuentas
  correoContacto: 'clrah@mingob.gob.pa',

  // Logo oficial (opcional). Colocar el archivo en /assets y escribir la ruta,
  // p. ej. 'assets/logo-clrah.png'. Si queda vacío se muestra solo el texto.
  logoUrl: '',

  // Vista inicial del mapa (Panamá)
  mapa: {
    centro: [9.05, -79.7],
    zoom: 8,
    teselas: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    atribucion: '&copy; colaboradores de OpenStreetMap'
  }
};
