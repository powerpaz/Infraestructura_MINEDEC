const config = {
  USE_SUPABASE: false,
  CSV: {
    tabla1: "TABLA1_INFRA_clean.csv",
    tabla2: "Tabla2.csv",
    tabla3: "Tabla3_clean.csv",
    tabla4: "Tabla4_clean.csv"
  },
  GEOJSON: "provincias.geojson",
  COORDS: { lat: "latitud", lon: "longitud" },
  LAYER_STYLE: {
    tabla1: { color: "#4cc9f0" },
    tabla2: { color: "#b5179e" },
    tabla3: { color: "#f77f00" },
    tabla4: { color: "#43aa8b" }
  },
  TITLE_FIELDS: ["nom_institucion_educativa","nombre","nom_museo","institucion","establecimiento","nom_establecimiento","amie"],
  EXCLUDE_FIELDS: ["id","geom","geometry","the_geom","wkb_geometry","lat","latitude","latitud","lon","lng","long","longitud","x","y"]
};