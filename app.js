(() => {
const map = L.map('map').setView([-1.8, -78.2], 6);
const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
const baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
L.control.layers({'OSM':baseOSM,'Satélite':baseSat}).addTo(map);

function toNum(v){ if(v==null) return NaN; if(typeof v==='string'){ v=v.replace(',','.'); } const n=Number(v); return Number.isFinite(n)?n:NaN; }
function looksLikeEC(lat,lon){ return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>-6&&lat<2&&lon>-92.6&&lon<-74; }

function makeCluster(classKey){
  return L.markerClusterGroup({
    iconCreateFunction:c=>{const n=c.getChildCount();const div=document.createElement('div');div.innerHTML=`<span>${n}</span>`;return L.divIcon({html:div,className:`marker-cluster cluster--${classKey}`,iconSize:L.point(40,40)});}
  });
}

async function loadCSV(file,color,classKey){
  const data = await new Promise(r=>Papa.parse(file,{download:true,header:true,skipEmptyLines:true,complete:res=>r(res.data)}));
  const layer = makeCluster(classKey);
  let added=0;
  for(const row of data){
    // tolerante a mayusculas/minusculas
    const keys = Object.keys(row);
    const find = k => keys.find(c => c && c.toLowerCase()===k);
    let lat = toNum(row[find('latitud')]); let lon = toNum(row[find('longitud')]);

    // invertir si vinieran cruzadas
    if(!looksLikeEC(lat,lon)){
      const lat2 = toNum(row[find('longitud')]); const lon2 = toNum(row[find('latitud')]);
      if(looksLikeEC(lat2,lon2)){ lat=lat2; lon=lon2; }
    }

    if(!looksLikeEC(lat,lon)) continue; // descartar inválidos

    const m=L.circleMarker([lat,lon],{radius:5,fillColor:color,color:'#fff',weight:1,fillOpacity:.9})
      .bindPopup(Object.entries(row).map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br>'));
    layer.addLayer(m); added++;
  }
  // console.log(file,'puntos',added);
  return layer;
}

(async()=>{
  // Provincias
  const gj = await (await fetch(config.GEOJSON)).json();
  const prov = L.geoJSON(gj,{style:{color:'#7aa2ff',weight:1,fillOpacity:0}}).addTo(map);

  // Capas
  const l1 = await loadCSV(config.CSV.tabla1, config.LAYER_STYLE.tabla1.color, 'tabla1');
  const l2 = await loadCSV(config.CSV.tabla2, config.LAYER_STYLE.tabla2.color, 'tabla2');
  const l3 = await loadCSV(config.CSV.tabla3, config.LAYER_STYLE.tabla3.color, 'tabla3');
  const l4 = await loadCSV(config.CSV.tabla4, config.LAYER_STYLE.tabla4.color, 'tabla4');

  const layers = { tabla1:l1, tabla2:l2, tabla3:l3, tabla4:l4 };
  Object.values(layers).forEach(l => map.addLayer(l));

  // Filtros
  document.getElementById('toggle-prov').onchange = e => e.target.checked ? prov.addTo(map) : map.removeLayer(prov);
  Object.entries(layers).forEach(([k,lyr]) => {
    document.getElementById(`toggle-${k}`).onchange = e => e.target.checked ? lyr.addTo(map) : map.removeLayer(lyr);
  });

  // Extensión
  const bounds=L.latLngBounds([]);
  prov.eachLayer(l => { try{ bounds.extend(l.getBounds()); }catch(e){} });
  Object.values(layers).forEach(lyr => lyr.getLayers().forEach(m => { if(m.getLatLng) bounds.extend(m.getLatLng()); }));
  if(bounds.isValid()) map.fitBounds(bounds.pad(0.12));
})();})();