// Config: Supabase + tablas + rutas de CSV como fallback
window.__CONF__ = {
  SUPABASE_URL: "https://dhznjzdqdepofztypl.supabase.co",
  SUPABASE_ANON_KEY: "REEMPLAZA_CON_TU_ANON_KEY",
  TABLES: {
    tabla1: "instituciones",
    tabla2: "cultura_patromonio_repositorios",
    tabla3: "infraestructura_deportiva",
    tabla4: "universidades_tecnicos"
  },
  // Fallback local (CSV) si falla Supabase o la tabla está vacía
  LOCAL: {
    enabled: true,
    tabla1: "assets/TABLA1_INFRA_clean.csv",
    tabla2: "assets/Tabla2.csv",
    tabla3: "assets/Tabla3_clean.csv",
    tabla4: "assets/Tabla4_clean.csv"
  },
  // GeoJSON de división política
  PROVINCIAS_GJ: "assets/provincias.geojson"
};
