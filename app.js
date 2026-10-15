const ICONS = {A:'⏰', B:'🚌', 1:'🍽️', 2:'☕', 3:'🛍️', 4:'🥐', C:'🚌'};

const FALLBACK = [
  {id:"A",kind:"letter",label:"A",time:"4:15 AM",title:"Call Time",desc:"PLEASE LANG, BAWAL ANG LATE. BWHAHAH!",menu:"",more:"",lat:14.685858,lng:120.538704},
  {id:"B",kind:"letter",label:"B",time:"4:30 AM to 6:30 AM",title:"Bataan to Clark",desc:"",menu:"",more:"",lat:15.18583,lng:120.55972},
  {id:"1",kind:"number",label:"1",time:"6:30 AM to 8:30 AM",title:"Gogi Marami",desc:"First Stop: SAMG na agad, yoohoo!",menu:"https://www.facebook.com/story.php?story_fbid=122119413915438124&id=61593143738208&rdid=yT6RS0q2knvxQtKF#",more:"",lat:15.158364,lng:120.558891},
  {id:"2",kind:"number",label:"2",time:"8:30 AM to 10:00 AM",title:"The Ambience (Azzuro Hotel)",desc:"Second Stop: Drinks/Coffee, while waiting sa opening ng SM.",menu:"https://drive.google.com/drive/folders/1HcI0tZlfyRXu7t4n1MHmCQlmpCo9-xMy?usp=drive_link",more:"https://www.tiktok.com/@sismarsmanganlena/video/7655291279814774036?_r=1&_t=ZS-9ATr8RnQAIm",lat:15.164206,lng:120.590967},
  {id:"3",kind:"number",label:"3",time:"10:00 AM to 12:30 PM",title:"SM Clark",desc:"Ikot ikot, Activities, KTV, Cinema and etc.",menu:"",more:"https://www.tiktok.com/@bacanisam/video/7663080436607798536?_r=1&_t=ZS-9ATrCNXjIEX",lat:15.16845,lng:120.58018},
  {id:"4",kind:"number",label:"4",time:"12:30 PM to 2:00 PM",title:"The Canyon",desc:"Last stop: Drinks or pastries (For clout lang since maganda ang place, bwhaha!)",menu:"https://drive.google.com/drive/folders/1KEWTJx0RHiWGakUworNtm2fx1-3qXD41?usp=drive_link",more:"https://www.tiktok.com/@bacanisam/video/7583717210611371265?_r=1&_t=ZS-9AYpl7vAbn3",lat:15.1919515,lng:120.5239687},
  {id:"C",kind:"letter",label:"C",time:"2:00 PM to 6:00 PM",title:"Clark to Bataan",desc:"Depende sa bus schedule :)",menu:"",more:"",lat:15.18500,lng:120.56100}
];

// Works from the C++ server, or by opening index.html directly.
fetch('/api/itinerary').then(r => r.json()).then(init).catch(() => init(FALLBACK));

// Verified positions (decimal degrees).
const COORDS = {
  A: [14.685858, 120.538704],        // Genesis Bus Terminal, Calero St., Balanga, Bataan
  B: [15.18583, 120.55972],          // Clark International Airport (Bataan to Clark ends here)
  1: [15.158364, 120.558891],        // Gogi Marami, Korea Town, Friendship Highway, Angeles
  2: [15.164206, 120.590967],        // Azzurro Hotel, MacArthur Highway, Balibago
  3: [15.16845, 120.58018],          // SM City Clark
  4: [15.1919515, 120.5239687],      // The Canyon, Swissotel Clark, Manuel A. Roxas Highway
  C: [15.18500, 120.56100]           // Clark International Airport (Clark to Bataan starts here; nudged ~150 m so B and C do not overlap)
};

function init(items) {
  items.forEach(i => { if (COORDS[i.id]) { i.lat = COORDS[i.id][0]; i.lng = COORDS[i.id][1]; } });

  const trail = document.getElementById('trail');
  const map = L.map('map', {scrollWheelZoom: false});
  const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors'
  }).addTo(map);
  let tileErrors = 0;
  esri.on('tileerror', () => {
    if (++tileErrors === 6) {
      map.removeLayer(esri);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'}).addTo(map);
    }
  });

  const cards = {}, markers = {};
  items.forEach(i => {
    const icon = L.divIcon({className: '', iconSize: [34, 34], iconAnchor: [17, 17],
      html: `<div class="pin ${i.kind}">${i.label}</div>`});
    const m = L.marker([i.lat, i.lng], {icon, title: i.title}).addTo(map);
    const dir = {A:'right',B:'left',1:'left',2:'right',3:'bottom',4:'left',C:'right'}[i.id];
    const off = {left:[-16,0],right:[16,0],top:[0,-16],bottom:[0,16]}[dir];
    m.bindTooltip(i.title, {permanent: true, direction: dir, offset: off, className: 'tag'});
    m.bindPopup(`<strong>${i.title}</strong><br>${i.time}`);
    m.on('click', () => select(i.id, true));
    markers[i.id] = m;

    const li = document.createElement('li');
    li.className = `stop ${i.kind}`;
    li.innerHTML = `
      <span class="badge ${i.kind}">${i.label}</span>
      <article class="card" tabindex="0">
        <span class="time">${ICONS[i.id]} ${i.time}</span>
        <h2>${i.title}</h2>
        ${i.desc ? `<p>${i.desc}</p>` : ''}
        ${(i.menu || i.more) ? `<div class="actions">
          ${i.menu ? `<a class="btn menu" href="${i.menu}" target="_blank" rel="noopener">Menu</a>` : ''}
          ${i.more ? `<a class="btn more" href="${i.more}" target="_blank" rel="noopener">Know More</a>` : ''}
        </div>` : ''}
      </article>`;
    const card = li.querySelector('.card');
    card.addEventListener('click', e => { if (!e.target.closest('a')) select(i.id, false); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.target.closest('a')) select(i.id, false); });
    trail.appendChild(li);
    cards[i.id] = li;
  });

  // ---- Route: one continuous trip that follows real roads (falls back to straight lines offline) ----
  const BLUE = {color: '#1d4ed8', weight: 5, opacity: .92, lineCap: 'round'};
  const RED  = {color: '#e11d2e', weight: 5, opacity: .92, lineCap: 'round', dashArray: '12 10'};

  function leg(from, to, style) {
    const line = L.polyline([from, to], style).addTo(map);
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    fetch(url).then(r => r.json()).then(d => {
      const road = d.routes[0].geometry.coordinates.map(p => [p[1], p[0]]);
      line.setLatLngs([from, ...road, to]);
    }).catch(() => {});
  }

  const {A, B, C, 1: P1, 2: P2, 3: P3, 4: P4} = COORDS;
  leg(A,  B,  BLUE);   // A -> B   Genesis Balanga to Clark Airport
  leg(B,  P1, BLUE);   // B -> 1   Clark Airport to Gogi Marami
  leg(P1, P2, RED);    // 1 -> 2
  leg(P2, P3, RED);    // 2 -> 3
  leg(P3, P4, RED);    // 3 -> 4
  leg(P4, C,  BLUE);   // 4 -> C   The Canyon to Clark Airport

  function select(id, fromMap) {
    Object.values(cards).forEach(c => c.classList.remove('active'));
    cards[id].classList.add('active');
    if (fromMap) cards[id].scrollIntoView({behavior: 'smooth', block: 'center'});
    else {
      const it = items.find(x => x.id === id);
      map.flyTo([it.lat, it.lng], 15, {duration: .9});
      markers[id].openPopup();
    }
  }

  const all = items.map(i => [i.lat, i.lng]);
  const fit = () => { map.invalidateSize(); map.fitBounds(all, {padding: [50, 50]}); };
  fit();
  window.addEventListener('load', fit);
  window.addEventListener('resize', fit);
  setTimeout(fit, 400);
}
