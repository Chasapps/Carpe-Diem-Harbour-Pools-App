// overview.js
// ===========
// Overview map that shows ALL harbour pools at once.
// Uses the same data + localStorage helpers as the main app so that
// progress (visited / not visited) stays perfectly in sync.

import { loadPools } from './data.js';
import {
  LS_KEYS,
  readVisited,
  countVisited
} from './storage.js';

/** Create the small coloured circle icon for each pool. */
function createOverviewIcon(isVisited) {
  return L.divIcon({
    className: isVisited
      ? 'overview-marker overview-marker-visited'
      : 'overview-marker overview-marker-notvisited',
    html: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

/** Update the header badge and subtext message. */
function updateOverviewText(pools, visitedMap) {
  const badgeEl = document.getElementById('overviewBadge');
  const textEl  = document.getElementById('overviewText');

  const visitedCount = countVisited(visitedMap);
  const total = pools.length;

  if (badgeEl) {
    badgeEl.textContent = `${visitedCount} / ${total}`;
  }

  if (textEl) {
    if (total === 0) {
      textEl.textContent = 'No pools configured.';
    } else {
      textEl.textContent = `You’ve visited ${visitedCount} of ${total} harbour pools.`;
    }
  }
}

/** Build the Leaflet map and add one marker per pool. */
async function initOverviewMap() {
  const mapEl = document.getElementById('overviewMap');
  if (!mapEl) return;

  let pools;
  try {
    pools = await loadPools();
  } catch (err) {
    console.error(err);
    mapEl.textContent = 'Error loading pools list.';
    return;
  }

  const visitedMap = readVisited();
  updateOverviewText(pools, visitedMap);

  const map = L.map(mapEl, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([-33.8688, 151.2093], 11); // Roughly Sydney CBD

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const bounds = [];

  pools.forEach(pool => {
    const info = visitedMap[pool.id];
    const isVisited = !!(info && info.done);

    const icon = createOverviewIcon(isVisited);
    const marker = L.marker([pool.lat, pool.lng], { icon }).addTo(map);

    marker.bindPopup(`<strong>${pool.name}</strong>`);

    bounds.push([pool.lat, pool.lng]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

// Entry point for the overview page.
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openAppBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      window.location.href = 'app.html';
    });
  }

// Reset profile = clears passport name + all progress on THIS device.
// It does not affect the GitHub site or anyone else’s passport.
const resetBtn = document.getElementById('resetProfileBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    const ok = confirm(
      'Reset your profile on this device?\n\nThis will clear:\n• your passport name\n• all visited stamps/dates\n• your current pool selection\n• your stamps page\n\nIt cannot be undone.'
    );
    if (!ok) return;

    try {
      // Name key used by the splash / cover
      localStorage.removeItem('passportOwnerName');

      // App progress keys (defined in storage.js)
      localStorage.removeItem(LS_KEYS.VISITED);
      localStorage.removeItem(LS_KEYS.SELECTION);
      localStorage.removeItem(LS_KEYS.STAMPS_PAGE);
    } catch (e) {
      alert('Could not reset (storage not available).');
      return;
    }

    // Reload so the overview badge + markers update immediately.
    window.location.reload();
  });
}

  const changeNameBtn = document.getElementById('changeNameBtn');
  if (changeNameBtn) {
    changeNameBtn.addEventListener('click', () => {
      const LS_KEY = 'passportOwnerName';
      let currentName = null;
      try {
        currentName = localStorage.getItem(LS_KEY);
      } catch (e) {
        currentName = null;
      }

      const defaultName = currentName || 'Carpe Diem Passport';
      const input = prompt('Update passport name:', defaultName);
      if (!input) return;
      const nextName = input.trim();
      if (!nextName) return;

      try {
        localStorage.setItem(LS_KEY, nextName);
      } catch (e) {
        // ignore storage errors
      }

      alert('Passport name updated. You\'ll see it on the cover next time you open the app.');
    });
  }

  initOverviewMap().catch(err =>
    console.error('Error during overview init', err)
  );
});
