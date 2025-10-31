(() => {
const map = L.map('map').setView([-1.8, -78.2], 6);
const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
const baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
L.control.layers({'OSM':baseOSM,'Satélite':baseSat}).addTo(map);

function makeCluster(colorKey){
  return L.markerClusterGroup({
    iconCreateFunction: c => {
      const n = c.getChildCount();
      const div = document.createElement('div');div.innerHTML=`<span>${n}</span>`;
      return L.divIcon({html:div,className:`marker-cluster cluster--${colorKey}`,iconSize:L.point(40,40)});
    }
  });
}

async function loadCSV(file, color){
  const data = await new Promise(r=>Papa.parse(file,{download:true,header:true,complete:res=>r(res.data)}));
  const layer = makeCluster(file.split('.')[0]);
  data.forEach(row=>{
    const lat = parseFloat(row.latitud), lon = parseFloat(row.longitud);
    if(lat && lon && lat>-6 && lat<2 && lon>-92 && lon<-74){
      const m=L.circleMarker([lat,lon],{radius:5,fillColor:color,color:'#fff',weight:1,fillOpacity:.9})
        .bindPopup(Object.entries(row).map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br>'));
      layer.addLayer(m);
    }
  });
  return layer;
}

(async()=>{
  const provRes=await fetch(config.GEOJSON);const provJSON=await provRes.json();
  const provLayer=L.geoJSON(provJSON,{style:{color:'#7aa2ff',weight:1,fillOpacity:0}}).addTo(map);

  const layers={
    tabla1:await loadCSV(config.CSV.tabla1,config.LAYER_STYLE.tabla1.color),
    tabla2:await loadCSV(config.CSV.tabla2,config.LAYER_STYLE.tabla2.color),
    tabla3:await loadCSV(config.CSV.tabla3,config.LAYER_STYLE.tabla3.color),
    tabla4:await loadCSV(config.CSV.tabla4,config.LAYER_STYLE.tabla4.color),
  };
  Object.values(layers).forEach(l=>map.addLayer(l));

  document.getElementById('toggle-prov').onchange=e=>{e.target.checked?map.addLayer(provLayer):map.removeLayer(provLayer)};
  Object.entries(layers).forEach(([k,v])=>{
    document.getElementById(`toggle-${k}`).onchange=e=>{e.target.checked?map.addLayer(v):map.removeLayer(v)};
  });
})();})();