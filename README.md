# Vitral de Proveedores — Observatorio del CLRAH

Directorio público de empresas proveedoras con inventario por empresa, registro de proveedores, flujo de aprobación y panel de administración.

- **Frontend:** HTML, CSS y JavaScript (módulos ES), sin compilación. Se aloja como archivos estáticos.
- **Backend:** Supabase (Auth, PostgreSQL con Row Level Security, Storage).
- **Diseño:** sistema CLRAH (Source Sans 3, #0F3A7A, #1A57B4, #F90525).

## Instalación rápida

1. Cree un proyecto en Supabase y ejecute `supabase/01` a `06` en el SQL Editor.
2. Configure la autenticación por correo y las URLs de redirección.
3. Registre la cuenta del administrador y ejecute `supabase/07_primer_administrador.sql`.
4. Escriba la URL y la clave *anon* en `js/config.js`.
5. Suba la carpeta al servidor (HTTPS).

Detalle completo: [`docs/MANUAL_TECNICO.md`](docs/MANUAL_TECNICO.md) · Uso: [`docs/MANUAL_USUARIO.md`](docs/MANUAL_USUARIO.md)

## Páginas

| Página | Uso |
|---|---|
| `index.html` | Vitral público: directorio, filtros y mapa |
| `empresa.html?id=` | Perfil e inventario de una empresa |
| `registro.html` | Registro de proveedores |
| `acceso.html` | Inicio de sesión y recuperación de contraseña |
| `panel.html` | Panel privado del proveedor |
| `admin.html` | Administración del CLRAH |

## Pruebas

`pruebas/pruebas_permisos.py` (69 pruebas de seguridad), `pruebas/pruebas_interfaz.py` (38 pruebas en navegador) y `pruebas/prueba_api_supabase.mjs` (contra el proyecto real). Ver la sección 8 del manual técnico.

## Licencias de terceros

Supabase JS (MIT), Leaflet (BSD-2), Source Sans 3 (SIL OFL 1.1). Los textos de las licencias están en `js/vendor/` y `fonts/`.
