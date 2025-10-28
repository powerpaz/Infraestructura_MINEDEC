(function(){const C=window.APP_CONFIG;const m=L.map('map').setView([-1.83,-78.18],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(m);
const s={t1:{},t2:{},t3:{},t4:{}};const cl={t1:null,t2:null,t3:null,t4:null};function gLat(r){return parseFloat(r.Latitud||r.Y)},function gLon(r){return parseFloat(r.Longitud||r.X)};
function mk(d,c){if(cl[c])m.removeLayer(cl[c]);const grp=L.markerClusterGroup();d.forEach(r=>{if(!gLat(r)||!gLon(r))return;const mk=L.circleMarker([gLat(r),gLon(r)],{radius:5,color:'#4cc9f0'});
mk.bindPopup(Object.entries(r).map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br>'));grp.addLayer(mk)});cl[c]=grp;grp.addTo(m)}function ld(p,c){Papa.parse(p,{header:true,download:true,complete:r=>{s[c]=r.data;mk(s[c],c)}})}
Object.entries(C.LOCAL_CSV).forEach(([c,p])=>ld(p,c));fetch(C.GEOJSON.provincias).then(r=>r.json()).then(j=>L.geoJSON(j,{style:{color:'#355070',weight:1,fillOpacity:0.05}}).addTo(m));
fetch(C.GEOJSON.vias).then(r=>r.json()).then(j=>L.geoJSON(j,{style:{color:'#9b5de5',weight:2,opacity:0.7}}).addTo(m));})();