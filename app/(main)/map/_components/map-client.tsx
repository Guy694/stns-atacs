"use client";

import { useEffect, useRef } from "react";

type Facility = {
  id: number;
  name: string;
  typecode: string;
  district_name: string | null;
  lat: number | null;
  lon: number | null;
  asset_count: number;
  has_survey: number;
};

const TYPE_COLOR: Record<string, string> = {
  "รพ.ทั่วไป": "#6366f1",
  "รพ.ชุมชน": "#0ea5e9",
  "รพ.สต.": "#10b981",
  "ศสช.": "#f59e0b",
  "สสจ.": "#ec4899",
  "สสอ.": "#8b5cf6",
  "สอน.": "#64748b",
};

export function MapClient({ facilities }: { facilities: Facility[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current || !mapRef.current) return;
    initialised.current = true;

    // Load Leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // Load Leaflet JS then init map
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L as any;

      const map = L.map(mapRef.current!, {
        center: [6.75, 99.98],
        zoom: 10,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      facilities.forEach((f) => {
        if (!f.lat || !f.lon) return;

        const color = TYPE_COLOR[f.typecode] ?? "#64748b";
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${color};border:3px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:10px;font-weight:700;color:white;
          ">${f.asset_count > 0 ? f.asset_count : "·"}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const popup = `
          <div style="min-width:180px;font-family:sans-serif">
            <p style="font-weight:700;margin:0 0 4px">${f.name}</p>
            <p style="margin:0;font-size:12px;color:#64748b">${f.district_name ?? ""} · ${f.typecode}</p>
            <hr style="margin:6px 0;border-color:#e2e8f0"/>
            <p style="margin:0;font-size:12px">ทรัพย์สิน: <strong>${f.asset_count}</strong> รายการ</p>
            ${!f.has_survey ? '<p style="margin:4px 0 0;font-size:11px;color:#f59e0b">⚠ ยังไม่มีข้อมูล</p>' : ""}
          </div>
        `;
        L.marker([f.lat, f.lon], { icon }).addTo(map).bindPopup(popup);
      });
    };
    document.head.appendChild(script);
  }, [facilities]);

  return <div ref={mapRef} className="h-full w-full rounded-2xl" />;
}
