// ==========================================================
// SYDNEY HARBOUR POOLS — MAIN APP LOGIC
// ==========================================================
//
// This file controls:
// • Loading pool data
// • Navigating between pools
// • Marking pools as visited
// • Displaying stamps (passport view)
// • Saving state in localStorage
//
// IMPORTANT IDEA FOR LEARNERS:
// ----------------------------
// We NEVER directly "store UI state".
// Instead, we:
//   1. Update data (visited, selectedIndex)
//   2. Save it to localStorage
//   3. Re-render the UI from that data
//
// This keeps the app predictable and bug-free.
//

import { loadPools } from './data.js';
import {
  readVisited,
  writeVisited,
  countVisited,
  readSelection,
  writeSelection,
  readStampsPage,
  writeStampsPage
} from './storage.js';

// ----------------------------------------------------------
// APPLICATION STATE (kept in memory while app is open)
// ----------------------------------------------------------

// All pools loaded from pools.json
let pools = [];

// Visited pools, keyed by pool.id
// Shape:
// {
//   "woolwich": { done: true, date: "16/12/2025" },
//   "balmain":  { done: true, date: "18/12/2025" }
// }
let visited = readVisited();

// Index of the currently selected pool
let selectedIndex = readSelection();

// Which passport page the user is on
let currentStampsPage = readStampsPage();

// Are we currently showing the stamps (passport) view?
let onStampsView = false;

// Leaflet map objects
let map;
let marker;

// ----------------------------------------------------------
// DOM ELEMENT REFERENCES
// ----------------------------------------------------------
// We grab these once and reuse them.
// This is more efficient than querying the DOM repeatedly.

const listView        = document.getElementById('listView');
const stampsView      = document.getElementById('passportView');
const toggleBtn       = document.getElementById('toggleBtn');
const resetBtn        = document.getElementById('resetBtn');
const countBadge      = document.getElementById('countBadge');
const mapToggle       = document.getElementById('mapToggle');
const prevStampsPageBtn = document.getElementById('prevPassportPage');
const nextStampsPageBtn = document.getElementById('nextPassportPage');
const openNativeMapBtn = document.getElementById('openNativeMap');

const btnUp        = document.getElementById('btnUp');
const btnDown      = document.getElementById('btnDown');
const btnPrevPool  = document.getElementById('btnPrevPool');
const btnNextPool  = document.getElementById('btnNextPool');

// ----------------------------------------------------------
// DATE HELPERS
// ----------------------------------------------------------

/**
 * Format dates for Australian display.
 * Also converts old ISO dates if they exist.
 */
function formatDateAU(d) {
  if (!d) return '';

  // Convert YYYY-MM-DD → DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  return d;
}

// ----------------------------------------------------------
// HEADER COUNT ("X / Y")
// ----------------------------------------------------------

function updateCount() {
  const done = countVisited(visited);
  countBadge.textContent = `${done} / ${pools.length}`;
}

// ----------------------------------------------------------
// VIEW SWITCHING (List ↔ Stamps)
// ----------------------------------------------------------

function setView(showStamps) {
  onStampsView = showStamps;

  document.body.classList.remove('full-map');
  listView.classList.toggle('active', !showStamps);
  stampsView.classList.toggle('active', showStamps);

  toggleBtn.textContent = showStamps ? 'Back to List' : 'Stamps';

  // Only render stamps when we actually show them
  if (showStamps) renderStamps();

  // Leaflet maps need a resize nudge when layout changes
  if (map) setTimeout(() => map.invalidateSize(), 150);
}

// ----------------------------------------------------------
// OPEN CURRENT POOL IN NATIVE MAPS APP
// ----------------------------------------------------------

function openInNativeMaps() {
  const p = pools[selectedIndex] || pools[0];
  if (!p) return;

  const lat = p.lat;
  const lng = p.lng;

  // Default to Google Maps
  let url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // Prefer Apple Maps on iOS
  try {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      url = `https://maps.apple.com/?q=${lat},${lng}`;
    }
  } catch {}

  window.open(url, '_blank');
}

// ----------------------------------------------------------
// LIST VIEW (single pool display)
// ----------------------------------------------------------

function renderList() {
  const list = document.getElementById('poolList');

  if (!pools.length) {
    list.innerHTML = '<div class="pool-name">No pools loaded.</div>';
    return;
  }

  list.innerHTML = '';

  const p = pools[selectedIndex];
  const v = visited[p.id];
  const stamped   = v?.done === true;
  const stampDate = stamped ? v.date : null;

  const row = document.createElement('div');
  row.className = 'pool-item row-selected';

  row.innerHTML = `
    <div>
      <div class="pool-name">${p.name}</div>
    </div>
    <button class="stamp-chip ${stamped ? 'stamped' : 'cta'}" data-id="${p.id}">
      ${
        stamped
          ? `✓ Visited • ${formatDateAU(stampDate)}`
          : '✅ Mark as visited'
      }
    </button>
  `;

  // Clicking the row pans the map
  row.addEventListener('click', (e) => {
    if (e.target.classList.contains('stamp-chip')) return;
    panToSelected();
  });

  // Clicking the button toggles visited state
  row.querySelector('.stamp-chip')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleStamp(e.currentTarget.dataset.id, true);
  });

  list.appendChild(row);
  updateCount();
}

// ----------------------------------------------------------
// VISITED STATE TOGGLING
// ----------------------------------------------------------

function toggleStamp(poolId, animate = false) {
  const today = new Intl.DateTimeFormat('en-AU').format(new Date());

  if (visited[poolId]?.done) {
    // Remove entry entirely (cleaner than marking false)
    delete visited[poolId];
  } else {
    visited[poolId] = { done: true, date: today };
  }

  writeVisited(visited);
  renderList();
  renderStamps(animate ? poolId : null);
}

// ----------------------------------------------------------
// MAP SETUP + MOVEMENT
// ----------------------------------------------------------

function setupMap() {
  if (!pools.length) return;

  map = L.map('map').setView([pools[0].lat, pools[0].lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  marker = L.marker([pools[0].lat, pools[0].lng]).addTo(map);
}

function panToSelected() {
  if (!map || !marker) return;

  const p = pools[selectedIndex];
  marker.setLatLng([p.lat, p.lng]).bindPopup(p.name);
  map.setView([p.lat, p.lng], 15, { animate: true });
}

// ----------------------------------------------------------
// PASSPORT (STAMPS) VIEW
// ----------------------------------------------------------

function getStampSrc(p) {
  // Stamp filenames are derived from pool.id
  return p.stamp || `stamps/${p.id}.png`;
}

function renderStamps(popId = null) {
  const grid = document.getElementById('passportGrid');
  if (!grid) return;

  const stampsPerPage = 3;

  // Build list of visited pools in visit order
  const visitedPools = pools
    .filter(p => visited[p.id]?.done)
    .sort((a, b) =>
      visited[a.id].date.localeCompare(visited[b.id].date)
    );

  const totalPages = Math.max(1, Math.ceil(visitedPools.length / stampsPerPage));
  currentStampsPage = Math.min(currentStampsPage, totalPages - 1);
  writeStampsPage(currentStampsPage);

  const pagePools = visitedPools.slice(
    currentStampsPage * stampsPerPage,
    currentStampsPage * stampsPerPage + stampsPerPage
  );

  grid.innerHTML = '';

  pagePools.forEach(p => {
    const v = visited[p.id];

    const card = document.createElement('div');
    card.className = 'passport';

    card.innerHTML = `
      <div class="title">${p.name}</div>
      <div class="stamp ${popId === p.id ? 'pop' : ''}">
        <img src="${getStampSrc(p)}" alt="stamp">
        <div class="label">${p.suburb || 'Stamped'}</div>
      </div>
      <div class="stamp-date">${formatDateAU(v.date)}</div>
    `;

    grid.appendChild(card);
  });
}

// ----------------------------------------------------------
// INITIALISATION
// ----------------------------------------------------------

async function init() {
  pools = await loadPools();

  setupMap();
  renderList();
  updateCount();
}

document.addEventListener('DOMContentLoaded', init);
