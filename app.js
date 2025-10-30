(() => {
  const cfg = window.__GEOVISOR_CONFIG__;

  // ===== BASEMAPS =====
  const base_OSM = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }
  );

  const base_SAT = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxZoom: 19
    }
  );

  // Dark (opcional para mantener estética Mapbox-like)
  const base_DARK = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; OSM &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }
  );

  const map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
    layers: [base_DARK] // por estética inicial; el usuario puede cambiar a OSM/Sat
  }).setView([-1.8312, -78.1834], 6);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Control de capas (solo basemaps aquí; las capas temáticas se manejan con los switches)
  const baseMaps = {
    "Dark": base_DARK,
    "OSM": base_OSM,
    "Satélite": base_SAT
  };
  L.control.layers(baseMaps, {}, { position: "topleft", collapsed: true }).addTo(map);

  // Estado UI
  document.getElementById("source-mode").textContent = cfg.USE_SUPABASE ? "Supabase (REST)" : "CSV locales";
  document.getElementById("reload").addEventListener("click", () => bootstrap());

  // Drawer móvil
  const menuBtn = document.getElementById("menuBtn");
  menuBtn.addEventListener("click", () => {
    document.body.classList.toggle("drawer-open");
    setTimeout(() => map.invalidateSize(), 260);
  });

  // ---- CARGA DE DATOS ----
  async function fetchSupabase(table) {
    const url = `${cfg.SUPABASE_URL}/rest/v1/${table}?select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase error ${res.status}`);
    return await res.json();
  }

  function fetchCSV(path) {
    return new Promise((resolve, reject) => {
      Papa.parse(path, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (r) => resolve(r.data),
        error: reject,
      });
    });
  }

  async function getRecords(key) {
    const tableName = cfg.TABLES[key];
    const csvPath = cfg.CSV[key];
    if (cfg.USE_SUPABASE) return await fetchSupabase(tableName);
    return await fetchCSV(csvPath);
  }

  // ---- UTILS ----
  function toFloat(v){ const n = Number(v); return isFinite(n) ? n : null; }

  function makePopupContent(props) {
    const titleField = cfg.TITLE_FIELDS.find((k) => k in props && props[k]);
    const title = titleField ? String(props[titleField]) : "Registro";
    const rows = Object.entries(props)
      .filter(([k, v]) => !cfg.EXCLUDE_FIELDS.includes(k.toLowerCase()))
      .filter(([k, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .slice(0, 16);
    const tr = rows.map(([k,v]) => `<tr><td class="k">${k}</td><td>${String(v)}</td></tr>`).join("");
    return `<div class="popup"><h4>${title}</h4><table>${tr}</table></div>`;
  }

  function circleMarker(latlng, color) {
    return L.circleMarker(latlng, {
      radius: 6,
      color: "rgba(255,255,255,.25)",
      weight: 1,
      fillColor: color,
      fillOpacity: 0.9,
      pane: "markerPane",
    });
  }

  function makeClusterGroup(key) {
    return L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      removeOutsideVisibleBounds: true,
      spiderfyDistanceMultiplier: 1.2,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = "small";
        if (count >= 50) size = "large";
        else if (count >= 15) size = "medium";
        const div = document.createElement("div");
        div.innerHTML = `<span>${count}</span>`;
        return L.divIcon({
          html: div,
          className: `marker-cluster marker-cluster-${size} cluster--${key}`,
          iconSize: L.point(40, 40),
        });
      },
    });
  }

  const layers = {
    tabla1: { key: "tabla1", layer: makeClusterGroup("tabla1") },
    tabla2: { key: "tabla2", layer: makeClusterGroup("tabla2") },
    tabla3: { key: "tabla3", layer: makeClusterGroup("tabla3") },
    tabla4: { key: "tabla4", layer: makeClusterGroup("tabla4") },
  };

  function clearLayers(){ Object.values(layers).forEach(({layer}) => layer.clearLayers()); }

  async function loadLayer(key) {
    const color = cfg.LAYER_STYLE[key].color;
    const data = await getRecords(key);
    const latK = cfg.COORDS.lat, lonK = cfg.COORDS.lon;

    const markers = [];
    for (const row of data) {
      const lat = toFloat(row[latK]);
      const lon = toFloat(row[lonK]);
      if (lat == null || lon == null) continue;
      const m = circleMarker([lat, lon], color).bindPopup(makePopupContent(row), { maxWidth: 360 });
      markers.push(m);
    }
    layers[key].layer.addLayers(markers);
  }

  async function bootstrap() {
    clearLayers();
    Object.values(layers).forEach(({layer}) => layer.addTo(map));

    // toggles de capas
    [["tabla1","toggle-tabla1"],["tabla2","toggle-tabla2"],["tabla3","toggle-tabla3"],["tabla4","toggle-tabla4"]]
      .forEach(([k,id]) => {
        const el = document.getElementById(id);
        const l = layers[k].layer;
        el.onchange = () => { if (el.checked) l.addTo(map); else map.removeLayer(l); };
      });

    await Promise.all([ loadLayer("tabla1"), loadLayer("tabla2"), loadLayer("tabla3"), loadLayer("tabla4") ]);

    // fit bounds
    const bounds = L.latLngBounds([]);
    Object.values(layers).forEach(({layer}) => layer.getLayers().forEach(m => bounds.extend(m.getLatLng())));
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.15));
  }

  bootstrap();
})();
