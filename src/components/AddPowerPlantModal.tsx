import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Compass,
  LocateFixed,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  convertDDToDMS,
  PowerPlantUnit,
  validateStrictGPSCoordinates,
} from '../utils/geo';

interface AddPowerPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUnit: (newUnit: PowerPlantUnit) => Promise<void> | void;
  existingUnits: PowerPlantUnit[];
}

// Preset Clean Energy & Expansion Power Plants in NTB (Lombok & Sumbawa) for rapid testing
const PRESET_EXPANSION_UNITS = [
  {
    code: 'PLTS-SBL',
    name: 'PLTS Sambelia — Lombok Timur',
    region: 'Lombok Timur',
    address: 'Kawasan Pesisir Sambelia, Kab. Lombok Timur, NTB',
    lat: -8.36152,
    lng: 116.68924,
    radius: 250,
  },
  {
    code: 'PLTMG-SBW',
    name: 'PLTMG Sumbawa — Labuhan Badas',
    region: 'Sumbawa',
    address: 'Jl. Pelabuhan Badas, Kec. Labuhan Badas, Kab. Sumbawa, NTB',
    lat: -8.49821,
    lng: 117.43215,
    radius: 300,
  },
  {
    code: 'PLTS-GLT',
    name: 'PLTS Gili Trawangan — Lombok Utara',
    region: 'Lombok Utara',
    address: 'Pulau Gili Trawangan, Kec. Pemenang, Kab. Lombok Utara, NTB',
    lat: -8.35024,
    lng: 116.03812,
    radius: 200,
  },
  {
    code: 'PLTD-SLG',
    name: 'PLTD Selong — Lombok Timur',
    region: 'Lombok Timur',
    address: 'Kec. Selong, Kab. Lombok Timur, NTB',
    lat: -8.64921,
    lng: 116.5314,
    radius: 250,
  },
];

export const AddPowerPlantModal: React.FC<AddPowerPlantModalProps> = ({
  isOpen,
  onClose,
  onAddUnit,
  existingUnits,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('Lombok Barat');
  const [address, setAddress] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(250);
  const [locating, setLocating] = useState(false);
  const [gpsSourceMessage, setGpsSourceMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Perform strict real-time GPS and form validation
  const validation = useMemo(() => {
    return validateStrictGPSCoordinates(latInput, lngInput, {
      code,
      name,
      radiusMeters,
      existingUnits,
    });
  }, [latInput, lngInput, code, name, radiusMeters, existingUnits]);

  // Derived DMS strings for visual confirmation
  const dmsLat = useMemo(() => {
    if (validation.lat !== undefined) {
      return convertDDToDMS(validation.lat, true);
    }
    return null;
  }, [validation.lat]);

  const dmsLng = useMemo(() => {
    if (validation.lng !== undefined) {
      return convertDDToDMS(validation.lng, false);
    }
    return null;
  }, [validation.lng]);

  const handleAcquireDeviceGPS = () => {
    if (!navigator.geolocation) {
      setGpsSourceMessage('Perangkat Anda tidak mendukung HTML5 Geolocation API.');
      return;
    }
    setLocating(true);
    setGpsSourceMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const acc = Math.round(pos.coords.accuracy || 10);
        setLatInput(lat);
        setLngInput(lng);
        setLocating(false);
        setGpsSourceMessage(
          `Titik GPS berhasil diperoleh dari sensor perangkat (Akurasi: ±${acc}m).`
        );
      },
      (err) => {
        setLocating(false);
        setGpsSourceMessage(
          `Gagal membaca sinyal GPS: ${err.message || 'Izin akses lokasi ditolak oleh browser.'}`
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleApplyPreset = (preset: typeof PRESET_EXPANSION_UNITS[0]) => {
    setCode(preset.code);
    setName(preset.name);
    setRegion(preset.region);
    setAddress(preset.address);
    setLatInput(preset.lat.toFixed(6));
    setLngInput(preset.lng.toFixed(6));
    setRadiusMeters(preset.radius);
    setGpsSourceMessage(`Koordinat preset unit ${preset.code} diterapkan.`);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid || validation.lat === undefined || validation.lng === undefined) {
      setSubmitError('Silakan lengkapi dan perbaiki format koordinat GPS yang bertanda merah.');
      return;
    }

    if (!address.trim()) {
      setSubmitError('Alamat lengkap unit pembangkit wajib diisi.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const sanitizedUnitId = `unit_${code.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
      const newUnit: PowerPlantUnit = {
        unitId: sanitizedUnitId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        region: region.trim(),
        address: address.trim(),
        latitude: validation.lat,
        longitude: validation.lng,
        defaultRadiusMeters: radiusMeters,
        isCustom: true,
        addedAt: new Date().toISOString(),
      };

      await onAddUnit(newUnit);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyimpan unit pembangkit baru.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Tambah Koordinat Unit Pembangkit Baru (Geofence)
              </h3>
              <p className="text-[11px] text-slate-500">
                Pendaftaran zona koordinat resmi WGS84 dengan validasi presisi ketat untuk sistem absensi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Quick-fill Template Chips */}
          <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Templat Cepat Unit Pembangkit Baru Wilayah NTB:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {PRESET_EXPANSION_UNITS.map((preset) => (
                <button
                  key={preset.code}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-medium transition-colors"
                >
                  + {preset.code} ({preset.region})
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields Section 1: Identitas Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Kode Unit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={16}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Contoh: PLTS-SBL"
                className={`w-full px-3 py-2 border rounded-lg font-mono uppercase ${
                  validation.codeError ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                }`}
              />
              {validation.codeError && (
                <p className="text-[11px] text-red-600 mt-0.5">{validation.codeError}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-medium mb-1">
                Nama Unit Pembangkit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: PLTS Sambelia — Lombok Timur"
                className={`w-full px-3 py-2 border rounded-lg ${
                  validation.nameError ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                }`}
              />
              {validation.nameError && (
                <p className="text-[11px] text-red-600 mt-0.5">{validation.nameError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Wilayah / Kabupaten <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Contoh: Lombok Timur"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-medium mb-1">
                Alamat Lokasi Pembangkit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={250}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat lengkap / jalan / desa pembangkit"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Form Fields Section 2: Strict GPS Coordinates */}
          <div className="border border-slate-200 rounded-xl p-4 bg-emerald-50/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Compass className="w-4 h-4 text-emerald-700" />
                <span>Koordinat Geografis WGS84 (Presisi Ketat)</span>
              </div>

              <button
                type="button"
                disabled={locating}
                onClick={handleAcquireDeviceGPS}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-md font-medium text-[11px] transition-colors"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                {locating ? 'Mengambil GPS...' : 'Ambil GPS Perangkat'}
              </button>
            </div>

            {gpsSourceMessage && (
              <p className="text-[11px] text-emerald-800 bg-emerald-100/60 px-2.5 py-1 rounded">
                {gpsSourceMessage}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Latitude Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-medium">
                    Latitude (Garis Lintang) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">Rentang: -90 s/d +90</span>
                </div>
                <input
                  type="text"
                  required
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="Contoh: -8.659421"
                  className={`w-full px-3 py-2 font-mono tabular-nums border rounded-lg ${
                    validation.latError ? 'border-red-400 bg-red-50/60' : 'border-slate-300 bg-white'
                  }`}
                />
                {validation.latError ? (
                  <p className="text-[11px] text-red-600 mt-1">{validation.latError}</p>
                ) : (
                  dmsLat && (
                    <p className="text-[11px] text-emerald-700 mt-1 font-mono">
                      Format DMS: {dmsLat}
                    </p>
                  )
                )}
              </div>

              {/* Longitude Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-medium">
                    Longitude (Garis Bujur) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">Rentang: -180 s/d +180</span>
                </div>
                <input
                  type="text"
                  required
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  placeholder="Contoh: 116.074812"
                  className={`w-full px-3 py-2 font-mono tabular-nums border rounded-lg ${
                    validation.lngError ? 'border-red-400 bg-red-50/60' : 'border-slate-300 bg-white'
                  }`}
                />
                {validation.lngError ? (
                  <p className="text-[11px] text-red-600 mt-1">{validation.lngError}</p>
                ) : (
                  dmsLng && (
                    <p className="text-[11px] text-emerald-700 mt-1 font-mono">
                      Format DMS: {dmsLng}
                    </p>
                  )
                )}
              </div>
            </div>

            {validation.proximityError && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-[11px] flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{validation.proximityError}</span>
              </div>
            )}
          </div>

          {/* Form Fields Section 3: Radius Geofence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Radius Geofence Maksimum (Meter) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={20}
                max={5000}
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10) || 250)}
                className={`w-full px-3 py-2 font-mono tabular-nums border rounded-lg ${
                  validation.radiusError ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                }`}
              />
              {validation.radiusError && (
                <p className="text-[11px] text-red-600 mt-0.5">{validation.radiusError}</p>
              )}
            </div>

            <div>
              <span className="block text-slate-500 font-medium mb-1">Pilihan Cepat Radius:</span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[150, 250, 300, 500].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusMeters(r)}
                    className={`px-3 py-1.5 border rounded text-xs font-mono font-medium transition-colors ${
                      radiusMeters === r
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {r}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Strict Validation Verification Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[11px]">
            <span className="font-semibold text-slate-800 block">
              Parameter Validasi Format Koordinat GPS:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    !validation.latError && latInput ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span>Latitude Desimal WGS84 (-90 s/d +90, ≥4 desimal)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    !validation.lngError && lngInput ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span>Longitude Desimal WGS84 (-180 s/d +180, ≥4 desimal)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    !validation.codeError && code ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span>Format Kode Unit Unik & Terstandarisasi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    !validation.proximityError && latInput && lngInput
                      ? 'text-emerald-600'
                      : 'text-slate-300'
                  }`}
                />
                <span>Bebas Duplikasi Tumpang Tindih (&gt;30m dari unit lain)</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !validation.isValid}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Menyimpan Unit...' : 'Simpan Koordinat Unit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
