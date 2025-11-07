(() => {
  const map = L.map('map').setView([-1.83, -78.18], 6);
  const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
  L.control.layers({ 'OSM': baseOSM, 'Satélite': baseSat }).addTo(map);

  const statusBox = document.getElementById('status');
  const setStatus = (msg) => statusBox.innerHTML = msg;

  // Estado global para búsqueda
  const searchState = {
    allData: [], // Todos los datos cargados con sus coordenadas y capas
    currentHighlight: null // Marcador actual destacado
  };

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

  function popupInstitucion(row) {
    const keys = Object.keys(row);
    const by = (k, ...alts) => {
      const targets = [k, ...alts].map(s => String(s).toLowerCase());
      return keys.find(c => c && targets.includes(c.toLowerCase()));
    };
    const get = k => (k && row[k] != null && String(row[k]).trim() !== '') ? row[k] : '—';
    
    const amieK = by('amie');
    const nombreK = by('nom_institucion_educativa', 'nombre', 'institucion');
    const sostK = by('nom_sostenimiento', 'sostenimiento', 'te_fin');
    const regK = by('regimen', 'régimen');
    const provK = by('dpa_despro', 'provincia');
    const zonaK = by('da_zona', 'zona');
    
    return `<div>
      <b>AMIE:</b> ${get(amieK)}<br>
      <b>Nombre:</b> ${get(nombreK)}<br>
      <b>Sostenimiento:</b> ${get(sostK)}<br>
      <b>Régimen:</b> ${get(regK)}<br>
      <b>Provincia:</b> ${get(provK)}<br>
      <b>Zona:</b> ${get(zonaK)}
    </div>`;
  }

  function popupGeneric(row) {
    return Object.entries(row)
      .filter(([k, v]) => v != null && String(v).trim() !== '')
      .slice(0, 16)
      .map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>');
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

  // Función para extraer el nombre de un registro
  function extractName(row, tableType) {
    const keys = Object.keys(row);
    const by = (...alts) => {
      const targets = alts.map(s => String(s).toLowerCase());
      return keys.find(c => c && targets.includes(c.toLowerCase()));
    };

    let nameKey;
    if (tableType === 'tabla1') {
      nameKey = by('nom_institucion_educativa', 'nombre', 'institucion');
    } else {
      // Para tabla2, tabla3, tabla4
      nameKey = by('nombre', 'nom_institucion_educativa', 'denominacion', 'institucion', 'establecimiento');
    }

    if (nameKey && row[nameKey]) {
      return String(row[nameKey]).trim();
    }
    return 'Sin nombre';
  }

  // Función para extraer información adicional del registro
  function extractInfo(row) {
    const keys = Object.keys(row);
    const by = (...alts) => {
      const targets = alts.map(s => String(s).toLowerCase());
      return keys.find(c => c && targets.includes(c.toLowerCase()));
    };

    const provKey = by('dpa_despro', 'provincia', 'prov');
    const cantKey = by('dpa_descan', 'canton', 'cant');
    const zonaKey = by('da_zona', 'zona');

    const info = [];
    if (provKey && row[provKey]) info.push(row[provKey]);
    if (cantKey && row[cantKey]) info.push(row[cantKey]);
    if (zonaKey && row[zonaKey]) info.push(row[zonaKey]);

    return info.join(' • ');
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

      const marker = L.circleMarker([lat, lon], {
        radius: 5,
        fillColor: config.LAYER_STYLE.tabla1.color,
        color: '#fff',
        weight: 1,
        fillOpacity: .9
      }).bindPopup(popupInstitucion(row));

      layer.addLayer(marker);

      // Guardar en el estado de búsqueda
      searchState.allData.push({
        name: extractName(row, 'tabla1'),
        info: extractInfo(row),
        lat: lat,
        lon: lon,
        marker: marker,
        layer: layer,
        type: 'tabla1',
        typeName: '🏫 Institución',
        row: row
      });

      ok++;
    }
    
    map.addLayer(layer);
    setStatus(`✓ Instituciones: ${ok} puntos (omitidos ${bad}).`);
    return layer;
  }

  async function loadGeneric(path, color, classKey, nombre, typeName) {
    try {
      const data = await loadCSV(path);
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

        const marker = L.circleMarker([lat, lon], {
          radius: 5,
          fillColor: color,
          color: '#fff',
          weight: 1,
          fillOpacity: .9
        }).bindPopup(popupGeneric(row));

        layer.addLayer(marker);

        // Guardar en el estado de búsqueda
        searchState.allData.push({
          name: extractName(row, classKey),
          info: extractInfo(row),
          lat: lat,
          lon: lon,
          marker: marker,
          layer: layer,
          type: classKey,
          typeName: typeName,
          row: row
        });

        ok++;
      }

      console.log(`${nombre}: ${ok} puntos cargados`);
      return layer;
    } catch (e) {
      console.error(`Error cargando ${nombre}:`, e);
      return L.markerClusterGroup();
    }
  }

  // Función para resaltar un marcador en el mapa
  function highlightMarker(item) {
    // Remover highlight anterior
    if (searchState.currentHighlight) {
      map.removeLayer(searchState.currentHighlight);
    }

    // Crear marcador temporal de highlight
    const highlight = L.circleMarker([item.lat, item.lon], {
      radius: 15,
      fillColor: '#ffff00',
      color: '#ff0000',
      weight: 3,
      fillOpacity: 0.4,
      className: 'marker-highlight'
    }).addTo(map);

    searchState.currentHighlight = highlight;

    // Hacer zoom al punto
    map.setView([item.lat, item.lon], 16, { animate: true });

    // Abrir popup del marcador original
    setTimeout(() => {
      item.marker.openPopup();
    }, 500);

    // Remover highlight después de 5 segundos
    setTimeout(() => {
      if (searchState.currentHighlight === highlight) {
        map.removeLayer(highlight);
        searchState.currentHighlight = null;
      }
    }, 5000);
  }

  // Función para realizar la búsqueda
  function performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    
    if (!query || query.length < 2) {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('has-results');
      return;
    }

    const searchTerm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const results = searchState.allData.filter(item => {
      const name = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const info = item.info.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return name.includes(searchTerm) || info.includes(searchTerm);
    });

    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-no-results">No se encontraron resultados</div>';
      resultsContainer.classList.add('has-results');
      return;
    }

    // Limitar a 50 resultados para rendimiento
    const limitedResults = results.slice(0, 50);
    
    resultsContainer.innerHTML = limitedResults.map(item => `
      <div class="search-result-item" data-lat="${item.lat}" data-lon="${item.lon}">
        <div class="search-result-type ${item.type}">${item.typeName}</div>
        <div class="search-result-name">${item.name}</div>
        <div class="search-result-details">${item.info}</div>
      </div>
    `).join('');

    resultsContainer.classList.add('has-results');

    // Agregar event listeners a los resultados
    resultsContainer.querySelectorAll('.search-result-item').forEach((el, index) => {
      el.addEventListener('click', () => {
        highlightMarker(limitedResults[index]);
      });
    });

    if (results.length > 50) {
      resultsContainer.innerHTML += `<div class="search-no-results">Mostrando 50 de ${results.length} resultados</div>`;
    }
  }

  // Configurar el buscador
  function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    const resultsContainer = document.getElementById('search-results');

    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      // Mostrar/ocultar botón de limpiar
      clearBtn.style.display = query ? 'block' : 'none';

      // Debounce para mejor rendimiento
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 300);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('has-results');
      
      // Remover highlight si existe
      if (searchState.currentHighlight) {
        map.removeLayer(searchState.currentHighlight);
        searchState.currentHighlight = null;
      }
    });

    // Cerrar resultados al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container') && !e.target.closest('.search-results')) {
        // No cerrar, solo dejar abierto
      }
    });
  }

  (async () => {
    try {
      // Provincias
      const gj = await (await fetch(config.GEOJSON)).json();
      const prov = L.geoJSON(gj, { style: { color: '#7aa2ff', weight: 1, fillOpacity: 0 } }).addTo(map);

      // Instituciones SIEMPRE
      const l1 = await loadInstituciones();

      // Resto con toggles
      const l2 = await loadGeneric(config.CSV.tabla2, config.LAYER_STYLE.tabla2.color, 'tabla2', 'Cultura', '📚 Cultura');
      const l3 = await loadGeneric(config.CSV.tabla3, config.LAYER_STYLE.tabla3.color, 'tabla3', 'Deporte', '⚽ Deporte');
      const l4 = await loadGeneric(config.CSV.tabla4, config.LAYER_STYLE.tabla4.color, 'tabla4', 'Universidades', '🎓 Universidad');

      const layers = { tabla2: l2, tabla3: l3, tabla4: l4 };
      Object.values(layers).forEach(l => map.addLayer(l));

      // Configurar buscador
      setupSearch();

      // Toggles
      document.getElementById('toggle-prov').onchange = e => e.target.checked ? prov.addTo(map) : map.removeLayer(prov);
      [['tabla2', 'toggle-tabla2'], ['tabla3', 'toggle-tabla3'], ['tabla4', 'toggle-tabla4']].forEach(([k, id]) => {
        const el = document.getElementById(id), lyr = layers[k];
        el.onchange = () => el.checked ? lyr.addTo(map) : map.removeLayer(lyr);
      });

      // Fit bounds
      const bounds = L.latLngBounds([]);
      prov.eachLayer(l => { try { bounds.extend(l.getBounds()); } catch (e) { } });
      [l1, l2, l3, l4].forEach(lyr => lyr && lyr.getLayers().forEach(m => { if (m.getLatLng) bounds.extend(m.getLatLng()); }));
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.12));

      setStatus('✓ Geovisor cargado correctamente. Use el buscador para encontrar ubicaciones.');

    } catch (e) {
      console.error('Error en inicialización:', e);
      setStatus('❌ Error al cargar el geovisor.');
    }
  })();
})();
