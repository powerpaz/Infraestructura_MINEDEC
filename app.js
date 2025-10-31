
// === AMIE Search Enhancements (patched) ===
window.__AMIE_PATCH__ = true;
// Índice AMIE -> [markers]
const markerByAmie = new Map();
// Normalizador AMIE
const normAmie = v => String(v ?? '').trim().toUpperCase();

(() => {
  const map = L.map('map').setView([-1.83, -78.18], 6);
  const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
  L.control.layers({ 'OSM': baseOSM, 'Satélite': baseSat }).addTo(map);

  const statusBox = document.getElementById('status');
  const setStatus = (msg) => statusBox.innerHTML = msg;

  let allData = { tabla1: [], tabla2: [], tabla3: [], tabla4: [] };
  let allLayers = {};

  function toNum(v) {
    if (v == null) return NaN;
    if (typeof v === 'string') {
      v = v.trim().replace(',', '.');
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function looksEC(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && lat > -6 && lat < 2 && lon > -92.6 && lon < -74;
  }

  function makeCluster(classKey) {
    return L.markerClusterGroup({
      iconCreateFunction: c => {
        const n = c.getChildCount();
        const div = document.createElement('div');
        div.innerHTML = `<span>${n}</span>`;
        return L.divIcon({
          html: div,
          className: `marker-cluster cluster--${classKey}`,
          iconSize: L.point(40, 40)
        });
      }
    });
  }

  function popupInstitucion(row, type) {
    const keys = Object.keys(row);
    const by = (k, ...alts) => {
      const targets = [k, ...alts].map(s => String(s).toLowerCase());
      return keys.find(c => c && targets.includes(c.toLowerCase()));
    };
    const get = k => (k && row[k] != null && String(row[k]).trim() !== '') ? row[k] : '—';
    
    let html = `<div style="font-size: 11px; color: #fff; line-height: 1.6;">`;
    
    if (type === 'tabla1') {
      const amieK = by('amie');
      const nombreK = by('nom_institucion_educativa', 'nombre', 'institucion');
      const sostK = by('nom_sostenimiento', 'sostenimiento', 'te_fin');
      const regK = by('regimen', 'régimen');
      const provK = by('dpa_despro', 'provincia');
      const zonaK = by('da_zona', 'zona');
      
      html += `<b style="color: #4cc9f0;">📚 INSTITUCIÓN</b><br>`;
      html += `<b>AMIE:</b> ${get(amieK)}<br>`;
      html += `<b>Nombre:</b> ${get(nombreK)}<br>`;
      html += `<b>Sostenimiento:</b> ${get(sostK)}<br>`;
      html += `<b>Régimen:</b> ${get(regK)}<br>`;
      html += `<b>Provincia:</b> ${get(provK)}<br>`;
      html += `<b>Zona:</b> ${get(zonaK)}`;
    } else if (type === 'tabla2') {
      html += `<b style="color: #b5179e;">📚 CULTURA</b><br>`;
      for (let [k, v] of Object.entries(row).slice(0, 8)) {
        if (v != null && String(v).trim() !== '') html += `<b>${k}:</b> ${v}<br>`;
      }
    } else if (type === 'tabla3') {
      html += `<b style="color: #f77f00;">⚽ DEPORTE</b><br>`;
      for (let [k, v] of Object.entries(row).slice(0, 8)) {
        if (v != null && String(v).trim() !== '') html += `<b>${k}:</b> ${v}<br>`;
      }
    } else if (type === 'tabla4') {
      html += `<b style="color: #43aa8b;">🎓 UNIVERSIDAD</b><br>`;
      for (let [k, v] of Object.entries(row).slice(0, 8)) {
        if (v != null && String(v).trim() !== '') html += `<b>${k}:</b> ${v}<br>`;
      }
    }
    
    html += `</div>`;
    return html;
  }

  async function loadCSV(path) {
    return new Promise((resolve, reject) => {
      Papa.parse(path, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: r => resolve(r.data),
        error: reject
      });
    });
  }

  async function loadInstituciones() {
    setStatus('Cargando instituciones…');
    let data = [];
    try {
      data = await loadCSV(config.CSV.tabla1);
    } catch (e) {
      console.error('Error cargando tabla1:', e);
      setStatus('❌ No se pudo cargar el CSV de instituciones.');
      return null;
    }
    
    allData.tabla1 = data;
    const layer = makeCluster('tabla1');
    let ok = 0, bad = 0;
    for (const row of data) {
      const keys = Object.keys(row);
      const by = k => keys.find(c => c && c.toLowerCase() === k);
      
      let lat = toNum(row[by('latitud')]);
      let lon = toNum(row[by('longitud')]);
      
      if (!looksEC(lat, lon)) {
        bad++;
        continue;
      }
      
      layer.addLayer(L.circleMarker([lat, lon], {
        radius: 5,
        fillColor: config.LAYER_STYLE.tabla1.color,
        color: '#fff',
        weight: 1,
        fillOpacity: .9
      }).bindPopup(popupInstitucion(row, 'tabla1')));
      ok++;
    }
    
    map.addLayer(layer);
    setStatus(`✓ Instituciones: ${ok} puntos (omitidos ${bad}).`);
    return layer;
  }

  async function loadGeneric(path, color, classKey, nombre, tipo) {
    try {
      const data = await loadCSV(path);
      allData[tipo] = data;
      const layer = makeCluster(classKey);
      let ok = 0;

      for (const row of data) {
        const keys = Object.keys(row);
        const by = k => keys.find(c => c && c.toLowerCase() === k);
        
        let lat = toNum(row[by('latitud')]);
        let lon = toNum(row[by('longitud')]);
        
        if (isNaN(lat) || isNaN(lon)) {
          lat = toNum(row[by('y')]);
          lon = toNum(row[by('x')]);
        }

        if (!looksEC(lat, lon)) continue;

        layer.addLayer(L.circleMarker([lat, lon], {
          radius: 5,
          fillColor: color,
          color: '#fff',
          weight: 1,
          fillOpacity: .9
        }).bindPopup(popupInstitucion(row, tipo)));
        ok++;
      }

      console.log(`${nombre}: ${ok} puntos cargados`);
      return layer;
    } catch (e) {
      console.error(`Error cargando ${nombre}:`, e);
      return L.markerClusterGroup();
    }
  }

  
function setupSearch() {
  const input = document.getElementById('search-input');
  const btn = document.getElementById('search-btn');
  const clear = document.getElementById('clear-btn');
  const resultsBox = document.getElementById('search-results');

  if (!input) return;

  const doSearch = () => {
    const q = input.value.trim();
    if (!q) {
      if (resultsBox) resultsBox.innerHTML = '';
      if (typeof showAllLayers === 'function') showAllLayers();
      return;
    }
    searchInstituciones(q);
  };

  input.addEventListener('input', doSearch);
  if (btn) btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  if (clear) {
    clear.addEventListener('click', () => {
      input.value = '';
      if (resultsBox) resultsBox.innerHTML = '';
      if (typeof showAllLayers === 'function') showAllLayers();
    });
  }
}
)();


function searchInstituciones(query) {
  const q = String(query ?? '').trim();
  const qLower = q.toLowerCase();
  const qNorm = normAmie(q);
  const resultsBox = document.getElementById('search-results') || { innerHTML: '' };

  // 1) Intento exacto por AMIE (solo tabla1 indexada)
  if (q) {
    const exact = markerByAmie.get(qNorm);
    if (exact && exact.length > 0) {
      if (typeof showAllLayers === 'function') showAllLayers();
      if (exact.length === 1) {
        const m = exact[0];
        const ll = m.getLatLng();
        map.flyTo(ll, 15, { duration: 0.6 });
        setTimeout(() => m.openPopup(), 350);
      } else {
        const b = L.latLngBounds(exact.map(m => m.getLatLng()));
        map.fitBounds(b.pad(0.2));
        setTimeout(() => exact[0].openPopup(), 350);
      }
      resultsBox.innerHTML = `<div style="font-size:12px;color:#6b7280;">AMIE exacto: <b>${qNorm}</b> (${exact.length} punto/s)</div>`;
      return;
    }
  }

  // 2) Búsqueda parcial por AMIE o NOMBRE (todas las tablas)
  const found = [];
  const data = (typeof allData !== 'undefined' && allData) ? allData : {};
  Object.entries(data).forEach(([tableKey, rows]) => {
    if (!Array.isArray(rows)) return;
    rows.forEach(row => {
      const keys = Object.keys(row || {});
      const by = k => keys.find(c => c && c.toLowerCase() === k);
      const amie = String(row?.[by('amie')] ?? '');
      const nombre = String(row?.[by('nom_institucion_educativa')] ?? row?.[by('nombre')] ?? row?.[by('institucion')] ?? '');
      if (amie.toLowerCase().includes(qLower) || nombre.toLowerCase().includes(qLower)) {
        found.push({ tableKey, row, amie, nombre });
      }
    });
  });

  if (typeof showAllLayers === 'function') showAllLayers();

  if (found.length === 0) {
    resultsBox.innerHTML = `<div style="font-size:12px;color:#ef4444;">Sin resultados para “${q}”.</div>`;
    return;
  }

  // Intento de zoom con el primer AMIE encontrado en tabla1 si está indexado
  for (const f of found) {
    if (f.tableKey === 'tabla1') {
      const amieN = normAmie(f.amie);
      const ms = markerByAmie.get(amieN);
      if (ms && ms.length) {
        const ll = ms[0].getLatLng();
        map.flyTo(ll, 14, { duration: 0.6 });
        setTimeout(() => ms[0].openPopup(), 350);
        break;
      }
    }
  }

  // Render de lista corta
  const items = found.slice(0, 10).map(f => {
    const amieN = normAmie(f.amie);
    const click = amieN ? `data-amie="${amieN}"` : '';
    const nameLabel = f.nombre || '(Sin nombre)';
    return `<div class="result-item" ${click} style="cursor:pointer;padding:4px 0;border-bottom:1px dashed #1f2937;">
      <b>${nameLabel}</b><br/><span style="font-size:12px;color:#6b7280;">AMIE: ${amieN || '—'} • ${f.tableKey}</span>
    </div>`;
  }).join('');

  resultsBox.innerHTML = `<div style="font-size:12px;color:#6b7280;">Resultados: ${found.length}</div>${items}`;

  // Click a resultado -> flyTo + popup si existe en índice
  if (resultsBox.querySelectorAll) {
    resultsBox.querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => {
        const amieN = el.getAttribute('data-amie');
        if (!amieN) return;
        const ms = markerByAmie.get(amieN);
        if (ms && ms.length) {
          const ll = ms[0].getLatLng();
          map.flyTo(ll, 15, { duration: 0.6 });
          setTimeout(() => ms[0].openPopup(), 350);
        }
      });
    });
  }
}

