# Infraestructura Educativa — Frontend estático

Frontend listo para GitHub Pages que consume el **REST de Supabase** (sin conexión directa a Postgres).

## Configuración
1. En Supabase, ve a **Settings → API** y copia:
   - `Project URL`
   - `anon public key`
2. Edita `assets/config.js` y pega:
```js
window.__CONF__ = {
  SUPABASE_URL: "https://<tu-proyecto>.supabase.co",
  SUPABASE_ANON_KEY: "<tu-anon>",
  TABLES: {
    tabla1: "instituciones",
    tabla2: "cultura_patromonio_repositorios",
    tabla3: "infraestructura_deportiva",
    tabla4: "universidades_tecnicos"
  }
};
```
3. Publica en GitHub Pages (carpeta raíz del repo).

## Requisitos de columnas (flexible)
- **Mapa (Tabla1)**: se detectan automáticamente nombres de campos de coordenadas:
  - Latitud: `lat`, `latitude`, `latitud`, `y`, `ycoord`
  - Longitud: `lng`, `lon`, `long`, `longitud`, `x`, `xcoord`
- Filtros opcionales (si existen columnas):
  - `tipo` (o `categoria`, `tipo_inst`, `tipo_est`)
  - `estado` (o `estatus`, `situacion`)
  - Búsqueda por `nombre` (o `institucion`, `establecimiento`, `name`)

## RLS (lectura pública)
En cada tabla, habilita RLS y agrega una política:
```sql
create policy "read anon" on <tabla> for select to anon using (true);
```

## Límite
El `select` trae hasta 2000 filas. Ajusta en `assets/app.js` si necesitas más.
