import { OfficeConfig } from '../types';

export interface PowerPlantUnit {
  unitId: string;
  code: string;
  name: string;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  defaultRadiusMeters: number;
}

export const IPS_POWER_UNITS: PowerPlantUnit[] = [
  {
    unitId: 'unit_jeranjang',
    code: 'PLTU-JRJ',
    name: 'PLTU Jeranjang — Gerung',
    region: 'Lombok Barat',
    address: 'Desa Taman Ayu, Kec. Gerung, Kab. Lombok Barat, NTB',
    latitude: -8.6594,
    longitude: 116.0748,
    defaultRadiusMeters: 300,
  },
  {
    unitId: 'unit_ampenan',
    code: 'PLTD-AMP',
    name: 'PLTD Ampenan — Mataram',
    region: 'Kota Mataram',
    address: 'Jl. Energi Tanjung Karang, Kec. Ampenan, Kota Mataram, NTB',
    latitude: -8.5724,
    longitude: 116.0752,
    defaultRadiusMeters: 250,
  },
  {
    unitId: 'unit_pringgabaya',
    code: 'PLTD-PGB',
    name: 'PLTD Pringgabaya — Lombok Timur',
    region: 'Lombok Timur',
    address: 'Kec. Pringgabaya, Kab. Lombok Timur, NTB',
    latitude: -8.5245,
    longitude: 116.6342,
    defaultRadiusMeters: 250,
  },
  {
    unitId: 'unit_taliwang',
    code: 'PLTU-TLW',
    name: 'PLTU Taliwang — Sumbawa Barat',
    region: 'Sumbawa Barat',
    address: 'Kel. Kertasari, Kec. Taliwang, Kab. Sumbawa Barat, NTB',
    latitude: -8.7308,
    longitude: 116.7975,
    defaultRadiusMeters: 300,
  },
];

export const DEFAULT_OFFICE_CONFIG: OfficeConfig = {
  configId: 'main_hq',
  officeName: 'Indonesia Power Service — PLTU Jeranjang Gerung',
  address: 'Kawasan Pembangkit PLTU Jeranjang, Gerung, Lombok Barat (4 Unit Terintegrasi)',
  latitude: -8.6594,
  longitude: 116.0748,
  radiusMeters: 300,
  shiftStart: '08:00',
  shiftEnd: '17:00',
  lateGraceMinutes: 10,
  autoReminderTime: '07:45',
  updatedBy: 'system',
};

/**
 * Calculates distance in meters between two WGS84 coordinates using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface MultiUnitEvaluation {
  nearestUnit: PowerPlantUnit;
  nearestDistanceMeters: number;
  allowedRadiusMeters: number;
  isWithinAnyUnit: boolean;
  allUnitDistances: Array<{
    unit: PowerPlantUnit;
    distanceMeters: number;
    isInside: boolean;
  }>;
}

/**
 * Evaluates a user's GPS coordinate against all 4 Indonesia Power Service units in Lombok & Sumbawa.
 */
export function evaluateMultiUnitGeofence(
  lat: number,
  lng: number,
  overrideRadiusMeters?: number
): MultiUnitEvaluation {
  const evaluated = IPS_POWER_UNITS.map((unit) => {
    const allowedRadius = overrideRadiusMeters || unit.defaultRadiusMeters;
    const distanceMeters = calculateDistanceMeters(lat, lng, unit.latitude, unit.longitude);
    return {
      unit,
      distanceMeters,
      allowedRadius,
      isInside: distanceMeters <= allowedRadius,
    };
  });

  evaluated.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const closest = evaluated[0];

  return {
    nearestUnit: closest.unit,
    nearestDistanceMeters: closest.distanceMeters,
    allowedRadiusMeters: closest.allowedRadius,
    isWithinAnyUnit: closest.isInside,
    allUnitDistances: evaluated.map((e) => ({
      unit: e.unit,
      distanceMeters: e.distanceMeters,
      isInside: e.isInside,
    })),
  };
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getCurrentTimeHHMMSS(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function calculateLateMinutes(
  checkInTimeHHMM: string,
  shiftStartHHMM: string,
  graceMinutes: number
): number {
  const [inH, inM] = checkInTimeHHMM.split(':').map((n) => parseInt(n, 10) || 0);
  const [shH, shM] = shiftStartHHMM.split(':').map((n) => parseInt(n, 10) || 0);
  const inTotal = inH * 60 + inM;
  const shiftTotal = shH * 60 + shM;
  const diff = inTotal - shiftTotal;
  if (diff <= graceMinutes) return 0;
  return Math.min(1440, Math.max(0, diff));
}

export function calculateWorkDurationMinutes(checkInHHMM: string, checkOutHHMM: string): number {
  const [inH, inM] = checkInHHMM.split(':').map((n) => parseInt(n, 10) || 0);
  const [outH, outM] = checkOutHHMM.split(':').map((n) => parseInt(n, 10) || 0);
  const diff = outH * 60 + outM - (inH * 60 + inM);
  return Math.min(1440, Math.max(1, diff));
}

export function formatCurrencyIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatDurationHoursMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0j 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}
