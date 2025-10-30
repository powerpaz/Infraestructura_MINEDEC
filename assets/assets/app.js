// app.js
// Se asume que ya existe window.__CONF__ desde assets/config.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__CONF__ || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  document.getElementById("status").textContent = "Faltan claves públicas (config.js)";
  throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en assets/config.js");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Limpia numerales en círculo y espacios extra
const circledRegex = /[\u2460-\u24FF\u2776-\u2793]/gu;
const clean = (s) => (s ?? "").toString().replace(circledRegex, "").replace(/\s{2,}/g, " ").trim();

// ====== Mapa Leaflet ======
const map = L.map("map", {
  attributionControl: true,
}).setView([-1.83, -78.18], 6);        // Centro aproximado de Ecuador

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

const layerGroup = L.layerGroup().addTo(map);

// Obtiene lat/lon de un registro con nombres de campos flexibles
function getLatLon(row) {
  const lat = row.lat ?? row.latitude ?? row.latitud ?? row.y ?? null;
  const lon = row.lon ?? row.lng ?? row.long ?? row.longitud ?? row.longitude ?? row.x ?? null;
  if (lat == null || lon == null) return null;
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: la, lon: lo };
}

function addRowToTable(row) {
  const tb = document.querySelector("#tbl tbody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${row.id ?? ""}</td>
    <td>${row.amie ?? ""}</td>
    <td>${clean(row.nom_institucion_educativa)}</td>
    <td>${row.te_fin ?? ""}</td>
    <td>${row.estado ?? ""}</td>
  `;
  tb.appendChild(tr);
}

async function loadBatch({ from = 0, to = 499 } = {}) {
  const status = document.getElementById("status");
  status.textContent = `Cargando filas ${from + 1}–${to + 1}…`;

  const { data, error } = await supabase
    .from("tabla1_clean")
    .select("id, amie, nom_institucion_educativa, te_fin, estado, lat, lon, latitud, longitud, latitude, longitude, x, y")
    .range(from, to);

  if (error) {
    console.error(error);
    status.textContent = "Error cargando datos";
    return;
  }

  // Limpia tabla/mapa
  if (from === 0) {
    document.querySelector("#tbl tbody").innerHTML = "";
    layerGroup.clearLayers();
  }

  for (const row of data) {
    addRowToTable(row);

    const ll = getLatLon(row);
    if (ll) {
      const nombre = clean(row.nom_institucion_educativa);
      const popup = `
        <strong>${nombre}</strong><br/>
        AMIE: ${row.amie ?? "-"}<br/>
        Tipo: ${row.te_fin ?? "-"}<br/>
        Estado: ${row.estado ?? "-"}
      `;
      L.marker([ll.lat, ll.lon]).bindPopup(popup).addTo(layerGroup);
    }
  }

  status.textContent = `Cargadas ${data.length} filas.`;
}

// Botones
document.getElementById("btn-load").addEventListener("click", () => loadBatch({ from: 0, to: 499 }));
document.getElementById("btn-clear").addEventListener("click", () => {
  document.querySelector("#tbl tbody").innerHTML = "";
  layerGroup.clearLayers();
  document.getElementById("status").textContent = "Limpio.";
});
