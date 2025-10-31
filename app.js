(() => {
const map = L.map('map').setView([-1.83,-78.18],6);
const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
const baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
L.control.layers({'OSM':baseOSM,'Satélite':baseSat}).addTo(map);

function toNum(v){ if(v==null) return NaN; if(typeof v==='string'){ v=v.replace(',','.'); } const n=Number(v); return Number.isFinite(n)?n:NaN; }
function looksEC(lat,lon){ return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>-6&&lat<2&&lon>-92.6&&lon<-74; }

function makeCluster(classKey){
  return L.markerClusterGroup({
    iconCreateFunction:c=>{const n=c.getChildCount();const div=document.createElement('div');div.innerHTML=`<span>${n}</span>`;return L.divIcon({html:div,className:`marker-cluster cluster--${classKey}`,iconSize:L.point(40,40)});}
  });
}
function popupFor(row){ return Object.entries(row).filter(([k,v])=>v!=null && String(v).trim()!=='').slice(0,16).map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br>'); }

async function loadCSV(path, color, classKey){
  const data = await new Promise(res=>Papa.parse(path,{download:true,header:true,skipEmptyLines:true,complete:r=>res(r.data)}));
  const layer = makeCluster(classKey);
  let good = 0;
  for(const row of data){
    // tolerante a mayúsc/minúsc y orden
    const keys = Object.keys(row);
    const by = k => keys.find(c => c && c.toLowerCase()===k);
    let lat = toNum(row[by('latitud')]); let lon = toNum(row[by('longitud')]);
    if(!looksEC(lat,lon)){
      const lat2 = toNum(row[by('longitud')]); const lon2 = toNum(row[by('latitud')]);
      if(looksEC(lat2,lon2)){ lat=lat2; lon=lon2; }
    }
    if(!looksEC(lat,lon)) continue;
    layer.addLayer(L.circleMarker([lat,lon],{radius:5,fillColor:color,color:'#fff',weight:1,fillOpacity:.9}).bindPopup(popupFor(row)));
    good++;
  }
  // console.log(path,'puntos válidos:',good);
  return layer;
}

(async()=>{
  // Provincias
  const gj = await (await fetch(config.GEOJSON)).json();
  const prov = L.geoJSON(gj,{style:{color:'#7aa2ff',weight:1,fillOpacity:0}}).addTo(map);

  // Capas de puntos
  const l1 = await loadCSV(config.CSV.tabla1, config.LAYER_STYLE.tabla1.color, 'tabla1');
  const l2 = await loadCSV(config.CSV.tabla2, config.LAYER_STYLE.tabla2.color, 'tabla2');
  const l3 = await loadCSV(config.CSV.tabla3, config.LAYER_STYLE.tabla3.color, 'tabla3');
  const l4 = await loadCSV(config.CSV.tabla4, config.LAYER_STYLE.tabla4.color, 'tabla4');

  const layers = { tabla1:l1, tabla2:l2, tabla3:l3, tabla4:l4 };
  Object.values(layers).forEach(l => map.addLayer(l));

  // Filtros
  document.getElementById('toggle-prov').onchange=e=>e.target.checked?prov.addTo(map):map.removeLayer(prov);
  Object.entries(layers).forEach(([k,lyr])=>{
    document.getElementById(`toggle-${k}`).onchange=e=>e.target.checked?lyr.addTo(map):map.removeLayer(lyr);
  });

  // Extensión
  const bounds=L.latLngBounds([]);
  prov.eachLayer(l=>{try{bounds.extend(l.getBounds());}catch(e){}});
  Object.values(layers).forEach(lyr=>lyr.getLayers().forEach(m=>{if(m.getLatLng) bounds.extend(m.getLatLng());}));
  if(bounds.isValid()) map.fitBounds(bounds.pad(0.12));
})();})();