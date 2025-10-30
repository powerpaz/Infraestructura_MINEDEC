(() => {
  const cfg = config;

  // Basemaps
  const base_OSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'});
  const base_SAT = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
  const base_DARK = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; OSM & CARTO'});

  const map = L.map('map',{zoomControl:false,preferCanvas:true,layers:[base_DARK]}).setView([-1.8312,-78.1834],6);
  L.control.layers({Dark:base_DARK, OSM:base_OSM, Satélite:base_SAT}, {}, {position:'topleft',collapsed:true}).addTo(map);
  L.control.zoom({ position:'bottomright' }).addTo(map);

  document.getElementById('source-mode').textContent = cfg.USE_SUPABASE ? 'Supabase (REST)' : 'CSV locales';
  document.getElementById('reload').addEventListener('click', ()=> bootstrap());

  // Drawer móvil
  const menuBtn = document.getElementById('menuBtn');
  menuBtn.addEventListener('click', ()=>{ document.body.classList.toggle('drawer-open'); setTimeout(()=>map.invalidateSize(),260); });

  async function fetchSupabase(table){
    const url = `${cfg.SUPABASE_URL}/rest/v1/${table}?select=*`;
    const res = await fetch(url,{ headers:{ apikey: cfg.SUPABASE_ANON_KEY, Authorization:`Bearer ${cfg.SUPABASE_ANON_KEY}` } });
    if(!res.ok) throw new Error('Supabase error'); return res.json();
  }
  function fetchCSV(path){
    return new Promise((resolve,reject)=> Papa.parse(path,{download:true,header:true,dynamicTyping:true,skipEmptyLines:true,complete:r=>resolve(r.data),error:reject}) );
  }
  async function getRecords(key){ return cfg.USE_SUPABASE ? fetchSupabase(cfg.TABLES[key]) : fetchCSV(cfg.CSV[key]); }

  function toFloat(v){ const n = Number(v); return isFinite(n)?n:null; }

  function makePopupContent(props){
    const titleField = cfg.TITLE_FIELDS.find(k=>k in props && props[k]);
    const title = titleField ? String(props[titleField]) : 'Registro';
    const rows = Object.entries(props).filter(([k,v])=>!cfg.EXCLUDE_FIELDS.includes(String(k).toLowerCase())).filter(([k,v])=>v!==null && v!==undefined && String(v).trim()!=='').slice(0,16);
    const tr = rows.map(([k,v])=>`<tr><td class="k">${k}</td><td>${String(v)}</td></tr>`).join('');
    return `<div class="popup"><h4>${title}</h4><table>${tr}</table></div>`;
  }

  function circleMarker(latlng,color){
    return L.circleMarker(latlng,{radius:6,color:'rgba(255,255,255,.25)',weight:1,fillColor:color,fillOpacity:.9});
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

  function clearPointLayers(){ ['tabla1','tabla2','tabla3','tabla4'].forEach(k=>layers[k].layer.clearLayers()); }

  async function loadProvincias(){
    const res = await fetch(cfg.GEOJSON); const gj = await res.json();
    if(layers.prov) map.removeLayer(layers.prov);
    layers.prov = L.geoJSON(gj,{ style:{ color:'#7aa2ff', weight:1, fillOpacity:0 } }).addTo(map);
  }

  async function loadLayer(key){
    const color = cfg.LAYER_STYLE[key].color;
    const data = await getRecords(key);
    const latK = cfg.COORDS.lat, lonK = cfg.COORDS.lon;
    const markers = [];
    for(const row of data){
      const lat = toFloat(row[latK]), lon = toFloat(row[lonK]); if(lat==null||lon==null) continue;
      const m = circleMarker([lat,lon], color).bindPopup(makePopupContent(row), {maxWidth:360});
      markers.push(m);
    }
    layers[key].layer.addLayers(markers);
  }

  async function bootstrap(){
    clearPointLayers();
    await loadProvincias();
    Object.values(layers).forEach(l=>{ if(l && l.layer) l.layer.addTo(map); });
    [['tabla1','toggle-tabla1'],['tabla2','toggle-tabla2'],['tabla3','toggle-tabla3'],['tabla4','toggle-tabla4']]
      .forEach(([k,id])=>{ const el=document.getElementById(id); const lyr=layers[k].layer; el.onchange=()=>{ if(el.checked) lyr.addTo(map); else map.removeLayer(lyr); }; });
    document.getElementById('toggle-prov').onchange = (e)=>{ if(e.target.checked){ layers.prov.addTo(map);} else { map.removeLayer(layers.prov);} };
    await Promise.all([loadLayer('tabla1'),loadLayer('tabla2'),loadLayer('tabla3'),loadLayer('tabla4')]);
    const bounds=L.latLngBounds([]); Object.values(layers).forEach(l=>{ if(l && l.layer){ l.layer.getLayers().forEach(m=>bounds.extend(m.getLatLng&&m.getLatLng())); }});
    if(bounds.isValid()) map.fitBounds(bounds.pad(0.12));
  }
  bootstrap();
})();