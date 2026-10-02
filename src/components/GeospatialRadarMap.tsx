import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  ExternalLink,
  Navigation,
  Compass,
  Zap,
  Layers,
  Filter,
  Search,
  X,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { AttendanceLog, OfficeConfig } from '../types';
import {
  evaluateMultiUnitGeofence,
  formatCoordinates,
  IPS_POWER_UNITS,
  PowerPlantUnit,
} from '../utils/geo';

interface GeospatialRadarMapProps {
  officeConfig: OfficeConfig;
  logs: AttendanceLog[];
  selectedDate: string;
  isAdmin?: boolean;
  onSaveDefaultRadius?: (newRadiusMeters: number) => Promise<void>;
}

type MapMarkerStatusFilter = 'all' | 'hadir' | 'terlambat' | 'izin';

const STATUS_NAMES: Record<string, string> = {
  hadir_tepat_waktu: 'Hadir Tepat Waktu',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  lembur: 'Hadir Lembur',
  selesai_shift: 'Selesai Shift',
};

function matchesMarkerStatusFilter(status: string, filter: MapMarkerStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'hadir') {
    return (
      status === 'hadir_tepat_waktu' ||
      status === 'lembur' ||
      status === 'selesai_shift'
    );
  }
  if (filter === 'terlambat') {
    return status === 'terlambat';
  }
  if (filter === 'izin') {
    return status === 'izin' || status === 'sakit';
  }
  return true;
}

interface FocusedMapTarget {
  coords: [number, number];
  zoom: number;
  triggerId: number;
}

interface MapViewportControllerProps {
  selectedUnitFilter: string;
  focusedTarget: FocusedMapTarget | null;
}

const MapViewportController: React.FC<MapViewportControllerProps> = ({
  selectedUnitFilter,
  focusedTarget,
}) => {
  const map = useMap();

  useEffect(() => {
    if (focusedTarget) {
      map.flyTo(focusedTarget.coords, focusedTarget.zoom, {
        animate: true,
        duration: 0.9,
      });
      return;
    }

    if (selectedUnitFilter === 'all') {
      const bounds = L.latLngBounds(
        IPS_POWER_UNITS.map((u) => [u.latitude, u.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 11 });
    } else {
      const target = IPS_POWER_UNITS.find((u) => u.unitId === selectedUnitFilter);
      if (target) {
        map.flyTo([target.latitude, target.longitude], 15, {
          animate: true,
          duration: 0.9,
        });
      }
    }
  }, [map, selectedUnitFilter, focusedTarget]);

  return null;
};

interface MapUnitSearchControlProps {
  unitStats: Array<{
    unit: PowerPlantUnit;
    totalAllStaffCount: number;
    isMostActive: boolean;
  }>;
  selectedUnitFilter: string;
  onSelectUnitFromSearch: (unit: PowerPlantUnit) => void;
  onResetAllUnits: () => void;
}

const MapUnitSearchControl: React.FC<MapUnitSearchControlProps> = ({
  unitStats,
  selectedUnitFilter,
  onSelectUnitFromSearch,
  onResetAllUnits,
}) => {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement | null>(null);
  const [queryText, setQueryText] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  const filteredUnits = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return unitStats;
    return unitStats.filter(
      ({ unit }) =>
        unit.name.toLowerCase().includes(q) ||
        unit.code.toLowerCase().includes(q) ||
        unit.region.toLowerCase().includes(q) ||
        unit.address.toLowerCase().includes(q)
    );
  }, [unitStats, queryText]);

  const handleChooseUnit = (unit: PowerPlantUnit) => {
    setQueryText(unit.name);
    setDropdownOpen(false);
    onSelectUnitFromSearch(unit);
    map.flyTo([unit.latitude, unit.longitude], 15, {
      animate: true,
      duration: 0.9,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredUnits.length > 0) {
        handleChooseUnit(filteredUnits[0].unit);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  return (
    <div
      ref={controlRef}
      className="leaflet-top leaflet-right !pointer-events-auto"
      style={{ zIndex: 1000 }}
    >
      <div className="leaflet-control m-3 w-72 sm:w-80">
        <div className="bg-white/95 backdrop-blur-sm border border-slate-300 rounded-lg shadow-lg overflow-hidden">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={queryText}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setQueryText(e.target.value);
                setDropdownOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Cari lokasi PLTU / PLTD (mis. Jeranjang, Ampenan)..."
              aria-label="Cari lokasi unit pembangkit PLTU atau PLTD"
              className="w-full pl-8 pr-8 py-2 text-xs text-slate-900 bg-transparent placeholder:text-slate-400 focus:outline-none"
            />
            {(queryText || selectedUnitFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setQueryText('');
                  setDropdownOpen(false);
                  onResetAllUnits();
                }}
                title="Reset pencarian lokasi"
                className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {dropdownOpen && (
            <div className="border-t border-slate-200 max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white">
              {filteredUnits.length > 0 ? (
                filteredUnits.map(({ unit, totalAllStaffCount, isMostActive }) => {
                  const isActive = selectedUnitFilter === unit.unitId;
                  return (
                    <button
                      key={unit.unitId}
                      type="button"
                      onClick={() => handleChooseUnit(unit)}
                      className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between gap-2 ${
                        isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{unit.name}</div>
                        <div
                          className={`font-mono tabular-nums text-[10px] truncate ${
                            isActive ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {unit.code} · {unit.region}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`font-mono tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isMostActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {totalAllStaffCount} Staf
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2.5 text-xs text-slate-500 text-center">
                  Lokasi PLTU/PLTD &ldquo;{queryText}&rdquo; tidak ditemukan.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function createUnitMarkerIcon(
  unit: PowerPlantUnit,
  activeCount: number,
  isMostActive: boolean,
  isSelected: boolean,
  isHovered: boolean
): L.DivIcon {
  const bg = isMostActive
    ? '#047857'
    : activeCount > 0
    ? '#0f172a'
    : '#475569';
  const border = isSelected || isHovered ? '#f59e0b' : '#ffffff';

  return L.divIcon({
    className: 'ips-unit-marker',
    html: `
      <div class="ips-unit-marker-badge ${isHovered ? 'is-hovered' : ''}" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: ${bg};
        color: #ffffff;
        border: 2px solid ${border};
        border-radius: 8px;
        padding: 4px 8px;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.35);
      ">
        <span style="
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: ${activeCount > 0 ? '#34d399' : '#94a3b8'};
        "></span>
        <span>${unit.code}</span>
        <span style="
          font-family: 'IBM Plex Mono', monospace;
          background: rgba(255,255,255,0.16);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 10px;
        ">${activeCount} Staf</span>
      </div>
    `,
    iconSize: [120, 32],
    iconAnchor: [60, 16],
  });
}

function createEmployeeMarkerIcon(
  userName: string,
  isInsideUnit: boolean,
  status: string,
  isSelected: boolean,
  isHovered: boolean
): L.DivIcon {
  const dotColor =
    status === 'izin' || status === 'sakit'
      ? '#2563eb'
      : !isInsideUnit
      ? '#dc2626'
      : status === 'terlambat'
      ? '#d97706'
      : '#16a34a';
  const firstName = userName.split(' ')[0] || 'Staf';

  return L.divIcon({
    className: 'ips-emp-marker',
    html: `
      <div class="ips-emp-marker-badge ${isHovered ? 'is-hovered' : ''}" style="
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: ${isSelected || isHovered ? '#0f172a' : '#ffffff'};
        color: ${isSelected || isHovered ? '#ffffff' : '#0f172a'};
        border: 1.5px solid ${dotColor};
        border-radius: 6px;
        padding: 2px 6px;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
      ">
        <span style="
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: ${dotColor};
          display: inline-block;
        "></span>
        <span>${firstName}</span>
      </div>
    `,
    iconSize: [80, 24],
    iconAnchor: [40, 24],
  });
}

export const GeospatialRadarMap: React.FC<GeospatialRadarMapProps> = ({
  officeConfig,
  logs,
  selectedDate,
  isAdmin = true,
  onSaveDefaultRadius,
}) => {
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [markerStatusFilter, setMarkerStatusFilter] = useState<MapMarkerStatusFilter>('all');
  const [showGeofenceCircles, setShowGeofenceCircles] = useState<boolean>(true);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(
    logs.length > 0 ? logs[0].logId : null
  );
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [focusedTarget, setFocusedTarget] = useState<FocusedMapTarget | null>(null);
  const [savingRadius, setSavingRadius] = useState<boolean>(false);

  // Per-unit dynamic geofence radius state (in meters)
  const [unitRadii, setUnitRadii] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const u of IPS_POWER_UNITS) {
      initial[u.unitId] = officeConfig.radiusMeters || u.defaultRadiusMeters;
    }
    return initial;
  });

  useEffect(() => {
    setUnitRadii((prev) => {
      const next = { ...prev };
      for (const u of IPS_POWER_UNITS) {
        if (!next[u.unitId]) {
          next[u.unitId] = officeConfig.radiusMeters || u.defaultRadiusMeters;
        }
      }
      return next;
    });
  }, [officeConfig.radiusMeters]);

  const handleUnitRadiusChange = (unitId: string, newRadius: number) => {
    const clamped = Math.max(50, Math.min(5000, newRadius));
    setUnitRadii((prev) => ({
      ...prev,
      [unitId]: clamped,
    }));
  };

  const handleAllUnitsRadiusChange = (newRadius: number) => {
    const clamped = Math.max(50, Math.min(5000, newRadius));
    const updated: Record<string, number> = {};
    for (const u of IPS_POWER_UNITS) {
      updated[u.unitId] = clamped;
    }
    setUnitRadii(updated);
  };

  const handleResetDefaultRadii = () => {
    const resetMap: Record<string, number> = {};
    for (const u of IPS_POWER_UNITS) {
      resetMap[u.unitId] = officeConfig.radiusMeters || u.defaultRadiusMeters;
    }
    setUnitRadii(resetMap);
  };

  // Enrich logs with nearest unit evaluation using dynamic unitRadii
  const enrichedLogs = useMemo(
    () =>
      logs.map((log) => {
        const evalResult = evaluateMultiUnitGeofence(
          log.latitude,
          log.longitude,
          officeConfig.radiusMeters
        );
        const unitRadius =
          unitRadii[evalResult.nearestUnit.unitId] || officeConfig.radiusMeters;
        const isInsideDynamicRadius = evalResult.nearestDistanceMeters <= unitRadius;
        return {
          log,
          nearestUnit: evalResult.nearestUnit,
          nearestDistanceMeters: evalResult.nearestDistanceMeters,
          unitRadiusMeters: unitRadius,
          isInsideUnit: isInsideDynamicRadius,
        };
      }),
    [logs, officeConfig.radiusMeters, unitRadii]
  );

  // Counts by status across the selected unit (or all units)
  const unitScopedLogs = useMemo(
    () =>
      selectedUnitFilter === 'all'
        ? enrichedLogs
        : enrichedLogs.filter((item) => item.nearestUnit.unitId === selectedUnitFilter),
    [enrichedLogs, selectedUnitFilter]
  );

  const statusCounts = useMemo(() => {
    const hadir = unitScopedLogs.filter((i) =>
      matchesMarkerStatusFilter(i.log.status, 'hadir')
    ).length;
    const terlambat = unitScopedLogs.filter((i) =>
      matchesMarkerStatusFilter(i.log.status, 'terlambat')
    ).length;
    const izin = unitScopedLogs.filter((i) =>
      matchesMarkerStatusFilter(i.log.status, 'izin')
    ).length;
    return {
      all: unitScopedLogs.length,
      hadir,
      terlambat,
      izin,
    };
  }, [unitScopedLogs]);

  // Visible markers after applying BOTH Unit filter and Sidebar Status filter
  const visibleLogs = useMemo(
    () =>
      unitScopedLogs.filter((item) =>
        matchesMarkerStatusFilter(item.log.status, markerStatusFilter)
      ),
    [unitScopedLogs, markerStatusFilter]
  );

  // Compute activity count per unit & determine most active site
  const unitStats = useMemo(() => {
    const counts = IPS_POWER_UNITS.map((unit) => {
      const allLogsAtUnit = enrichedLogs.filter(
        (e) => e.nearestUnit.unitId === unit.unitId
      );
      const filteredLogsAtUnit = allLogsAtUnit.filter((e) =>
        matchesMarkerStatusFilter(e.log.status, markerStatusFilter)
      );
      const onTime = allLogsAtUnit.filter((e) =>
        matchesMarkerStatusFilter(e.log.status, 'hadir')
      ).length;
      const late = allLogsAtUnit.filter((e) =>
        matchesMarkerStatusFilter(e.log.status, 'terlambat')
      ).length;
      const izinCount = allLogsAtUnit.filter((e) =>
        matchesMarkerStatusFilter(e.log.status, 'izin')
      ).length;
      return {
        unit,
        totalAllStaffCount: allLogsAtUnit.length,
        totalCount: filteredLogsAtUnit.length,
        onTime,
        late,
        izinCount,
        staffList: allLogsAtUnit,
      };
    });

    const maxCount = Math.max(0, ...counts.map((c) => c.totalAllStaffCount));
    return counts.map((c) => ({
      ...c,
      isMostActive: maxCount > 0 && c.totalAllStaffCount === maxCount,
    }));
  }, [enrichedLogs, markerStatusFilter]);

  const mostActiveSite = useMemo(
    () => unitStats.find((s) => s.isMostActive) || null,
    [unitStats]
  );

  const activeItem =
    visibleLogs.find((item) => item.log.logId === selectedLogId) ||
    (visibleLogs.length > 0 ? visibleLogs[0] : null);

  const activeUnitCenter =
    selectedUnitFilter === 'all'
      ? activeItem?.nearestUnit || IPS_POWER_UNITS[0]
      : IPS_POWER_UNITS.find((u) => u.unitId === selectedUnitFilter) || IPS_POWER_UNITS[0];

  const handleSelectUnitFilter = (unitId: string) => {
    setSelectedUnitFilter(unitId);
    if (unitId === 'all') {
      setFocusedTarget(null);
    } else {
      const target = IPS_POWER_UNITS.find((u) => u.unitId === unitId);
      if (target) {
        setFocusedTarget({
          coords: [target.latitude, target.longitude],
          zoom: 15,
          triggerId: Date.now(),
        });
      }
    }
  };

  const handleFocusEmployee = (logId: string, lat: number, lng: number) => {
    setSelectedLogId(logId);
    setFocusedTarget({
      coords: [lat, lng],
      zoom: 16,
      triggerId: Date.now(),
    });
  };

  return (
    <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
      {/* Header & Most Active Site Summary */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Indonesia Power Service — Peta Interaktif 4 Unit Pembangkit (Lombok & Sumbawa)</span>
            {mostActiveSite && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-emerald-700">
                  Unit Teraktif: {mostActiveSite.unit.name} ({mostActiveSite.totalCount} Staf)
                </span>
              </>
            )}
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
            Peta Geospasial Kehadiran Staf & Kontrol Filter Marker Real-Time
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>Unit Fokus: {activeUnitCenter.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formatCoordinates(activeUnitCenter.latitude, activeUnitCenter.longitude)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Radius Geofence: {officeConfig.radiusMeters}m
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Tanggal: {selectedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              handleSelectUnitFilter('all');
              setMarkerStatusFilter('all');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" />
            Reset Zoom & Filter
          </button>
          <a
            href={`https://www.google.com/maps?q=${activeUnitCenter.latitude},${activeUnitCenter.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka {activeUnitCenter.code} di Google Maps
          </a>
        </div>
      </div>

      {/* 4 Power Plant Units Interactive Selector Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 border-b border-slate-200 bg-slate-50/70 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 text-xs">
        <button
          type="button"
          onClick={() => handleSelectUnitFilter('all')}
          className={`p-3.5 text-left transition-colors ${
            selectedUnitFilter === 'all'
              ? 'bg-white font-semibold text-slate-950'
              : 'hover:bg-white/60 text-slate-600'
          }`}
        >
          <div className="text-slate-500 font-normal">Semua Wilayah NTB</div>
          <div className="text-sm font-semibold text-slate-900 mt-0.5">4 Unit Pembangkit</div>
          <div className="font-mono tabular-nums text-emerald-700 mt-0.5">
            {visibleLogs.length} Marker Aktif
          </div>
        </button>

        {unitStats.map(({ unit, totalCount, isMostActive }) => {
          const isSelected = selectedUnitFilter === unit.unitId;
          return (
            <button
              key={unit.unitId}
              type="button"
              onClick={() => handleSelectUnitFilter(unit.unitId)}
              className={`p-3.5 text-left transition-colors ${
                isSelected
                  ? 'bg-white font-semibold text-slate-950'
                  : 'hover:bg-white/60 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-1 font-mono tabular-nums text-slate-500">
                <span>
                  {unit.code} · {unit.region}
                </span>
                {isMostActive && (
                  <span className="text-emerald-700 font-sans font-semibold">Teraktif</span>
                )}
              </div>
              <div className="text-slate-900 font-semibold truncate mt-0.5">{unit.name}</div>
              <div className="font-mono tabular-nums text-slate-700 mt-0.5">
                {totalCount} Marker · Radius {unitRadii[unit.unitId] || officeConfig.radiusMeters}m
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Interactive React Leaflet Map */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-slate-100">
          <div className="h-[460px] w-full relative z-0">
            <MapContainer
              center={[-8.62, 116.42]}
              zoom={9}
              scrollWheelZoom={true}
              className="h-full w-full z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapViewportController
                selectedUnitFilter={selectedUnitFilter}
                focusedTarget={focusedTarget}
              />

              <MapUnitSearchControl
                unitStats={unitStats}
                selectedUnitFilter={selectedUnitFilter}
                onSelectUnitFromSearch={(unit) => {
                  setSelectedUnitFilter(unit.unitId);
                  setFocusedTarget({
                    coords: [unit.latitude, unit.longitude],
                    zoom: 15,
                    triggerId: Date.now(),
                  });
                }}
                onResetAllUnits={() => handleSelectUnitFilter('all')}
              />

              {/* Render All 4 Power Plant Units + Geofence Circles */}
              {unitStats.map(
                ({
                  unit,
                  totalAllStaffCount,
                  totalCount,
                  onTime,
                  late,
                  izinCount,
                  staffList,
                  isMostActive,
                }) => {
                  const isSelected = selectedUnitFilter === unit.unitId;
                  const isHovered = hoveredMarkerId === `unit-${unit.unitId}`;
                  const currentUnitRadius =
                    unitRadii[unit.unitId] || officeConfig.radiusMeters;
                  return (
                    <React.Fragment key={unit.unitId}>
                      {showGeofenceCircles && (
                        <Circle
                          center={[unit.latitude, unit.longitude]}
                          radius={currentUnitRadius}
                          pathOptions={{
                            color: isSelected
                              ? '#d97706'
                              : isMostActive
                              ? '#059669'
                              : '#0f172a',
                            fillColor: isSelected
                              ? '#f59e0b'
                              : isMostActive
                              ? '#10b981'
                              : '#3b82f6',
                            fillOpacity: 0.2,
                            weight: 2,
                          }}
                        />
                      )}

                      <Marker
                        position={[unit.latitude, unit.longitude]}
                        icon={createUnitMarkerIcon(
                          unit,
                          totalAllStaffCount,
                          isMostActive,
                          isSelected,
                          isHovered
                        )}
                        zIndexOffset={isHovered ? 1000 : isMostActive ? 400 : 200}
                        eventHandlers={{
                          click: (e) => {
                            setFocusedTarget({
                              coords: [unit.latitude, unit.longitude],
                              zoom: 15,
                              triggerId: Date.now(),
                            });
                            if (e.target && e.target._map) {
                              e.target._map.flyTo([unit.latitude, unit.longitude], 15, {
                                animate: true,
                                duration: 0.9,
                              });
                            }
                          },
                          mouseover: () => setHoveredMarkerId(`unit-${unit.unitId}`),
                          mouseout: () =>
                            setHoveredMarkerId((prev) =>
                              prev === `unit-${unit.unitId}` ? null : prev
                            ),
                        }}
                      >
                        <Tooltip
                          direction="top"
                          offset={[0, -18]}
                          opacity={1}
                          className="ips-hover-tooltip"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-white">{unit.name}</div>
                            <div className="font-mono tabular-nums text-[11px] text-emerald-300">
                              Aktivitas Saat Ini: {totalAllStaffCount} Staf Bertugas
                            </div>
                          </div>
                        </Tooltip>
                        <Popup minWidth={250} maxWidth={300}>
                          <div className="text-xs space-y-2 py-0.5">
                            <div className="border-b border-slate-200 pb-1.5">
                              <div className="font-mono tabular-nums text-[11px] text-slate-500">
                                {unit.code} · {unit.region}
                              </div>
                              <div className="font-bold text-sm text-slate-900">{unit.name}</div>
                              <div className="text-slate-500 mt-0.5">{unit.address}</div>
                            </div>

                            <div className="bg-slate-900 text-white rounded-md px-3 py-2 flex items-center justify-between">
                              <span>Total Staf Bertugas Saat Ini</span>
                              <span className="font-mono tabular-nums font-bold text-sm text-emerald-400">
                                {totalAllStaffCount} Staf
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums">
                              <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5">
                                <div className="text-[10px] font-sans text-emerald-800">Hadir</div>
                                <div className="font-bold text-emerald-900">{onTime}</div>
                              </div>
                              <div className="bg-amber-50 border border-amber-200 rounded p-1.5">
                                <div className="text-[10px] font-sans text-amber-800">Terlambat</div>
                                <div className="font-bold text-amber-900">{late}</div>
                              </div>
                              <div className="bg-blue-50 border border-blue-200 rounded p-1.5">
                                <div className="text-[10px] font-sans text-blue-800">Izin/Sakit</div>
                                <div className="font-bold text-blue-900">{izinCount}</div>
                              </div>
                            </div>

                            {staffList.length > 0 && (
                              <div className="border-t border-slate-200 pt-1.5 space-y-1">
                                <div className="font-semibold text-slate-700">
                                  Daftar Staf di Unit Ini ({totalCount} terfilter):
                                </div>
                                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                  {staffList.map(({ log, nearestDistanceMeters }) => (
                                    <div
                                      key={log.logId}
                                      className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50 px-2 py-1 rounded"
                                    >
                                      <span className="font-medium truncate max-w-[135px]">
                                        {log.userName}
                                      </span>
                                      <span className="font-mono tabular-nums text-slate-500">
                                        {log.checkInTime.slice(0, 5)} · {nearestDistanceMeters}m
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[11px]">
                              <span className="font-mono tabular-nums text-slate-500">
                                Radius Unit: ≤ {currentUnitRadius}m
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSelectUnitFilter(unit.unitId)}
                                className="font-semibold text-slate-900 underline hover:text-emerald-700"
                              >
                                Fokus ke Unit Ini
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  );
                }
              )}

              {/* Render Filtered Employee Markers */}
              {visibleLogs.map(
                ({
                  log,
                  nearestUnit,
                  nearestDistanceMeters,
                  unitRadiusMeters,
                  isInsideUnit,
                }) => {
                  const isSelected = activeItem?.log.logId === log.logId;
                  const isHovered = hoveredMarkerId === `emp-${log.logId}`;
                  const unitSummary = unitStats.find((u) => u.unit.unitId === nearestUnit.unitId);
                  const unitStaffTotal = unitSummary ? unitSummary.totalAllStaffCount : 1;

                  return (
                    <Marker
                      key={log.logId}
                      position={[log.latitude, log.longitude]}
                      icon={createEmployeeMarkerIcon(
                        log.userName,
                        isInsideUnit,
                        log.status,
                        isSelected,
                        isHovered
                      )}
                      zIndexOffset={isHovered ? 950 : isSelected ? 500 : 100}
                      eventHandlers={{
                        click: (e) => {
                          setSelectedLogId(log.logId);
                          setFocusedTarget({
                            coords: [log.latitude, log.longitude],
                            zoom: 16,
                            triggerId: Date.now(),
                          });
                          if (e.target && e.target._map) {
                            e.target._map.flyTo([log.latitude, log.longitude], 16, {
                              animate: true,
                              duration: 0.9,
                            });
                          }
                        },
                        mouseover: () => setHoveredMarkerId(`emp-${log.logId}`),
                        mouseout: () =>
                          setHoveredMarkerId((prev) =>
                            prev === `emp-${log.logId}` ? null : prev
                          ),
                      }}
                    >
                      <Tooltip
                        direction="top"
                        offset={[0, -26]}
                        opacity={1}
                        className="ips-hover-tooltip"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white">
                            {nearestUnit.name} ({log.userName})
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-emerald-300">
                            Aktivitas Unit: {unitStaffTotal} Staf Bertugas · {nearestDistanceMeters}m
                          </div>
                        </div>
                      </Tooltip>
                      <Popup minWidth={230}>
                        <div className="text-xs space-y-1.5 py-0.5">
                          <div className="border-b border-slate-200 pb-1.5">
                            <div className="font-bold text-sm text-slate-900">{log.userName}</div>
                            <div className="text-slate-600">
                              {log.department} · {log.position}
                            </div>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded p-2 space-y-1">
                            <div className="font-semibold text-slate-900">
                              Unit: {nearestUnit.name}
                            </div>
                            <div className="font-mono tabular-nums text-slate-700">
                              Total Staf Bertugas di {nearestUnit.code}:{' '}
                              <strong>{unitStaffTotal} Staf</strong>
                            </div>
                            <div className="font-mono tabular-nums text-slate-600">
                              Jarak Staf ke Unit: {nearestDistanceMeters}m (Maks{' '}
                              {unitRadiusMeters}m)
                            </div>
                          </div>

                          <div className="font-mono tabular-nums text-slate-700">
                            Status: <strong>{STATUS_NAMES[log.status] || log.status}</strong> · Masuk:{' '}
                            {log.checkInTime}
                          </div>
                          <div
                            className={`font-semibold ${
                              isInsideUnit ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isInsideUnit ? 'Valid Dalam Radius Unit' : 'Di Luar Radius 4 Unit'}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
              )}
            </MapContainer>
          </div>

          <div className="px-5 py-3 bg-slate-900 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                Hadir Tepat Waktu
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                Terlambat
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                Izin / Sakit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                Luar Radius
              </span>
            </div>
            <span className="font-mono tabular-nums text-slate-200">
              Menampilkan {visibleLogs.length} dari {unitScopedLogs.length} Marker Staf
            </span>
          </div>
        </div>

        {/* Right: Map Control Sidebar (Status Filter + Marker List + Selected Inspector) */}
        <div className="lg:col-span-5 p-6 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200 space-y-5">
          {/* Control Section 1: Filter Marker Berdasarkan Status Kehadiran */}
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Filter className="w-3.5 h-3.5 text-slate-700" />
                <span>Filter Penanda (Marker) Berdasarkan Status Kehadiran</span>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGeofenceCircles}
                  onChange={(e) => setShowGeofenceCircles(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Radius Geofence</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {(
                [
                  {
                    id: 'all',
                    label: 'Semua',
                    count: statusCounts.all,
                    accent: 'border-slate-300 text-slate-800',
                  },
                  {
                    id: 'hadir',
                    label: 'Hadir',
                    count: statusCounts.hadir,
                    accent: 'border-emerald-300 text-emerald-800',
                  },
                  {
                    id: 'terlambat',
                    label: 'Terlambat',
                    count: statusCounts.terlambat,
                    accent: 'border-amber-300 text-amber-800',
                  },
                  {
                    id: 'izin',
                    label: 'Izin / Sakit',
                    count: statusCounts.izin,
                    accent: 'border-blue-300 text-blue-800',
                  },
                ] as const
              ).map((btn) => {
                const isActive = markerStatusFilter === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setMarkerStatusFilter(btn.id)}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                        : `bg-slate-50 hover:bg-slate-100 ${btn.accent}`
                    }`}
                  >
                    <div className="truncate">{btn.label}</div>
                    <div
                      className={`font-mono tabular-nums text-sm font-semibold mt-0.5 ${
                        isActive ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {btn.count} Staf
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control Section 1.5: Dynamic Geofence Radius Sliders per Power Plant Unit */}
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Sliders className="w-3.5 h-3.5 text-slate-700" />
                <span>Kontrol Slider Radius Geofence per Unit Pembangkit</span>
              </div>
              <button
                type="button"
                onClick={handleResetDefaultRadii}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="w-3 h-3" />
                Reset ({officeConfig.radiusMeters}m)
              </button>
            </div>

            <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
              {IPS_POWER_UNITS.map((unit) => {
                const currentRadius = unitRadii[unit.unitId] || officeConfig.radiusMeters;
                const isUnitFocused = selectedUnitFilter === unit.unitId;
                return (
                  <div key={unit.unitId} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectUnitFilter(unit.unitId)}
                        className={`text-left truncate font-medium transition-colors ${
                          isUnitFocused
                            ? 'text-emerald-700 font-semibold underline'
                            : 'text-slate-800 hover:text-slate-950'
                        }`}
                      >
                        {unit.code} · {unit.name}
                      </button>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 shrink-0">
                        {currentRadius} m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={3000}
                      step={25}
                      value={currentRadius}
                      onChange={(e) => {
                        setShowGeofenceCircles(true);
                        handleUnitRadiusChange(unit.unitId, parseInt(e.target.value, 10) || 250);
                      }}
                      aria-label={`Slider radius geofence ${unit.name}`}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                    />
                  </div>
                );
              })}

              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Setel Serentak:</span>
                  {[150, 250, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setShowGeofenceCircles(true);
                        handleAllUnitsRadiusChange(preset);
                      }}
                      className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 font-mono tabular-nums text-slate-700"
                    >
                      {preset}m
                    </button>
                  ))}
                </div>

                {isAdmin && onSaveDefaultRadius && (
                  <button
                    type="button"
                    disabled={savingRadius}
                    onClick={async () => {
                      setSavingRadius(true);
                      try {
                        const targetRadius =
                          unitRadii[activeUnitCenter.unitId] || officeConfig.radiusMeters;
                        await onSaveDefaultRadius(targetRadius);
                      } finally {
                        setSavingRadius(false);
                      }
                    }}
                    className="font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    {savingRadius
                      ? 'Menyimpan...'
                      : `Simpan Default (${unitRadii[activeUnitCenter.unitId] || officeConfig.radiusMeters}m)`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Control Section 2: Selected Employee Telemetry Inspector */}
          {activeItem ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-700" />
                  <span>Detail Penanda (Marker) Staf Terpilih</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mt-1">
                  {activeItem.log.userName}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-0.5">
                  <span>{activeItem.log.department}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeItem.log.position}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      activeItem.log.status === 'terlambat'
                        ? 'text-amber-700 font-medium'
                        : activeItem.log.status === 'izin' || activeItem.log.status === 'sakit'
                        ? 'text-blue-700 font-medium'
                        : 'text-emerald-700 font-medium'
                    }
                  >
                    {STATUS_NAMES[activeItem.log.status] || activeItem.log.status}
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="col-span-2">
                  <dt className="text-slate-500">Unit Pembangkit Terdekat</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {activeItem.nearestUnit.name} ({activeItem.nearestUnit.region})
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Jam Check-In</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {activeItem.log.checkInTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Jarak ke Titik Unit</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {activeItem.nearestDistanceMeters}m (Maks {activeItem.unitRadiusMeters}m)
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Koordinat GPS & Validasi Geofence</dt>
                  <dd className="font-mono tabular-nums text-slate-800 mt-0.5">
                    {activeItem.log.latitude.toFixed(5)}, {activeItem.log.longitude.toFixed(5)} ·{' '}
                    <span
                      className={
                        activeItem.isInsideUnit
                          ? 'text-emerald-700 font-sans font-semibold'
                          : 'text-red-700 font-sans font-semibold'
                      }
                    >
                      {activeItem.isInsideUnit
                        ? `Valid (${activeItem.nearestUnit.code})`
                        : 'Di Luar 4 Unit'}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    handleFocusEmployee(
                      activeItem.log.logId,
                      activeItem.log.latitude,
                      activeItem.log.longitude
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Zoom Peta ke Marker {activeItem.log.userName.split(' ')[0]}
                </button>
                <a
                  href={`https://www.google.com/maps?q=${activeItem.log.latitude},${activeItem.log.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-900 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka di Google Maps
                </a>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Navigation className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-800">
                Tidak Ada Marker dengan Status Ini
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Ubah filter status kehadiran di atas (Semua / Hadir / Terlambat / Izin) untuk
                melihat penanda staf lainnya di peta.
              </p>
            </div>
          )}

          {/* Control Section 3: Interactive List of Filtered Markers */}
          <div className="pt-3 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2">
              Daftar Marker Staf Terfilter ({visibleLogs.length}):
            </p>
            {visibleLogs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {visibleLogs.map(({ log, nearestUnit, nearestDistanceMeters }) => (
                  <button
                    key={log.logId}
                    type="button"
                    onClick={() => handleFocusEmployee(log.logId, log.latitude, log.longitude)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap ${
                      activeItem?.log.logId === log.logId
                        ? 'bg-slate-900 text-white border-slate-900 font-medium'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {log.userName} · {nearestUnit.code} ({nearestDistanceMeters}m)
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400">
                Tidak ada penanda yang cocok dengan filter status saat ini.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
