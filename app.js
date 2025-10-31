(() => {
const map = L.map('map').setView([-1.83,-78.18],6);
const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
const baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
L.control.layers({'OSM':baseOSM,'Satélite':baseSat}).addTo(map);

const statusBox = document.getElementById('status');
const setStatus = (msg) => statusBox.innerHTML = msg;

const toNum = (v) => { if(v==null) return NaN; if(typeof v==='string'){ v=v.replace(',','.'); } const n=Number(v); return Number.isFinite(n)?n:NaN; };
const looksEC = (lat,lon) => Number.isFinite(lat)&&Number.isFinite(lon)&&lat>-6.5&&lat<2.5&&lon>-92.8&&lon<-73.5;

// Heurística de normalización para casos comunes en EC
function normalizeLatLon(lat,lon){
  let la = toNum(lat), lo = toNum(lon);
  // Caso directo
  if(looksEC(la,lo)) return [la,lo];
  // Intercambiadas
  if(looksEC(toNum(lon),toNum(lat))) return [toNum(lon),toNum(lat)];
  // Longitud positiva -> poner negativa (hemisferio occidente)
  if(Number.isFinite(lo) && lo>0){ lo = -Math.abs(lo); if(looksEC(la,lo)) return [la,lo]; }
  // Lat fuera de rango pero lo está bien -> probar invertir signos
  if(Number.isFinite(la) && la>10 && Number.isFinite(lo)){ la = -Math.abs(la); if(looksEC(la,lo)) return [la,lo]; }
  // Último intento: si ambos parecen grados (|la|<=2.5, 73<|lo|<93) ya se probó
  return null;
}

function makeCluster(classKey){
  return L.markerClusterGroup({
    iconCreateFunction:c=>{const n=c.getChildCount();const div=document.createElement('div');div.innerHTML=`<span>${n}</span>`;return L.divIcon({html:div,className:`marker-cluster cluster--${classKey}`,iconSize:L.point(40,40)});}
  });
}

function popupInstitucion(row){
  const keys = Object.keys(row);
  const by = (k,...alts)=>{
    const t=[k,...alts].map(s=>String(s).toLowerCase());
    return keys.find(c=>c && t.includes(c.toLowerCase()));
  };
  const get = k => (k && row[k]!=null && String(row[k]).trim()!=='') ? row[k] : '—';
  const amieK = by('amie','cod_amie','codigo_amie');
  const nombreK = by('nom_institucion_educativa','nombre','institucion','nom_establecimiento');
  const sostK = by('sostenimiento','te_fin','tipo_sostenimiento');
  const regK = by('regimen','régimen','regimen_educativo');
  const provK = by('provincia');
  const zonaK = by('zona','zona_admin','zona_educativa');
  return `<div>
    <b>AMIE:</b> ${get(amieK)}<br>
    <b>Nombre:</b> ${get(nombreK)}<br>
    <b>Sostenimiento:</b> ${get(sostK)}<br>
    <b>Régimen:</b> ${get(regK)}<br>
    <b>Provincia:</b> ${get(provK)}<br>
    <b>Zona:</b> ${get(zonaK)}
  </div>`;
}

function fetchCSV(path){
  return new Promise((resolve,reject)=> Papa.parse(path,{download:true,header:true,skipEmptyLines:true,complete:r=>resolve(r.data),error:reject}) );
}

async function loadInstituciones(){
  setStatus('Cargando instituciones…');
  const data = await fetchCSV(config.CSV.instituciones);
  const layer = makeCluster('tabla1');
  let ok=0,bad=0;
  for(const row of data){
    const keys = Object.keys(row);
    const find = t => keys.find(k => k && k.toLowerCase()===t);
    let lat = row[find('latitud')], lon = row[find('longitud')];
    const norm = normalizeLatLon(lat,lon);
    if(!norm){ bad++; continue; }
    const [la,lo] = norm;
    layer.addLayer(L.circleMarker([la,lo],{radius:5,fillColor:config.LAYER_STYLE.tabla1.color,color:'#fff',weight:1,fillOpacity:.9}).bindPopup(popupInstitucion(row)));
    ok++;
  }
  map.addLayer(layer);
  setStatus(`Instituciones: ${ok} puntos (omitidos ${bad}).`);
  return layer;
}

(async()=>{
  // Provincias
  try{
    const gj = await (await fetch(config.GEOJSON)).json();
    const prov = L.geoJSON(gj,{style:{color:'#7aa2ff',weight:1,fillOpacity:0}}).addTo(map);
    document.getElementById('toggle-prov').onchange=e=>e.target.checked?prov.addTo(map):map.removeLayer(prov);
  }catch(e){ console.warn('No geojson provincias', e); }

  // Instituciones (único objetivo ahora)
  await loadInstituciones();
})();})();