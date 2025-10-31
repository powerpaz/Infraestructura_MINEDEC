(() => {
  const cfg = config;

  // Basemaps
  const base_OSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'});
  const base_SAT = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
  const base_DARK = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; OSM & CARTO'});

  const map = L.map('map',{zoomControl:false,preferCanvas:true,layers:[base_DARK]}).setView([-1.8312,-78.1834],6);
  L.control.layers({Dark:base_DARK, OSM:base_OSM, Satélite:base_SAT}, {}, {position:'topleft',collapsed:true}).addTo(map);
  L.control.zoom({ position:'bottomright' }).addTo(map);

  // Drawer móvil
  const menuBtn = document.getElementById('menuBtn');
  menuBtn.addEventListener('click', ()=>{ document.body.classList.toggle('drawer-open'); setTimeout(()=>map.invalidateSize(),260); });

  // ---- Utils ----
  function toNum(v){ const n = Number(v); return isFinite(n)?n:null; }

  // Detección: ¿parecen grados decimales válidos en Ecuador?
  function looksLikeEcuador(lat, lon){
    return lat!=null && lon!=null && lat>-6 && lat<2 && lon>-92.5 && lon<-74;
  }

  // Intentar reproyectar UTM a WGS84 probando zonas 16S-18S (Galápagos y Costa suelen ser 16/17/18)
  function fromUTMToWGS84(x, y){
    if(x==null||y==null) return null;
    const zones = [32716, 32717, 32718]; // EPSG 16S, 17S, 18S
    for(const epsg of zones){
      const def = `+proj=utm +zone=${epsg-32700} +south +datum=WGS84 +units=m +no_defs`;
      try{
        const [lon, lat] = proj4(def, proj4.WGS84, [x, y]);
        if(looksLikeEcuador(lat, lon)) return [lat, lon];
      }catch(e){/* ignore */}
    }
    return null;
  }

  // Carga GeoJSON de provincias
  async function loadProvincias(){
    const res = await fetch(cfg.GEOJSON); const gj = await res.json();
    return L.geoJSON(gj,{ style:{ color:'#7aa2ff', weight:1, fillOpacity:0 } });
  }

  // Cargar CSV genérico
  function loadCSV(path){ return new Promise((resolve,reject)=> Papa.parse(path,{download:true,header:true,dynamicTyping:true,skipEmptyLines:true,complete:r=>resolve(r.data),error:reject}) ); }

  function circleMarker(latlng,color){
    return L.circleMarker(latlng,{radius:6,color:'rgba(255,255,255,.25)',weight:1,fillColor:color,fillOpacity:.9});
  }

  function makePopupContent(props){
    const titleField = cfg.TITLE_FIELDS.find(k=>k in props && props[k]);
    const title = titleField ? String(props[titleField]) : 'Registro';
    const rows = Object.entries(props).filter(([k,v])=>!cfg.EXCLUDE_FIELDS.includes(String(k).toLowerCase())).filter(([k,v])=>v!==null && v!==undefined && String(v).trim()!=='').slice(0,16);
    const tr = rows.map(([k,v])=>`<tr><td class="k">${k}</td><td>${String(v)}</td></tr>`).join('');
    return `<div class="popup"><h4>${title}</h4><table>${tr}</table></div>`;
  }

  function makeClusterGroup(key){
    return L.markerClusterGroup({
      chunkedLoading:true,maxClusterRadius:60,removeOutsideVisibleBounds:true,spiderfyDistanceMultiplier:1.2,
      iconCreateFunction:(cluster)=>{
        const count = cluster.getChildCount();
        let size='small'; if(count>=50) size='large'; else if(count>=15) size='medium';
        const div=document.createElement('div'); div.innerHTML=`<span>${count}</span>`;
        return L.divIcon({ html:div, className:`marker-cluster marker-cluster-${size} cluster--${key}`, iconSize:L.point(40,40)});
      }
    });
  }

  const layers = {
    prov: null,
    tabla1: { key:'tabla1', layer: makeClusterGroup('tabla1') },
    tabla2: { key:'tabla2', layer: makeClusterGroup('tabla2') },
    tabla3: { key:'tabla3', layer: makeClusterGroup('tabla3') },
    tabla4: { key:'tabla4', layer: makeClusterGroup('tabla4') },
  };

  async function loadLayerCSV(key, path, color){
    const data = await loadCSV(path);
    const latK = cfg.COORDS.lat, lonK = cfg.COORDS.lon;
    const markers = [];
    for(const row of data){
      let lat = toNum(row[latK]), lon = toNum(row[lonK]);

      // Si vienen en grados, usarlos
      if(!looksLikeEcuador(lat, lon)){
        // Probar con X/Y (UTM) si existen
        const x = toNum(row.x ?? row.X ?? row.coord_x);
        const y = toNum(row.y ?? row.Y ?? row.coord_y);
        if(x!=null && y!=null){
          const out = fromUTMToWGS84(x, y);
          if(out){ lat = out[0]; lon = out[1]; }
        }
      }

      if(looksLikeEcuador(lat, lon)){
        const m = circleMarker([lat, lon], color).bindPopup(makePopupContent(row), {maxWidth:360});
        markers.push(m);
      }
    }
    layers[key].layer.addLayers(markers);
  }

  async function bootstrap(){
    // Provincias
    if(layers.prov) map.removeLayer(layers.prov);
    layers.prov = await loadProvincias();
    layers.prov.addTo(map);

    // Agregar grupos al mapa
    Object.values(layers).forEach(l=>{ if(l && l.layer) l.layer.addTo(map); });

    // Cargar CSVs (tabla1 con reproyección automática si la necesita)
    await Promise.all([
      loadLayerCSV('tabla1', cfg.CSV.tabla1, cfg.LAYER_STYLE.tabla1.color),
      loadLayerCSV('tabla2', cfg.CSV.tabla2, cfg.LAYER_STYLE.tabla2.color),
      loadLayerCSV('tabla3', cfg.CSV.tabla3, cfg.LAYER_STYLE.tabla3.color),
      loadLayerCSV('tabla4', cfg.CSV.tabla4, cfg.LAYER_STYLE.tabla4.color),
    ]);

    // Toggles
    [['tabla1','toggle-tabla1'],['tabla2','toggle-tabla2'],['tabla3','toggle-tabla3'],['tabla4','toggle-tabla4']]
      .forEach(([k,id])=>{ const el=document.getElementById(id); const lyr=layers[k].layer; el.onchange=()=>{ if(el.checked) lyr.addTo(map); else map.removeLayer(lyr); }; });
    document.getElementById('toggle-prov').onchange = (e)=>{ if(e.target.checked){ layers.prov.addTo(map);} else { map.removeLayer(layers.prov);} };

    // Fit bounds
    const bounds=L.latLngBounds([]);
    Object.values(layers).forEach(l=>{ if(l && l.layer){ l.layer.getLayers().forEach(m=>{ if(m.getLatLng) bounds.extend(m.getLatLng()); }); }});
    if(bounds.isValid()) map.fitBounds(bounds.pad(0.12));
  }

  bootstrap();
})();