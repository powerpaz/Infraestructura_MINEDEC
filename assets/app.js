(function(){
const cfg=window.__CONF__||{};
const env=document.getElementById("env-label");
const supabase=(window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY!=="REEMPLAZA_CON_TU_ANON_KEY")
  ? window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY) : null;
env.textContent = supabase ? "Supabase" : "Modo CSV";

const Q=s=>document.querySelector(s);
const uniq=a=>Array.from(new Set(a.filter(x=>x!==null&&x!==undefined&&x!==""))).sort();
function num(v){ if(v===null||v===undefined) return NaN; const s=String(v).replace(",","."); const n=parseFloat(s); return Number.isFinite(n)?n:NaN; }

// ----- Map (left) -----
const map=L.map("map",{zoomControl:true}).setView([-1.8,-78.18],6);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"&copy; OpenStreetMap & CartoDB"}).addTo(map);

let provincias=L.layerGroup().addTo(map);
fetch(cfg.PROVINCIAS_GJ).then(r=>r.json()).then(gj=>{
  const g=L.geoJSON(gj,{style:{color:"#3b82f6",weight:1,fillOpacity:0.05}}).addTo(provincias);
  try{const b=g.getBounds(); if(b.isValid()) map.fitBounds(b,{padding:[24,24]});}catch(e){}
});

let cluster=L.markerClusterGroup({ maxClusterRadius: 45, spiderfyOnMaxZoom:true });
map.addLayer(cluster);
Q("#toggle-points").addEventListener("change",(e)=> e.target.checked ? map.addLayer(cluster) : map.removeLayer(cluster));

// ----- Data helpers -----
async function csv(url){const t=await (await fetch(url,{cache:"no-store"})).text(); return Papa.parse(t,{header:true,dynamicTyping:true,skipEmptyLines:true}).data;}
async function sb(table,{texto,tipo,estado}={} ){
  if(!supabase) throw "no-supabase";
  let q = supabase.from(table).select("*").limit(50000);
  if(tipo)   q = q.or(`te_fin.eq.${tipo},nom_sostenimiento.eq.${tipo},tipo.eq.${tipo}`);
  if(estado) q = q.or(`nom_estado_ie.eq.${estado},estado.eq.${estado}`);
  if(texto)  q = q.ilike("nom_institucion_educativa", `%${texto}%`);
  const {data,error}=await q; if(error) throw error; return data||[];
}
function thead_tbody(tbl,rows){
  const th=tbl.querySelector("thead"), tb=tbl.querySelector("tbody");
  th.innerHTML=""; tb.innerHTML="";
  if(!rows.length){ th.innerHTML="<tr><th>Sin datos</th></tr>"; return; }
  const cols=Object.keys(rows[0]);
  th.innerHTML = "<tr>"+cols.map(c=>`<th>${c}</th>`).join("")+"</tr>";
  tb.innerHTML = rows.map(r=>"<tr>"+cols.map(c=>`<td>${r[c]??""}</td>`).join("")+"</tr>").join("");
}

// ----- Tabla 1 with filters → also updates map -----
let T1=[], LAT=null, LNG=null;
function detectLatLng(row){
  const lat=["lat","latitude","latitud","Latitud","LATITUD","y","Y"];
  const lng=["lon","lng","long","longitud","Longitud","LONGITUD","x","X"];
  return [lat.find(k=>k in row), lng.find(k=>k in row)];
}
function drawMarkers(rows){
  cluster.clearLayers();
  if(!LAT || !LNG) return;
  const pts=[];
  rows.forEach(r=>{
    const la=num(r[LAT]), lo=num(r[LNG]); if(!Number.isFinite(la)||!Number.isFinite(lo)) return;
    pts.push([la,lo]);
    const popup = "<table>"+Object.entries(r).map(([k,v])=>`<tr><td><b>${k}</b></td><td>${v??""}</td></tr>`).join("")+"</table>";
    cluster.addLayer(L.marker([la,lo]).bindPopup(popup));
  });
  if(pts.length) try{ map.fitBounds(pts,{maxZoom:12,padding:[24,24]}); }catch(e){}
}

async function loadSmart(key, tableSel, filters=null){
  let rows=[];
  try{ rows=await sb(cfg.TABLES[key], filters); env.textContent="Supabase"; }
  catch(e){ rows= await csv(cfg.LOCAL[key]); env.textContent="Modo CSV"; // local filtering
    if(filters){
      rows = rows.filter(r=>{
        const tipo = r.te_fin ?? r.nom_sostenimiento ?? r.tipo ?? "";
        const estado = r.nom_estado_ie ?? r.estado ?? "";
        const nombre = (r.nom_institucion_educativa ?? r.nombre ?? "").toLowerCase();
        return (!filters.tipo || String(tipo)===filters.tipo) &&
               (!filters.estado || String(estado)===filters.estado) &&
               (!filters.texto || nombre.includes(filters.texto.toLowerCase()));
      });
    }
  }
  thead_tbody(Q(tableSel), rows);
  return rows;
}

async function initT1(){
  T1 = await loadSmart("tabla1","#t1-table");
  if(!T1.length) return;
  [LAT,LNG] = detectLatLng(T1[0]);
  const tipos   = uniq(T1.map(r=>r.te_fin ?? r.nom_sostenimiento ?? r.tipo));
  const estados = uniq(T1.map(r=>r.nom_estado_ie ?? r.estado));
  Q("#f-tipo").innerHTML = "<option value=''>Tipo</option>"+tipos.map(v=>`<option>${v}</option>`).join("");
  Q("#f-estado").innerHTML = "<option value=''>Estado</option>"+estados.map(v=>`<option>${v}</option>`).join("");
  drawMarkers(T1); Q("#t1-count").textContent = `${T1.length} registros`;
}

async function applyFilters(){
  const filters = { texto: Q("#f-texto").value.trim(), tipo: Q("#f-tipo").value||null, estado: Q("#f-estado").value||null };
  const rows = await loadSmart("tabla1","#t1-table", filters);
  if(rows.length) [LAT,LNG] = detectLatLng(rows[0]);
  drawMarkers(rows); Q("#t1-count").textContent = `${rows.length} registros`;
}

Q("#f-tipo").onchange=applyFilters;
Q("#f-estado").onchange=applyFilters;
Q("#f-texto").oninput=applyFilters;
Q("#btn-reset").onclick=()=>{Q("#f-texto").value="";Q("#f-tipo").value="";Q("#f-estado").value="";applyFilters();};

// Tabs
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  document.querySelectorAll(".tab-pane").forEach(p=>p.style.display="none");
  document.getElementById(b.dataset.tab).style.display="";
  setTimeout(()=>map.invalidateSize(),150);
});

initT1();
// Other tables
["tabla2","tabla3","tabla4"].forEach((k,i)=>loadSmart(k,["#t2-table","#t3-table","#t4-table"][i]));
})();