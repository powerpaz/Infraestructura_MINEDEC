(() => {
  const map = L.map('map').setView([-1.83, -78.18], 6);
  const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
  L.control.layers({ 'OSM': baseOSM, 'Satélite': baseSat }).addTo(map);

  const statusBox = document.getElementById('status');
  const setStatus = (msg) => statusBox.innerHTML = msg;

  let allData = { tabla1: [], tabla2: [], tabla3: [], tabla4: [] };
  let allLayers = {};

// --- AMIE search helpers (patched) ---
const markerByAmie = new Map();
const normAmie = v => String(v ?? '').trim().toUpperCase();


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
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  if (clear) clear.addEventListener('click', () => { input.value=''; if (resultsBox) resultsBox.innerHTML=''; if (typeof showAllLayers==='function') showAllLayers(); });
}
)();
