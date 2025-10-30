(function () {
  const cfg = window.__CONF__ || {};
  const envLabel = document.getElementById("env-label");
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    envLabel.textContent = "conectando…";
  }

  const supabase = (window.supabase && cfg.SUPABASE_URL)
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  // --- Helpers ---
  const Q = (sel) => document.querySelector(sel);
  const tableFromData = (elTable, rows) => {
    const thead = elTable.querySelector("thead");
    const tbody = elTable.querySelector("tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";
    if (!rows || rows.length === 0) {
      thead.innerHTML = "<tr><th>Sin datos</th></tr>";
      return;
    }
    const cols = Object.keys(rows[0]);
    thead.innerHTML = "<tr>" + cols.map(c=>`<th>${c}</th>`).join("") + "</tr>";
    const frag = document.createDocumentFragment();
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = cols.map(c=>`<td>${r[c] ?? ""}</td>`).join("");
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  };

  const detectLatLng = (row) => {
    const latKeys = ["lat","latitude","latitud","y","ycoord"];
    const lngKeys = ["lng","lon","long","longitud","x","xcoord"];
    let latK = latKeys.find(k => k in row);
    let lngK = lngKeys.find(k => k in row);
    return latK && lngK ? [latK, lngK] : [null, null];
  };

  const uniq = (arr) => Array.from(new Set(arr.filter(v => v != null && v !== ""))).sort();

  // --- Tabs ---
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-pane").forEach(p=>p.style.display="none");
      const id = btn.getAttribute("data-tab");
      document.getElementById(id).style.display = "";
      // Resize map when its tab becomes visible
      if (id === "t1" && window._leafletMap) { setTimeout(() => window._leafletMap.invalidateSize(), 150); }
    });
  });

  // --- Map init ---
  let map = L.map("map", { zoomControl: true, attributionControl: true }).setView([-1.831, -78.183], 6);
  window._leafletMap = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  let markersLayer = L.layerGroup().addTo(map);

  // --- Provincias GeoJSON (división política) ---
  let provinciasLayer = L.layerGroup();
  let layerControl = null;

  async function loadProvinciasGeoJSON(){
    try{
      const res = await fetch("assets/provincias.geojson", { cache: "no-store" });
      if(!res.ok) throw new Error("No se pudo cargar provincias.geojson");
      const gj = await res.json();
      provinciasLayer.clearLayers();
      const geo = L.geoJSON(gj, {
        style: function(feature){
          return { color: "#1f6feb", weight: 1, fillOpacity: 0.06 };
        },
        onEachFeature: function(feature, layer){
          const name = feature.properties?.name || feature.properties?.NOMBRE || feature.properties?.provincia || "Provincia";
          layer.bindPopup(name);
        }
      });
      geo.addTo(provinciasLayer);
      provinciasLayer.addTo(map);

      // Ajustar vista al límite del GeoJSON si no hay puntos
      try {
        const bounds = geo.getBounds();
        if(bounds.isValid()) map.fitBounds(bounds, { padding: [20,20] });
      } catch(e){}

      // Layer control (una vez)
      if(!layerControl){
        layerControl = L.control.layers(null, { "División política (provincias)": provinciasLayer }, { collapsed: false });
        layerControl.addTo(map);
      } else {
        layerControl.addOverlay(provinciasLayer, "División política (provincias)");
      }
    } catch(e){
      console.error("Provincias GeoJSON:", e);
    }
  }


  function setEnvOk(ok){
    envLabel.textContent = ok ? "conectado" : "sin configurar";
  }

  async function loadTable(tableName, statusEl, tableEl){
    if (!supabase) {
      setEnvOk(false);
      if (statusEl) statusEl.textContent = "Supabase no configurado (assets/config.js).";
      return [];
    }
    try{
      const { data, error } = await supabase.from(tableName).select("*").limit(2000);
      if (error) throw error;
      if (statusEl) statusEl.textContent = `${data.length} filas`;
      setEnvOk(true);
      tableFromData(tableEl, data);
      return data;
    } catch(e){
      console.error(e);
      if (statusEl) statusEl.textContent = "Error: " + e.message;
      setEnvOk(false);
      return [];
    }
  }

  // --- Tabla 1: Map + filters ---
  let t1All = [];
  let t1LatKey = null, t1LngKey = null;
  const t1Table = Q("#t1-table");
  const t1Count = Q("#t1-count");

  const fTexto = Q("#f-texto");
  const fTipo = Q("#f-tipo");
  const fEstado = Q("#f-estado");
  const btnReset = Q("#btn-reset");

  function populateSelect(selectEl, values, label){
    const current = selectEl.value;
    selectEl.innerHTML = `<option value="">${label}</option>` + values.map(v=>`<option>${v}</option>`).join("");
    if (values.includes(current)) selectEl.value = current;
  }

  function applyFilters(){
    let rows = t1All.slice();
    const txt = fTexto.value.trim().toLowerCase();
    if (txt && rows.length) {
      const nameKey = ["nombre","institucion","establecimiento","name"].find(k=>k in rows[0]) || null;
      if (nameKey) rows = rows.filter(r => String(r[nameKey]||"").toLowerCase().includes(txt));
    }
    if (fTipo.value) {
      const key = ["tipo","categoria","tipo_inst","tipo_est"].find(k=>k in rows[0]) || null;
      if (key) rows = rows.filter(r => String(r[key]) === fTipo.value);
    }
    if (fEstado.value) {
      const key = ["estado","estatus","situacion"].find(k=>k in rows[0]) || null;
      if (key) rows = rows.filter(r => String(r[key]) === fEstado.value);
    }
    // Update table
    tableFromData(t1Table, rows);
    // Update count
    t1Count.textContent = `${rows.length} de ${t1All.length} registros`;

    // Update map markers
    markersLayer.clearLayers();
    if (t1LatKey && t1LngKey) {
      rows.forEach(r => {
        const la = Number(r[t1LatKey]); const lo = Number(r[t1LngKey]);
        if (isFinite(la) && isFinite(lo)) {
          const nameKey = ["nombre","institucion","establecimiento","name"].find(k=>k in r) || null;
          const name = nameKey ? r[nameKey] : "(sin nombre)";
          const popup = `<b>${name}</b><br/>${t1LatKey}: ${la}<br/>${t1LngKey}: ${lo}`;
          L.marker([la, lo]).bindPopup(popup).addTo(markersLayer);
        }
      });
      if (rows.length) {
        const pts = rows.filter(r => r[t1LatKey] && r[t1LngKey]).map(r=>[Number(r[t1LatKey]), Number(r[t1LngKey])]);
        if (pts.length) map.fitBounds(pts, { maxZoom: 12, padding: [20,20] });
      }
    }
  }

  async function initT1(){
    t1All = await loadTable(cfg.TABLES.tabla1, null, t1Table);
    if (!t1All.length) return;
    [t1LatKey, t1LngKey] = detectLatLng(t1All[0]);
    // Build filter options dynamically
    const tipoVals = uniq(t1All.map(r => r.tipo ?? r.categoria ?? r.tipo_inst ?? r.tipo_est ?? null));
    const estadoVals = uniq(t1All.map(r => r.estado ?? r.estatus ?? r.situacion ?? null));
    populateSelect(fTipo, tipoVals, "Tipo");
    populateSelect(fEstado, estadoVals, "Estado");
    applyFilters();
  }

  fTexto.addEventListener("input", applyFilters);
  fTipo.addEventListener("change", applyFilters);
  fEstado.addEventListener("change", applyFilters);
  btnReset.addEventListener("click", () => { fTexto.value=""; fTipo.value=""; fEstado.value=""; applyFilters(); });

  // --- Otras tablas: solo grid ---
  initT1();
  loadProvinciasGeoJSON();
  loadTable(cfg.TABLES.tabla2, Q("#t2-status"), Q("#t2-table"));
  loadTable(cfg.TABLES.tabla3, Q("#t3-status"), Q("#t3-table"));
  loadTable(cfg.TABLES.tabla4, Q("#t4-status"), Q("#t4-table"));
})();