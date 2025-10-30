import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Variables de entorno del entorno público (solo lectura)
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || "https://TU_URL_SUPABASE.supabase.co";
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || "TU_ANON_KEY";

// Crear cliente
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Regex para quitar numerales en círculo
const circledRegex = /[\u2460-\u24FF\u2776-\u2793]/gu;

// Función para limpiar nombres
const cleanName = (name) => name?.replace(circledRegex, "").trim() ?? "";

document.getElementById("load-data").addEventListener("click", async () => {
  const { data, error } = await supabase
    .from("tabla1_clean")
    .select("id, amie, nom_institucion_educativa, te_fin, estado")
    .limit(100); // carga los primeros 100

  if (error) {
    console.error("Error cargando datos:", error);
    alert("Error cargando datos. Ver consola.");
    return;
  }

  const tbody = document.querySelector("#instituciones-table tbody");
  tbody.innerHTML = "";

  data.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.amie}</td>
      <td>${cleanName(row.nom_institucion_educativa)}</td>
      <td>${row.te_fin}</td>
      <td>${row.estado}</td>
    `;
    tbody.appendChild(tr);
  });
});

