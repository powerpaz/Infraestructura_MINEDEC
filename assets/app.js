(function(){
const cfg = window.__CONF__;
const env = document.getElementById("env-label");
const supabase = (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY!=="REEMPLAZA_CON_TU_ANON_KEY") 
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
env.textContent = supabase ? "Conectando Supabase…" : "Modo local CSV";

const Q=s=>document.querySelector(s);
const uniq=a=>Array.from(new Set(a.filter(x=>x))).sort();
async function loadCSV(url){const txt=await (await fetch(url)).text();return Papa.parse(txt,{header:true,dynamicTyping:true}).data;}
async function loadSupabase(tab){const {data,error}=await supabase.from(tab).select("*").limit(5000);if(error)throw error;return data||[];}
function tableFromData(tbl,rows){const th=tbl.querySelector("thead"),tb=tbl.querySelector("tbody");th.innerHTML="";tb.innerHTML="";
 if(!rows.length){th.innerHTML="<tr><th>Sin datos</th></tr>";return;}
 const keys=Object.keys(rows[0]);th.innerHTML="<tr>"+keys.map(k=>`<th>${k}</th>`).join("")+"</tr>";
 tb.innerHTML=rows.map(r=>"<tr>"+keys.map(k=>`<td>${r[k]??""}</td>`).join("")+"</tr>").join("");
}
const map=L.map("map").setView([-1.8,-78.18],6);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"&copy; OpenStreetMap & CartoDB"}).addTo(map);
let cluster=L.markerClusterGroup();map.addLayer(cluster);
fetch(cfg.PROVINCIAS_GJ).then(r=>r.json()).then(gj=>L.geoJSON(gj,{style:{color:"#1f6feb",weight:1,fillOpacity:0.05}}).addTo(map));

let allRows=[],latKey=null,lngKey=null;
function detectLatLng(r){const lat=["lat","latitude","latitud","Latitud","LATITUD","y","Y"],lng=["lon","lng","longitud","Longitud","LONGITUD","x","X"];return[lat.find(k=>k in r),lng.find(k=>k in r)];}
function drawMarkers(rows){
 cluster.clearLayers();
 if(!latKey||!lngKey)return;
 rows.forEach(r=>{
   const la=+r[latKey],lo=+r[lngKey];if(!isFinite(la)||!isFinite(lo))return;
   const popup=Object.entries(r).map(([k,v])=>`<tr><td><b>${k}</b></td><td>${v??""}</td></tr>`).join("");
   cluster.addLayer(L.marker([la,lo]).bindPopup(`<table>${popup}</table>`));
 });
}
async function loadTableSmart(key,tableSel){
 let rows=[];
 try{rows=await loadSupabase(cfg.TABLES[key]);env.textContent="Supabase conectado";}
 catch(e){if(cfg.LOCAL.enabled){rows=await loadCSV(cfg.LOCAL[key]);env.textContent="Modo CSV";}}
 tableFromData(Q(tableSel),rows);return rows;
}
async function initT1(){
 allRows=await loadTableSmart("tabla1","#t1-table");if(!allRows.length)return;
 [latKey,lngKey]=detectLatLng(allRows[0]);
 const tipos=uniq(allRows.map(r=>r.te_fin??r.nom_sostenimiento??r.tipo));
 const estados=uniq(allRows.map(r=>r.nom_estado_ie??r.estado));
 Q("#f-tipo").innerHTML="<option value=''>Tipo</option>"+tipos.map(v=>`<option>${v}</option>`).join("");
 Q("#f-estado").innerHTML="<option value=''>Estado</option>"+estados.map(v=>`<option>${v}</option>`).join("");
 drawMarkers(allRows);Q("#t1-count").textContent=`${allRows.length} registros`;
}
function filterRows(){
 let rows=allRows.slice();
 const s=Q("#f-texto").value.toLowerCase(),t=Q("#f-tipo").value,e=Q("#f-estado").value;
 if(s)rows=rows.filter(r=>String(r.nom_institucion_educativa||"").toLowerCase().includes(s));
 if(t)rows=rows.filter(r=>(r.te_fin||r.nom_sostenimiento||r.tipo)==t);
 if(e)rows=rows.filter(r=>(r.nom_estado_ie||r.estado)==e);
 tableFromData(Q("#t1-table"),rows);drawMarkers(rows);Q("#t1-count").textContent=`${rows.length} de ${allRows.length}`;
}
Q("#f-tipo").onchange=filterRows;Q("#f-estado").onchange=filterRows;Q("#f-texto").oninput=filterRows;Q("#btn-reset").onclick=()=>{Q("#f-tipo").value="";Q("#f-estado").value="";Q("#f-texto").value="";filterRows();};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".tab-pane").forEach(p=>p.style.display="none");document.getElementById(b.dataset.tab).style.display="";setTimeout(()=>map.invalidateSize(),200);});
initT1();["tabla2","tabla3","tabla4"].forEach((k,i)=>loadTableSmart(k,["#t2-table","#t3-table","#t4-table"][i]));
})();