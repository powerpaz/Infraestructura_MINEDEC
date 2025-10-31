(() => {
  const cfg = config;
  document.getElementById('srcMode').textContent = cfg.USE_SUPABASE ? 'Supabase REST' : 'CSV locales';
  document.getElementById('reload').addEventListener('click', () => location.reload());

  // Basemaps
  const base_OSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19});
  const base_SAT = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
  const base_DARK = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19});
  const map = L.map('map',{layers:[base_DARK]}).setView([-1.8312,-78.1834],6);
  L.control.layers({Dark:base_DARK, OSM:base_OSM, Satélite:base_SAT},{},{collapsed:true}).addTo(map);

  // Utils
  const toNum=(v)=>{ if(v==null) return NaN; if(typeof v==='string'){ v=v.replace(',','.'); } const n=Number(v); return Number.isFinite(n)?n:NaN; };
  const looksEC=(lat,lon)=> Number.isFinite(lat)&&Number.isFinite(lon)&&lat>-6&&lat<2&&lon>-92.6&&lon<-74;

  // Probar UTM zonas 16S/17S/18S si hiciera falta
  function utmToWGS(x,y){
    const zones=[32716,32717,32718];
    for(const epsg of zones){
      const def = `+proj=utm +zone=${epsg-32700} +south +datum=WGS84 +units=m +no_defs`;
      try{
        const out = proj4(def, proj4.WGS84, [x,y]);
        const lon=out[0], lat=out[1];
        if(looksEC(lat,lon)) return [lat,lon];
      }catch(e){}
    }
    return null;
  }

  function detectLatLon(row){
    const keys = Object.keys(row);
    const by = k => keys.find(c => c && c.toLowerCase()===k);
    let lat = toNum(row[by('latitud')]); let lon = toNum(row[by('longitud')]);
    if(!looksEC(lat,lon)){
      // invertir si vinieron al revés
      const lat2 = toNum(row[by('longitud')]); const lon2 = toNum(row[by('latitud')]);
      if(looksEC(lat2,lon2)){ lat=lat2; lon=lon2; }
    }
    if(!looksEC(lat,lon)){
      // intentar con X/Y (UTM)
      const xk = by('x')||by('coord_x'); const yk = by('y')||by('coord_y');
      const x = toNum(row[xk]); const y = toNum(row[yk]);
      if(Number.isFinite(x)&&Number.isFinite(y)){ const out=utmToWGS(x,y); if(out){ lat=out[0]; lon=out[1]; } }
    }
    return looksEC(lat,lon) ? [lat,lon] : null;
  }

  function makeCluster(classKey){
    return L.markerClusterGroup({
      iconCreateFunction:c=>{
        const n=c.getChildCount();
        const div=document.createElement('div'); div.innerHTML=`<span>${n}</span>`;
        return L.divIcon({html:div,className:`marker-cluster cluster--${classKey}`,iconSize:L.point(40,40)});
      }
    });
  }

  // Data loaders
  async function fetchSupabase(table){
    const url = `${cfg.SUPABASE_URL}/rest/v1/${table}?select=*`;
    const res = await fetch(url,{ headers:{ apikey: cfg.SUPABASE_ANON_KEY, Authorization:`Bearer ${cfg.SUPABASE_ANON_KEY}` } });
    if(!res.ok) throw new Error('Supabase '+res.status);
    return await res.json();
  }
  function fetchCSV(path){ return new Promise((resolve,reject)=> Papa.parse(path,{download:true,header:true,skipEmptyLines:true,complete:r=>resolve(r.data),error:reject})); }

  async function getRecords(key){
    try{
      if(cfg.USE_SUPABASE) return await fetchSupabase(cfg.TABLES[key]);
      return await fetchCSV(cfg.CSV[key]);
    }catch(e){
      console.warn('Fallo origen principal, usando fallback CSV:', e);
      return await fetchCSV(cfg.CSV[key]);
    }
  }

  async function loadProvincias(){
    const gj = await (await fetch(cfg.GEOJSON)).json();
    return L.geoJSON(gj,{style:{color:'#7aa2ff',weight:1,fillOpacity:0}});
  }

  function circleMarker(latlng,color){
    return L.circleMarker(latlng,{radius:5,fillColor:color,color:'#fff',weight:1,fillOpacity:.9});
  }

  function popupFor(row){
    const entries = Object.entries(row)
      .filter(([k,v])=> v!=null && String(v).trim()!=='')
      .slice(0,16);
    return entries.map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br>');
  }

  const layers = {
    prov: null,
    tabla1: { layer: makeCluster('tabla1'), color: cfg.LAYER_STYLE.tabla1.color },
    tabla2: { layer: makeCluster('tabla2'), color: cfg.LAYER_STYLE.tabla2.color },
    tabla3: { layer: makeCluster('tabla3'), color: cfg.LAYER_STYLE.tabla3.color },
    tabla4: { layer: makeCluster('tabla4'), color: cfg.LAYER_STYLE.tabla4.color },
  };

  async function loadPoints(key){
    const data = await getRecords(key);
    const color = layers[key].color;
    const cluster = layers[key].layer;
    cluster.clearLayers();
    let count=0;
    for(const row of data){
      const ll = detectLatLon(row);
      if(!ll) continue;
      cluster.addLayer(circleMarker(ll, color).bindPopup(popupFor(row)));
      count++;
    }
    // console.log(key,'cargados',count);
  }

  (async()=>{
    layers.prov = await loadProvincias();
    layers.prov.addTo(map);
    Object.values(layers).forEach(l=>{ if(l.layer) l.layer.addTo(map); });

    await Promise.all([loadPoints('tabla1'), loadPoints('tabla2'), loadPoints('tabla3'), loadPoints('tabla4')]);

    // UI toggles
    document.getElementById('toggle-prov').onchange = e => e.target.checked ? layers.prov.addTo(map) : map.removeLayer(layers.prov);
    [['tabla1','toggle-tabla1'],['tabla2','toggle-tabla2'],['tabla3','toggle-tabla3'],['tabla4','toggle-tabla4']].forEach(([k,id])=>{
      const el=document.getElementById(id), lyr=layers[k].layer;
      el.onchange=()=> el.checked ? lyr.addTo(map) : map.removeLayer(lyr);
    });

    // Fit bounds
    const bounds=L.latLngBounds([]);
    try{ layers.prov.eachLayer(l=>bounds.extend(l.getBounds())); }catch(e){}
    Object.values(layers).forEach(l=> l.layer.getLayers().forEach(m=>{ if(m.getLatLng) bounds.extend(m.getLatLng()); }));
    if(bounds.isValid()) map.fitBounds(bounds.pad(0.12));
  })();

})();