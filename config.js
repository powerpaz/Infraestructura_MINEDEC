// === CONFIGURACIÓN ===
const config = {
  USE_SUPABASE: true,
  SUPABASE_URL: "https://dhnznjzdqzdepofztypl.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobnpuanpkcXpkZXBvZnp0eXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjY0MTgsImV4cCI6MjA3NzM0MjQxOH0.gT0ZgrDCf5q3uaFEv5epxiXBCFDUpFZ2SxXKK2rHY5U",
  TABLES: {
    tabla1: "tabla1_clean",
    tabla2: "tabla2",
    tabla3: "tabla3_clean",
    tabla4: "tabla4_clean"
  },
  CSV: {
    // fallback offline (mismos nombres si los quieres alojar también en el repo)
    tabla1: "tabla1_WGS84.csv",
    tabla2: "Tabla2.csv",
    tabla3: "Tabla3_clean.csv",
    tabla4: "Tabla4_clean.csv"
  },
  GEOJSON: "provincias.geojson",
  LAYER_STYLE: {
    tabla1: { color: "#4cc9f0" },
    tabla2: { color: "#b5179e" },
    tabla3: { color: "#f77f00" },
    tabla4: { color: "#43aa8b" }
  },
  TITLE_FIELDS: ["nom_institucion_educativa","nombre","nom_museo","institucion","establecimiento","nom_establecimiento","amie"],
  EXCLUDE_FIELDS: ["geom","geometry","the_geom","wkb_geometry","x","y","lat","latitude","long","lng","longitud","latitud"]
};