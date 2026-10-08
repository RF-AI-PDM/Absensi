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
  isCustom?: boolean;
  addedAt?: string;
}

export const POWER_UNITS_STORAGE_KEY = 'hadirot_power_plant_units_v1';

export function getRegisteredPowerUnits(): PowerPlantUnit[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(POWER_UNITS_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return IPS_POWER_UNITS;
}

export function saveRegisteredPowerUnits(units: PowerPlantUnit[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(POWER_UNITS_STORAGE_KEY, JSON.stringify(units));
    }
  } catch (err) {
    console.error('Failed to save power units to localStorage:', err);
  }
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
 * Converts decimal degrees coordinate to standardized DMS (Degrees Minutes Seconds) string.
 */
export function convertDDToDMS(coordinate: number, isLatitude: boolean): string {
  if (isNaN(coordinate)) return '-';
  const absolute = Math.abs(coordinate);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);

  let cardinal = '';
  if (isLatitude) {
    cardinal = coordinate >= 0 ? 'LU (N)' : 'LS (S)';
  } else {
    cardinal = coordinate >= 0 ? 'BT (E)' : 'BB (W)';
  }

  return `${degrees}°${minutes}'${seconds}" ${cardinal}`;
}

export interface StrictGPSValidationOutput {
  isValid: boolean;
  latError?: string;
  lngError?: string;
  codeError?: string;
  nameError?: string;
  radiusError?: string;
  proximityError?: string;
  lat?: number;
  lng?: number;
}

/**
 * Validates strict WGS84 GPS coordinate precision and range.
 * Requires minimum 4 decimal digits (~11m precision) up to 8 decimal digits,
 * valid global bounds (-90 to +90 lat, -180 to +180 lng), and duplicate proximity check.
 */
export function validateStrictGPSCoordinates(
  latStr: string,
  lngStr: string,
  options?: {
    code?: string;
    name?: string;
    radiusMeters?: number;
    existingUnits?: PowerPlantUnit[];
    excludeUnitId?: string;
  }
): StrictGPSValidationOutput {
  const latTrim = latStr.trim();
  const lngTrim = lngStr.trim();

  let latError: string | undefined;
  let lngError: string | undefined;
  let codeError: string | undefined;
  let nameError: string | undefined;
  let radiusError: string | undefined;
  let proximityError: string | undefined;

  // Strict regex requiring at least 4 and up to 8 decimals
  const latRegex = /^-?([0-8]?[0-9](\.[0-9]{4,8})|90(\.0{4,8}))$/;
  const lngRegex = /^-?((1[0-7][0-9]|[0-9]?[0-9])(\.[0-9]{4,8})|180(\.0{4,8}))$/;

  if (!latTrim) {
    latError = 'Latitude (Garis Lintang) wajib diisi.';
  } else if (!latRegex.test(latTrim)) {
    if (isNaN(Number(latTrim))) {
      latError = 'Latitude harus berupa angka desimal valid.';
    } else {
      const num = Number(latTrim);
      if (num < -90 || num > 90) {
        latError = 'Latitude harus berada di rentang -90.0000 s/d +90.0000.';
      } else {
        latError = 'Presisi GPS tidak mencukupi: minimal 4 angka desimal di belakang koma diperlukan (contoh: -8.6594).';
      }
    }
  }

  if (!lngTrim) {
    lngError = 'Longitude (Garis Bujur) wajib diisi.';
  } else if (!lngRegex.test(lngTrim)) {
    if (isNaN(Number(lngTrim))) {
      lngError = 'Longitude harus berupa angka desimal valid.';
    } else {
      const num = Number(lngTrim);
      if (num < -180 || num > 180) {
        lngError = 'Longitude harus berada di rentang -180.0000 s/d +180.0000.';
      } else {
        lngError = 'Presisi GPS tidak mencukupi: minimal 4 angka desimal di belakang koma diperlukan (contoh: 116.0748).';
      }
    }
  }

  const parsedLat = !latError ? Number(latTrim) : undefined;
  const parsedLng = !lngError ? Number(lngTrim) : undefined;

  // Additional field checks if provided
  if (options) {
    if (options.code !== undefined) {
      const codeTrim = options.code.trim().toUpperCase();
      const codeRegex = /^[A-Z0-9]{2,8}(-[A-Z0-9]{2,8})*$/;
      if (!codeTrim) {
        codeError = 'Kode Unit wajib diisi.';
      } else if (codeTrim.length < 3 || codeTrim.length > 16) {
        codeError = 'Kode Unit harus 3 s/d 16 karakter (contoh: PLTS-SBL).';
      } else if (!codeRegex.test(codeTrim)) {
        codeError = 'Format Kode Unit tidak valid (gunakan huruf kapital, angka, dan tanda hubung).';
      } else if (
        options.existingUnits?.some(
          (u) => u.unitId !== options.excludeUnitId && u.code.toUpperCase() === codeTrim
        )
      ) {
        codeError = `Kode Unit "${codeTrim}" sudah digunakan oleh unit lain.`;
      }
    }

    if (options.name !== undefined) {
      const nameTrim = options.name.trim();
      if (!nameTrim) {
        nameError = 'Nama Unit Pembangkit wajib diisi.';
      } else if (nameTrim.length < 3 || nameTrim.length > 100) {
        nameError = 'Nama Unit harus memiliki panjang antara 3 hingga 100 karakter.';
      } else if (
        options.existingUnits?.some(
          (u) =>
            u.unitId !== options.excludeUnitId &&
            u.name.toLowerCase() === nameTrim.toLowerCase()
        )
      ) {
        nameError = `Nama Unit "${nameTrim}" sudah terdaftar dalam sistem.`;
      }
    }

    if (options.radiusMeters !== undefined) {
      if (isNaN(options.radiusMeters) || options.radiusMeters < 20 || options.radiusMeters > 5000) {
        radiusError = 'Radius geofence harus berada di antara 20 meter hingga 5000 meter.';
      }
    }

    // Proximity duplicate check against existing units
    if (parsedLat !== undefined && parsedLng !== undefined && options.existingUnits) {
      for (const existing of options.existingUnits) {
        if (existing.unitId === options.excludeUnitId) continue;
        const dist = calculateDistanceMeters(parsedLat, parsedLng, existing.latitude, existing.longitude);
        if (dist < 30) {
          proximityError = `Koordinat terlalu dekat (${dist} meter) dengan unit "${existing.name}". Unit pembangkit tidak boleh bertumpuk.`;
          break;
        }
      }
    }
  }

  const isValid =
    !latError &&
    !lngError &&
    !codeError &&
    !nameError &&
    !radiusError &&
    !proximityError;

  return {
    isValid,
    latError,
    lngError,
    codeError,
    nameError,
    radiusError,
    proximityError,
    lat: parsedLat,
    lng: parsedLng,
  };
}

/**
 * Evaluates a user's GPS coordinate against all registered Indonesia Power Service units in Lombok & Sumbawa.
 */
export function evaluateMultiUnitGeofence(
  lat: number,
  lng: number,
  overrideRadiusMeters?: number,
  customUnits?: PowerPlantUnit[]
): MultiUnitEvaluation {
  const unitsToEvaluate = customUnits && customUnits.length > 0 ? customUnits : getRegisteredPowerUnits();
  const evaluated = unitsToEvaluate.map((unit) => {
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
  const closest = evaluated[0] || {
    unit: IPS_POWER_UNITS[0],
    distanceMeters: 999999,
    allowedRadius: 300,
    isInside: false,
  };

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

export function getNDaysAgoDateStr(days: number, fromDate?: string): string {
  const base = fromDate ? new Date(fromDate + 'T12:00:00') : new Date();
  base.setDate(base.getDate() - days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getFirstDayOfMonthDateStr(monthStr?: string): string {
  if (monthStr && monthStr.includes('-')) {
    return `${monthStr}-01`;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const monthIndex = parseInt(m, 10) - 1;
  const monthName = monthNames[monthIndex] || m;
  return `${d} ${monthName} ${y}`;
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
