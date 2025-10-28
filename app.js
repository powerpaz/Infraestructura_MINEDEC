(function(){
  const CFG = window.APP_CONFIG;
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPA_TABLES, LOCAL_CSV, GEOJSON } = CFG;

  const COLMAP = {
    lat:["Latitud","lat","LAT","Y","y"],
    lon:["Longitud","lon","LON","X","x"],
    prov:["DPA_DESPRO","PROVINCIA","Provincia"],
    canton:["DPA_DESCAN","CANTON","Cantón","Canton"],
    parroq:["DPA_DESPAR","PARROQUIA","Parroquia"],
    tipo:["TIPO","CATEGORIA","TIPO_FINAN","CLASE","TIPO_INST"],
    nombre:["NOMBRE_IES","NOMBRE","NOMBRE_INST","INSTITUCION","DENOMINACION","Nombre"]
  };

  const LAYER_STYLE = { t1:{color:"#4cc9f0"}, t2:{color:"#90e0ef"}, t3:{color:"#ffd166"}, t4:{color:"#a0e467"} };

  const state = {
    supabase: null,
    data: { t1: [], t2: [], t3: [], t4: [] },
    filters: {
      t1: {prov:null,canton:null,parroq:null,tipo:null},
      t2: {prov:null,canton:null,parroq:null,tipo:null},
      t3: {prov:null,canton:null,parroq:null,tipo:null},
      t4: {prov:null,canton:null,parroq:null,tipo:null}
    },
    clusters: { t1: null, t2: null, t3: null, t4: null },
    base: { provincias: null, vias: null }
  };

  // ====== MAPA y CAPAS BASE ======
  const map = L.map('map', { zoomControl: true }).setView([-1.83, -78.18], 6);

  // Base layers
  const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  });

  const baseESRISat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  const baseLayers = {
    "OSM Estándar": baseOSM,
    "Satélite (Esri World Imagery)": baseESRISat
  };

  baseOSM.addTo(map);

  // Layer control (se agregan overlays más abajo cuando estén cargados)
  const overlays = {};
  const layersCtrl = L.control.layers(baseLayers, overlays, { position: 'topright', collapsed: false }).addTo(map);

  // ===== Utils =====
  const log = (...a)=>console.log('[MAPA]',...a);
  const warn = (...a)=>console.warn('[MAPA]',...a);
  window.addEventListener('error', (e)=>console.error('JS error:', e.message));

  function firstExisting(obj, keys){ for (const k of keys) if (obj?.hasOwnProperty(k) && obj[k]!==undefined && obj[k]!==null && obj[k]!=='') return k; return null; }
  function detectColumns(row){ return {
      lat:firstExisting(row,COLMAP.lat), lon:firstExisting(row,COLMAP.lon),
      prov:firstExisting(row,COLMAP.prov), canton:firstExisting(row,COLMAP.canton),
      parroq:firstExisting(row,COLMAP.parroq), tipo:firstExisting(row,COLMAP.tipo),
      nombre:firstExisting(row,COLMAP.nombre)
  };}
  function toFloat(v){ if(v===undefined||v===null||v==='')return null; const n=parseFloat((''+v).replace(',','.')); return Number.isFinite(n)?n:null; }
  function uniqueValues(arr, key){ const set=new Set(arr.map(r=>r[key]).filter(v=>v!==undefined&&v!==null&&v!=='')); return ['(Todos)', ...Array.from(set).sort((a,b)=>(''+a).localeCompare(''+b))]; }
  function fillSelect(id, vals){ const el=document.getElementById(id); if(!el) return; el.innerHTML = vals.map(v=>`<option value="${String(v)}">${v}</option>`).join(''); el.value='(Todos)'; }
  function buildPopup(row){
    const c=detectColumns(row);
    const nombre=c.nombre?row[c.nombre]:'(Sin nombre)';
    const prov=c.prov?row[c.prov]:'';
    const canton=c.canton?row[c.canton]:'';
    const parroq=c.parroq?row[c.parroq]:'';
    const tipo=c.tipo?row[c.tipo]:'';
    const extrasKeys=['DPA_ANIO','BASE','CODIGO_IES','TIPO_FINAN'].filter(k=>row.hasOwnProperty(k)&&row[k]!==''&&row[k]!==null&&row[k]!==undefined);
    const extras=extrasKeys.map(k=>`<div>${k.replaceAll('_',' ')}:</div><div>${row[k]}</div>`).join('');
    return `<div class="popup">
      <div class="popup-title">${nombre}</div>
      <div class="popup-grid">
        ${prov?`<div>Provincia:</div><div>${prov}</div>`:''}
        ${canton?`<div>Cantón:</div><div>${canton}</div>`:''}
        ${parroq?`<div>Parroquia:</div><div>${parroq}</div>`:''}
        ${tipo?`<div>Tipo:</div><div>${tipo}</div>`:''}
        ${extras}
      </div>
    </div>`;
  }

  function makeCluster(data, code, label){
    if (state.clusters[code]) { map.removeLayer(state.clusters[code]); delete overlays[label]; }
    const cluster = L.markerClusterGroup({ showCoverageOnHover:false, disableClusteringAtZoom:15, chunkedLoading:true });
    data.forEach(row=>{
      const c=detectColumns(row);
      const lat=toFloat(c.lat?row[c.lat]:null);
      const lon=toFloat(c.lon?row[c.lon]:null);
      if(lat===null || lon===null) return;
      const marker=L.circleMarker([lat,lon], { radius:6, color:LAYER_STYLE[code].color, weight:2, fillOpacity:0.6 });
      marker.bindPopup(buildPopup(row));
      cluster.addLayer(marker);
    });
    state.clusters[code]=cluster;
    overlays[label]=cluster;
    layersCtrl.addOverlay(cluster, label);
    if (document.getElementById(code+'-toggle')?.checked) cluster.addTo(map);
  }

  function applyFilters(code, label){
    const rows = state.data[code];
    const f = state.filters[code];
    const filtered = rows.filter(r=>{
      const c=detectColumns(r);
      const prov=c.prov?r[c.prov]:null;
      const canton=c.canton?r[c.canton]:null;
      const parroq=c.parroq?r[c.parroq]:null;
      const tipo=c.tipo?r[c.tipo]:null;
      const okProv=!f.prov || f.prov==='(Todos)' || prov===f.prov;
      const okCanton=!f.canton || f.canton==='(Todos)' || canton===f.canton;
      const okParroq=!f.parroq || f.parroq==='(Todos)' || parroq===f.parroq;
      const okTipo=!f.tipo || f.tipo==='(Todos)' || tipo===f.tipo;
      return okProv && okCanton && okParroq && okTipo;
    });
    makeCluster(filtered, code, label);
  }

  function initCombos(code){
    const rows=state.data[code];
    if(!rows || !rows.length) return;
    const c=detectColumns(rows[0]);
    function tf(id,key){ const el=document.getElementById(id); if(!el) return; if(!key){ el.parentElement.style.display='none'; return; } fillSelect(id, uniqueValues(rows,key)); }
    if(code==='t1'){ tf('t1-prov',c.prov); tf('t1-canton',c.canton); tf('t1-parroquia',c.parroq); tf('t1-tipo',c.tipo); }
    if(code==='t2'){ tf('t2-prov',c.prov); tf('t2-canton',c.canton); tf('t2-parroquia',c.parroq); tf('t2-tipo',c.tipo); }
    if(code==='t3'){ tf('t3-prov',c.prov); tf('t3-canton',c.canton); tf('t3-parroquia',c.parroq); tf('t3-tipo',c.tipo); }
    if(code==='t4'){ tf('t4-prov',c.prov); tf('t4-canton',c.canton); tf('t4-parroquia',c.parroq); tf('t4-tipo',c.tipo); }
  }

  function hookEvents(){
    [['t1','Tabla 1 – IES'],['t2','Tabla 2 – Cultura'],['t3','Tabla 3 – Deporte'],['t4','Tabla 4 – Sup./Tec.']].forEach(([code,label])=>{
      document.getElementById(code+'-apply').onclick=()=>{
        state.filters[code].prov=document.getElementById(code+'-prov')?.value;
        state.filters[code].canton=document.getElementById(code+'-canton')?.value;
        state.filters[code].parroq=document.getElementById(code+'-parroquia')?.value;
        state.filters[code].tipo=document.getElementById(code+'-tipo')?.value;
        applyFilters(code,label);
      };
      document.getElementById(code+'-clear').onclick=()=>{
        [code+'-prov',code+'-canton',code+'-parroquia',code+'-tipo'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='(Todos)';});
        state.filters[code]={prov:null,canton:null,parroq:null,tipo:null};
        applyFilters(code,label);
      };
      document.getElementById(code+'-toggle').onchange=(e)=>{
        const layer = state.clusters[code];
        if(!layer) return;
        if(e.target.checked) layer.addTo(map); else map.removeLayer(layer);
      };
    });
  }

  // ===== Data loaders =====
  const useSupabase = () => (typeof SUPABASE_URL==='string' && SUPABASE_URL) && (typeof SUPABASE_ANON_KEY==='string' && SUPABASE_ANON_KEY);
  async function fetchSupabase(table){
    const client = state.supabase || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await client.from(table).select('*').range(0,9999);
    if(error){ warn('Supabase error', error); return []; }
    state.supabase = client;
    return data||[];
  }
  function fetchCSV(path){
    return new Promise(resolve=>{
      Papa.parse(path, { header:true, download:true, dynamicTyping:false, complete:r=>resolve(r.data), error:()=>resolve([])});
    });
  }

  async function loadGeoJSON(){
    try{
      const prov = await fetch(GEOJSON.provincias).then(r=>r.json());
      state.base.provincias = L.geoJSON(prov, { style:{ color:'#355070', weight:1, fillOpacity:0.05 } }).addTo(map);
      layersCtrl.addOverlay(state.base.provincias, 'Provincias');
    } catch(e){ warn('Provincias GeoJSON no disponible', e); }
    try{
      const vias = await fetch(GEOJSON.vias).then(r=>r.json());
      state.base.vias = L.geoJSON(vias, { style:{ color:'#9b5de5', weight:2, opacity:0.7 } }).addTo(map);
      layersCtrl.addOverlay(state.base.vias, 'Vías principales');
    } catch(e){ warn('Vías GeoJSON no disponible', e); }
  }

  async function loadAll(){
    try{
      if (useSupabase()){
        state.data.t1 = await fetchSupabase(SUPA_TABLES.t1);
        state.data.t2 = await fetchSupabase(SUPA_TABLES.t2);
        state.data.t3 = await fetchSupabase(SUPA_TABLES.t3);
        state.data.t4 = await fetchSupabase(SUPA_TABLES.t4);
      } else {
        state.data.t1 = await fetchCSV(LOCAL_CSV.t1);
        state.data.t2 = await fetchCSV(LOCAL_CSV.t2);
        state.data.t3 = await fetchCSV(LOCAL_CSV.t3);
        state.data.t4 = await fetchCSV(LOCAL_CSV.t4);
      }
    } catch(e){ warn('Error cargando datos', e); }

    [['t1','Tabla 1 – IES'],['t2','Tabla 2 – Cultura'],['t3','Tabla 3 – Deporte'],['t4','Tabla 4 – Sup./Tec.']].forEach(([code,label])=>{
      initCombos(code);
      applyFilters(code,label);
    });

    hookEvents();
    loadGeoJSON();
  }

  loadAll();
})();