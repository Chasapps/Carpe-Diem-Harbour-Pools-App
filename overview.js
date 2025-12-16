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

  // Reset Profile = clears name + all visited progress on THIS device.
  // This does NOT affect anyone else and does not change the app code on GitHub.
  const resetBtn = document.getElementById('resetProfileBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const ok = confirm(
        'Reset your profile on this device?\n\nThis will clear:\n• your passport name\n• all visited stamps/dates\n• your current pool selection\n\nIt cannot be undone.'
      );
      if (!ok) return;

      try {
        // Name key used by the splash/cover
        localStorage.removeItem('passportOwnerName');

        // App progress keys (see storage.js)
        localStorage.removeItem(LS_KEYS.VISITED);
        localStorage.removeItem(LS_KEYS.SELECTION);
        localStorage.removeItem(LS_KEYS.STAMPS_PAGE);
      } catch (e) {
        // If storage is blocked, at least show a message
        alert('Could not reset (storage not available).');
        return;
      }

      // Refresh the overview so markers + counts update immediately.
      window.location.reload();
    });
  }


  initOverviewMap().catch(err =>
    console.error('Error during overview init', err)
  );
});
