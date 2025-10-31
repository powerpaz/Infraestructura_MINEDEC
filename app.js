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
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (query.length > 0) {
        clearBtn.style.display = 'block';
        searchInstituciones(query);
      } else {
        clearBtn.style.display = 'none';
        showAllLayers();
      }
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      showAllLayers();
    });
  }

  function searchInstituciones(query) {
    const queryLower = query.toLowerCase();
    const foundData = {};
    
    Object.entries(allData).forEach(([tableKey, rows]) => {
      foundData[tableKey] = [];
      rows.forEach((row, idx) => {
        const keys = Object.keys(row);
        const by = k => keys.find(c => c && c.toLowerCase() === k);
        
        const amie = row[by('amie')] || '';
        const nombre = row[by('nom_institucion_educativa') || by('nombre') || by('institucion')] || '';
        
        if (amie.toLowerCase().includes(queryLower) || nombre.toLowerCase().includes(queryLower)) {
          foundData[tableKey].push(idx);
        }
      });
    });

    // Ocultar todas las capas
    Object.values(allLayers).forEach(layer => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });

    // Mostrar solo resultados
    Object.entries(foundData).forEach(([tableKey, indices]) => {
      if (allLayers[tableKey] && indices.length > 0) {
        map.addLayer(allLayers[tableKey]);
      }
    });
  }

  function showAllLayers() {
    Object.values(allLayers).forEach(layer => {
      if (layer && !map.hasLayer(layer)) map.addLayer(layer);
    });
  }

  (async () => {
    try {
      const gj = await (await fetch(config.GEOJSON)).json();
      const prov = L.geoJSON(gj, { style: { color: '#7aa2ff', weight: 1, fillOpacity: 0 } }).addTo(map);

      const l1 = await loadInstituciones();
      const l2 = await loadGeneric(config.CSV.tabla2, config.LAYER_STYLE.tabla2.color, 'tabla2', 'Cultura', 'tabla2');
      const l3 = await loadGeneric(config.CSV.tabla3, config.LAYER_STYLE.tabla3.color, 'tabla3', 'Deporte', 'tabla3');
      const l4 = await loadGeneric(config.CSV.tabla4, config.LAYER_STYLE.tabla4.color, 'tabla4', 'Universidades', 'tabla4');

      allLayers = { tabla1: l1, tabla2: l2, tabla3: l3, tabla4: l4 };

      const layers = { tabla2: l2, tabla3: l3, tabla4: l4 };
      Object.values(layers).forEach(l => map.addLayer(l));

      document.getElementById('toggle-prov').onchange = e => e.target.checked ? prov.addTo(map) : map.removeLayer(prov);
      [['tabla2', 'toggle-tabla2'], ['tabla3', 'toggle-tabla3'], ['tabla4', 'toggle-tabla4']].forEach(([k, id]) => {
        const el = document.getElementById(id), lyr = layers[k];
        el.onchange = () => el.checked ? lyr.addTo(map) : map.removeLayer(lyr);
      });

      setupSearch();

      const bounds = L.latLngBounds([]);
      prov.eachLayer(l => { try { bounds.extend(l.getBounds()); } catch (e) { } });
      [l1, l2, l3, l4].forEach(lyr => lyr && lyr.getLayers().forEach(m => { if (m.getLatLng) bounds.extend(m.getLatLng()); }));
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.12));

    } catch (e) {
      console.error('Error en inicialización:', e);
      setStatus('❌ Error al cargar el geovisor.');
    }
  })();
})();
