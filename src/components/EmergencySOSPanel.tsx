import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
    ShieldAlert, Phone, Siren, Cross, MapPin, Navigation,
    Loader2, AlertTriangle, RefreshCw, Locate, Hospital, PhoneCall,
} from 'lucide-react';
import { useNearbyEmergency, EmergencyPlace } from '@/hooks/useNearbyEmergency';
import { Button } from '@/components/ui/button';

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface Props {
    destination?: string;
}

const EMERGENCY_NUMBERS = [
    { label: 'Police', number: '100', icon: Siren, color: 'from-blue-600 to-blue-800', iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400' },
    { label: 'Ambulance', number: '108', icon: Hospital, color: 'from-red-600 to-red-800', iconBg: 'bg-red-500/20', iconColor: 'text-red-400' },
    { label: 'Fire', number: '101', icon: AlertTriangle, color: 'from-orange-600 to-orange-800', iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400' },
    { label: 'Emergency', number: '112', icon: Phone, color: 'from-emerald-600 to-emerald-800', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
];

const EmergencySOSPanel = ({ destination }: Props) => {
    const { policeStations, hospitals, userLat, userLng, loading, error, usingGeolocation, refetch } = useNearbyEmergency(destination);
    const [popupPlace, setPopupPlace] = useState<(EmergencyPlace & { type: 'police' | 'hospital' }) | null>(null);
    const [sosActivated, setSosActivated] = useState(false);

    const handleSOS = () => {
        setSosActivated(true);
        window.location.href = 'tel:112';
        setTimeout(() => setSosActivated(false), 3000);
    };

    const openDirections = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    const mapCenter = {
        latitude: userLat || 0,
        longitude: userLng || 0,
        zoom: 13,
    };

    return (
        <div className="space-y-5">
            {/* ── SOS Hero Section ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-950 via-red-900 to-rose-950 p-6 shadow-xl"
            >
                {/* Decorative pulse rings */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <motion.div
                        animate={{ scale: [1, 2.5], opacity: [0.15, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                        className="absolute h-32 w-32 rounded-full border-2 border-red-400"
                    />
                    <motion.div
                        animate={{ scale: [1, 2.5], opacity: [0.1, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                        className="absolute h-32 w-32 rounded-full border-2 border-red-400"
                    />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <motion.div
                        animate={{ scale: sosActivated ? [1, 1.1, 1] : 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <ShieldAlert className="mb-2 h-8 w-8 text-red-300" />
                    </motion.div>
                    <h2 className="font-display text-xl font-bold text-white">Emergency SOS</h2>
                    <p className="mt-1 text-sm text-red-200/80">Tap the SOS button to call emergency services immediately</p>

                    <motion.button
                        onClick={handleSOS}
                        whileTap={{ scale: 0.92 }}
                        className={`mt-5 flex h-28 w-28 items-center justify-center rounded-full shadow-2xl transition-all duration-300 ${sosActivated
                                ? 'bg-white text-red-600 shadow-red-500/50'
                                : 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-red-700/40 hover:from-red-400 hover:to-red-600'
                            }`}
                    >
                        <motion.div
                            animate={sosActivated ? {} : { scale: [1, 1.08, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            className="flex flex-col items-center"
                        >
                            <PhoneCall className="h-8 w-8" />
                            <span className="mt-1 font-display text-lg font-black tracking-wider">SOS</span>
                        </motion.div>
                    </motion.button>

                    {usingGeolocation && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-red-300/70">
                            <Locate className="h-3 w-3" />
                            <span>Using your live location</span>
                        </div>
                    )}
                    {!usingGeolocation && destination && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-red-300/70">
                            <MapPin className="h-3 w-3" />
                            <span>Based on: {destination}</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── Quick Dial Grid ── */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
                {EMERGENCY_NUMBERS.map((em) => {
                    const Icon = em.icon;
                    return (
                        <a
                            key={em.number}
                            href={`tel:${em.number}`}
                            className={`group relative flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br ${em.color} p-4 text-white shadow-lg transition-all hover:scale-[1.03] hover:shadow-xl active:scale-[0.97]`}
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${em.iconBg}`}>
                                <Icon className={`h-5 w-5 ${em.iconColor}`} />
                            </div>
                            <span className="text-xs font-semibold opacity-90">{em.label}</span>
                            <span className="font-display text-lg font-black">{em.number}</span>
                            <div className="absolute right-2 top-2 rounded-full bg-white/10 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Phone className="h-3 w-3" />
                            </div>
                        </a>
                    );
                })}
            </motion.div>

            {/* ── Nearby Services Map ── */}
            {loading ? (
                <div className="flex h-64 items-center justify-center rounded-xl bg-card">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Locating nearby emergency services…</span>
                </div>
            ) : error ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center rounded-xl bg-card p-8"
                >
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                    <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                    </Button>
                </motion.div>
            ) : (
                <>
                    {/* Map */}
                    {mapboxToken && userLat && userLng && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="relative h-[350px] overflow-hidden rounded-xl border border-border shadow-card lg:h-[420px]"
                        >
                            <Map
                                initialViewState={mapCenter}
                                mapboxAccessToken={mapboxToken}
                                mapStyle="mapbox://styles/mapbox/dark-v11"
                                style={{ width: '100%', height: '100%' }}
                                attributionControl={false}
                            >
                                <NavigationControl position="top-right" />

                                {/* User location marker */}
                                <Marker longitude={userLng} latitude={userLat} anchor="center">
                                    <div className="relative">
                                        <motion.div
                                            animate={{ scale: [1, 2], opacity: [0.4, 0] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="absolute -inset-3 rounded-full bg-blue-500"
                                        />
                                        <div className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow-lg">
                                            <div className="h-2 w-2 rounded-full bg-white" />
                                        </div>
                                    </div>
                                </Marker>

                                {/* Police markers */}
                                {policeStations.map((p, i) => (
                                    <Marker
                                        key={`police-${i}`}
                                        longitude={p.lng}
                                        latitude={p.lat}
                                        anchor="bottom"
                                        onClick={(e) => {
                                            e.originalEvent.stopPropagation();
                                            setPopupPlace({ ...p, type: 'police' });
                                        }}
                                    >
                                        <div className="group cursor-pointer">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-400 bg-blue-950 shadow-lg transition-transform group-hover:scale-110">
                                                <ShieldAlert className="h-4 w-4 text-blue-400" />
                                            </div>
                                        </div>
                                    </Marker>
                                ))}

                                {/* Hospital markers */}
                                {hospitals.map((h, i) => (
                                    <Marker
                                        key={`hospital-${i}`}
                                        longitude={h.lng}
                                        latitude={h.lat}
                                        anchor="bottom"
                                        onClick={(e) => {
                                            e.originalEvent.stopPropagation();
                                            setPopupPlace({ ...h, type: 'hospital' });
                                        }}
                                    >
                                        <div className="group cursor-pointer">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-400 bg-red-950 shadow-lg transition-transform group-hover:scale-110">
                                                <Cross className="h-4 w-4 text-red-400" />
                                            </div>
                                        </div>
                                    </Marker>
                                ))}

                                {/* Popup */}
                                <AnimatePresence>
                                    {popupPlace && (
                                        <Popup
                                            longitude={popupPlace.lng}
                                            latitude={popupPlace.lat}
                                            anchor="bottom"
                                            offset={16}
                                            onClose={() => setPopupPlace(null)}
                                            closeButton
                                            closeOnClick={false}
                                        >
                                            <div className="max-w-[220px] p-1">
                                                <div className="mb-1 flex items-center gap-1.5">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${popupPlace.type === 'police' ? 'bg-blue-600' : 'bg-red-600'
                                                            }`}
                                                    >
                                                        {popupPlace.type === 'police' ? '🚔 Police' : '🏥 Hospital'}
                                                    </span>
                                                </div>
                                                <h4 className="font-display text-sm font-semibold">{popupPlace.name}</h4>
                                                <p className="mt-0.5 text-[11px] text-gray-500">📍 {popupPlace.distance} km away</p>
                                                <div className="mt-2 flex gap-1.5">
                                                    <button
                                                        onClick={() => openDirections(popupPlace.lat, popupPlace.lng)}
                                                        className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
                                                    >
                                                        <Navigation className="h-3 w-3" /> Navigate
                                                    </button>
                                                </div>
                                            </div>
                                        </Popup>
                                    )}
                                </AnimatePresence>
                            </Map>

                            {/* Map legend */}
                            <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg bg-card/90 px-3 py-2 shadow-elevated backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-[11px]">
                                    <div className="h-3 w-3 rounded-full border-2 border-blue-400 bg-blue-950" />
                                    <span className="text-muted-foreground">Police Station</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <div className="h-3 w-3 rounded-full border-2 border-red-400 bg-red-950" />
                                    <span className="text-muted-foreground">Hospital</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <div className="h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                                    <span className="text-muted-foreground">Your Location</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Nearest Police Stations List ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-xl bg-card p-5 shadow-card"
                    >
                        <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            <ShieldAlert className="h-4 w-4 text-blue-500" /> Nearest Police Stations
                        </h3>
                        {policeStations.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">No police stations found nearby</p>
                        ) : (
                            <div className="space-y-2.5">
                                {policeStations.map((p, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary/80"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                                            <ShieldAlert className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{p.address}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <span className="whitespace-nowrap rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                                                {p.distance} km
                                            </span>
                                            <button
                                                onClick={() => openDirections(p.lat, p.lng)}
                                                className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500"
                                                title="Navigate"
                                            >
                                                <Navigation className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* ── Nearest Hospitals List ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="rounded-xl bg-card p-5 shadow-card"
                    >
                        <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            <Cross className="h-4 w-4 text-red-500" /> Nearest Hospitals
                        </h3>
                        {hospitals.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">No hospitals found nearby</p>
                        ) : (
                            <div className="space-y-2.5">
                                {hospitals.map((h, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary/80"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                                            <Cross className="h-5 w-5 text-red-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">{h.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{h.address}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <span className="whitespace-nowrap rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
                                                {h.distance} km
                                            </span>
                                            <button
                                                onClick={() => openDirections(h.lat, h.lng)}
                                                className="rounded-lg bg-red-600 p-2 text-white transition-colors hover:bg-red-500"
                                                title="Navigate"
                                            >
                                                <Navigation className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Refresh */}
                    <div className="flex justify-center">
                        <Button variant="ghost" size="sm" onClick={refetch} className="text-muted-foreground hover:text-foreground">
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh Nearby Services
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};

export default EmergencySOSPanel;
