import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Pandal } from "@/lib/types";
import { hasPin } from "@/lib/types";
import { ZONE_BY_CODE } from "@/lib/pandals";
import { dirUrlFor } from "@/lib/directions";
import type { GeoCoords } from "@/lib/useGeo";

interface Props {
  pandals: Pandal[];
  className?: string;
  selectedId?: string | null;
  onDetails?: (id: string) => void;
  /** show stop order numbers (route planner) */
  numbered?: boolean;
  userCoords?: GeoCoords | null;
  /** detail-page mode: pad an approximate pin with an uncertainty circle */
  showAccuracy?: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pinHtml(p: Pandal, order?: number, selected?: boolean): string {
  const zone = ZONE_BY_CODE[p.zone];
  const color = zone?.hex ?? "#C8281E";
  const approx = p.locationAccuracy === "approximate";
  const cls = `pp-pin${approx ? " pp-pin-approx" : ""}${selected ? " pp-pin-selected" : ""}`;
  return `<div class="${cls}" style="--pin:${color}">${
    order ? `<span>${order}</span>` : ""
  }</div>`;
}

export function PandalMap({
  pandals,
  className,
  selectedId,
  onDetails,
  numbered,
  userCoords,
  showAccuracy,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const detailsRef = useRef(onDetails);
  detailsRef.current = onDetails;

  // init once (StrictMode-safe: cleanup removes the map before re-running)
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [22.556, 88.35],
      zoom: 11,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      userLayerRef.current = null;
    };
  }, []);

  // pandal markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    map.invalidateSize();
    layer.clearLayers();
    if (pandals.length === 0) return;

    const bounds = L.latLngBounds([]);
    for (let i = 0; i < pandals.length; i++) {
      const p = pandals[i];
      // never draw a placeholder: records without a verified position get no pin
      if (p.lat === null || p.lon === null) continue;
      const marker = L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: "pp-pin-wrap",
          html: pinHtml(p, numbered ? i + 1 : undefined, p.id === selectedId),
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        zIndexOffset: p.id === selectedId ? 1000 : 0,
        title: p.name,
        alt: `Pandal: ${p.name}`,
      }).addTo(layer);

      const popup = L.popup({ maxWidth: 280 }).setLatLng([p.lat, p.lon]);
      const zone = ZONE_BY_CODE[p.zone];
      popup.setContent(`
        <div class="pp-popup">
          <p class="pp-popup-zone" style="color:${zone?.hex ?? "#C8281E"}">${escapeHtml(zone?.short ?? "")}</p>
          <p class="pp-popup-name">${escapeHtml(p.name)}</p>
          ${p.nameBn ? `<p class="pp-popup-bn" lang="bn">${escapeHtml(p.nameBn)}</p>` : ""}
          <p class="pp-popup-meta">
            ${escapeHtml(p.neighbourhood ?? "")}${p.nearestMetro ? ` · ${escapeHtml(p.nearestMetro)}` : ""}
          </p>
          <div class="pp-popup-actions">
            <a class="pp-popup-details" data-pp-details="${escapeHtml(p.id)}" href="#">Details</a>
            <a class="pp-popup-directions" href="${escapeHtml(dirUrlFor(p))}" target="_blank" rel="noopener noreferrer">Directions</a>
          </div>
        </div>
      `);
      marker.bindPopup(popup);
      marker.on("popupopen", (e) => {
        const node = e.popup.getElement();
        const btn = node?.querySelector<HTMLAnchorElement>("[data-pp-details]");
        btn?.addEventListener("click", (ev) => {
          ev.preventDefault();
          detailsRef.current?.(p.id);
        });
      });
      bounds.extend([p.lat, p.lon]);
    }

    if (numbered && pandals.length > 1) {
      L.polyline(
        pandals.filter(hasPin).map((p) => [p.lat, p.lon] as [number, number]),
        { color: "#C8281E", weight: 2, dashArray: "6 6", opacity: 0.7 },
      ).addTo(layer);
    }
    if (showAccuracy) {
      for (const p of pandals) {
        if (p.locationAccuracy === "approximate" && hasPin(p)) {
          L.circle([p.lat, p.lon], { radius: 400, color: "#C69214", weight: 1, dashArray: "4 4", fillOpacity: 0.08 }).addTo(layer);
        }
      }
    }

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { animate: false, maxZoom: 16 });
  }, [pandals, numbered, selectedId, showAccuracy]);

  // user location marker
  useEffect(() => {
    const map = mapRef.current;
    const layer = userLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!userCoords) return;
    L.circle([userCoords.lat, userCoords.lon], {
      radius: Math.min(userCoords.accuracyM, 500),
      className: "pp-accuracy-circle",
      weight: 1,
    }).addTo(layer);
    L.marker([userCoords.lat, userCoords.lon], {
      icon: L.divIcon({
        className: "pp-pin-wrap",
        html: '<div class="pp-user" title="Your location"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      zIndexOffset: 2000,
      alt: "Your location",
    }).addTo(layer);
  }, [userCoords]);

  return (
    <div
      ref={containerRef}
      data-testid="leaflet-map-container"
      role="region"
      aria-label="Map of pandals"
      className={className}
    />
  );
}
