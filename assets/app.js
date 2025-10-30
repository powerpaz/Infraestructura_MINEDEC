(function () {
  const cfg = window.__CONF__ || {};
  const envLabel = document.getElementById("env-label");

  const supabase = (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY !== "REEMPLAZA_CON_TU_ANON_KEY")
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;
  envLabel.textContent = supabase ? "conectando a Supabase…" : "modo local (CSV)";

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
    const latKeys = ["lat","latitude","latitud","Latitud","LATITUD","y","ycoord"];
    const lngKeys = ["lng","lon","long","longitud","Longitud","LONGITUD","x","xcoord"];
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
      if (id === "t1" && window._leafletMap) { setTimeout(() => window._leafletMap.invalidateSize(), 150); }
    });
  });

  // --- Map init ---
  let map = L.map("map", { zoomControl: true, attributionControl: true }).setView([-1.831, -78.183], 6);
  window._leafletMap = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  let markersLayer = L.layerGroup().addTo(map);
  let provinciasLayer = L.layerGroup().addTo(map);
  let layerControl = L.control.layers(null, {"División política (provincias)": provinciasLayer}, {collapsed:false}).addTo(map);

  async function loadProvincias(){
    try{
      const res = await fetch(cfg.PROVINCIAS_GJ, { cache: "no-store" });
      if(!res.ok) throw new Error("No se pudo cargar el GeoJSON");
      const gj = await res.json();
      provinciasLayer.clearLayers();
      const geo = L.geoJSON(gj, {
        style: { color: "#1f6feb", weight: 1, fillOpacity: 0.06 },
        onEachFeature: (feat, layer) => {
          const n = feat.properties?.name || feat.properties?.NOMBRE || feat.properties?.provincia || "Provincia";
          layer.bindPopup(n);
        }
      }).addTo(provinciasLayer);
      const b = geo.getBounds(); if (b.isValid()) map.fitBounds(b, { padding: [20,20] });
    } catch(e){ console.error(e); }
  }

  async function loadFromSupabase(tableName){
    if (!supabase) throw new Error("Supabase no configurado");
    const { data, error } = await supabase.from(tableName).select("*").limit(5000);
    if (error) throw error;
    return data || [];
  }

  function parseCsvText(txt){
    const parsed = Papa.parse(txt, { header: true, dynamicTyping: true, skipEmptyLines: true });
    return parsed.data || [];
  }

  async function loadFromCSV(url){
    const res = await fetch(url, { cache: "no-store" });
    const t = await res.text();
    return parseCsvText(t);
  }

  async function loadTableSmart(tableKey, statusEl, tableEl){
    const tableName = cfg.TABLES[tableKey];
    let rows = [];
    try {
      rows = await loadFromSupabase(tableName);
      envLabel.textContent = "conectado a Supabase";
      if (!rows.length && cfg.LOCAL?.enabled && cfg.LOCAL[tableKey]) {
        rows = await loadFromCSV(cfg.LOCAL[tableKey]);
        statusEl && (statusEl.textContent = `Modo local CSV (${rows.length} filas)`);
      } else {
        statusEl && (statusEl.textContent = `${rows.length} filas (Supabase)`);
      }
    } catch(e){
      console.warn("Fallo Supabase, usando CSV local si existe:", e.message);
      if (cfg.LOCAL?.enabled && cfg.LOCAL[tableKey]) {
        rows = await loadFromCSV(cfg.LOCAL[tableKey]);
        statusEl && (statusEl.textContent = `Modo local CSV (${rows.length} filas)`);
        envLabel.textContent = "modo local (CSV)";
      } else {
        statusEl && (statusEl.textContent = "Error: " + e.message);
      }
    }
    tableFromData(tableEl, rows);
    return rows;
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
      const nameKey = ["nom_institucion_educativa","nombre","institucion","establecimiento","name","NOMBRE"].find(k=>k in rows[0]) || null;
      if (nameKey) rows = rows.filter(r => String(r[nameKey]||"").toLowerCase().includes(txt));
    }
    if (fTipo.value) {
      const key = ["te_fin","nom_sostenimiento","tipo","categoria","tipo_inst","tipo_est","Tipo","TIPO"].find(k=>k in rows[0]) || null;
      if (key) rows = rows.filter(r => String(r[key]) === fTipo.value);
    }
    if (fEstado.value) {
      const key = ["nom_estado_ie","estado","estatus","situacion","Estado","ESTADO"].find(k=>k in rows[0]) || null;
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
          const nameKey = ["nom_institucion_educativa","nombre","institucion","establecimiento","name","NOMBRE"].find(k=>k in r) || null;
          const name = nameKey ? r[nameKey] : "(sin nombre)";
          const popup = `<b>${name}</b><br/>${t1LatKey}: ${la}<br/>${t1LngKey}: ${lo}`;
          L.marker([la, lo]).bindPopup(popup).addTo(markersLayer);
        }
      });
      try{
        const pts = rows.filter(r => r[t1LatKey] && r[t1LngKey]).map(r=>[Number(r[t1LatKey]), Number(r[t1LngKey])]);
        if (pts.length) map.fitBounds(pts, { maxZoom: 12, padding: [20,20] });
      }catch(e){}
    }
  }

  async function initT1(){
    const statusEl = null; // usamos contador
    t1All = await loadTableSmart("tabla1", statusEl, t1Table);
    if (!t1All.length) return;
    [t1LatKey, t1LngKey] = detectLatLng(t1All[0]);
    const tipoVals = uniq(t1All.map(r => r.te_fin ?? r.nom_sostenimiento ?? r.tipo ?? r.categoria ?? r.tipo_inst ?? r.tipo_est ?? r.Tipo ?? r.TIPO ?? null));
    const estadoVals = uniq(t1All.map(r => r.nom_estado_ie ?? r.estado ?? r.estatus ?? r.situacion ?? r.Estado ?? r.ESTADO ?? null));
    populateSelect(fTipo, tipoVals, "Tipo");
    populateSelect(fEstado, estadoVals, "Estado");
    applyFilters();
  }

  // --- Otras tablas: solo grid ---
  function setupTable(key, statusSel, tableSel){
    loadTableSmart(key, Q(statusSel), Q(tableSel));
  }

  // Run
  loadProvincias();
  initT1();
  setupTable("tabla2", "#t2-status", "#t2-table");
  setupTable("tabla3", "#t3-status", "#t3-table");
  setupTable("tabla4", "#t4-status", "#t4-table");
})();