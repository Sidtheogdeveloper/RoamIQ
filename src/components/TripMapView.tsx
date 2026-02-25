import { useState, useRef, useMemo } from 'react';
import Map, { Marker, Source, Layer, NavigationControl, Popup } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Tables } from '@/integrations/supabase/types';
import { Loader2, MapPin, Plane, Hotel, Camera, Utensils, Bus, Coffee, AlertTriangle, Navigation, Clock, Route, Zap, ArrowRight } from 'lucide-react';
import { GeocodedItem, RouteData, RouteSegment } from '@/hooks/useTripRoutes';

type ItineraryItem = Tables<'itinerary_items'>;

interface Props {
  items: ItineraryItem[];
  destination: string;
  selectedDay: number;
  allGeocoded: GeocodedItem[];
  dayRoutes: Record<number, RouteData>;
  tripStats: {
    total_km: number;
    total_min: number;
    total_traffic_min: number;
    isFallback: boolean;
  } | null;
  loading: boolean;
}

const markerColors: Record<string, string> = {
  departure: 'hsl(187, 63%, 32%)',
  arrival: 'hsl(152, 56%, 40%)',
  hotel_checkin: 'hsl(36, 90%, 55%)',
  hotel_checkout: 'hsl(36, 90%, 55%)',
  activity: 'hsl(210, 70%, 55%)',
  meal: 'hsl(36, 90%, 55%)',
  transport: 'hsl(200, 10%, 46%)',
  free_time: 'hsl(152, 56%, 40%)',
};

const markerIcons: Record<string, React.ElementType> = {
  departure: Plane,
  arrival: Plane,
  hotel_checkin: Hotel,
  hotel_checkout: Hotel,
  activity: Camera,
  meal: Utensils,
  transport: Bus,
  free_time: Coffee,
};

const DAY_COLORS = [
  '#0ea5e9', '#f59e0b', '#10b981', '#f43f5e',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
];

const CONGESTION_COLORS: Record<string, string> = {
  low: '#22c55e',     // green
  moderate: '#f59e0b', // amber
  heavy: '#ef4444',   // red
  severe: '#dc2626',  // dark red
  unknown: '#6b7280', // gray
};

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const TripMapView = ({ items, destination, selectedDay, allGeocoded, dayRoutes, tripStats, loading }: Props) => {
  const [popupItem, setPopupItem] = useState<GeocodedItem | null>(null);

  // Calculate initial viewState dynamically just to initialize the Map component safely
  const initialViewState = useMemo(() => {
    if (allGeocoded.length > 0) {
      const lats = allGeocoded.map((g) => g.lat);
      const lngs = allGeocoded.map((g) => g.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      return { longitude: centerLng, latitude: centerLat, zoom: 12, pitch: 0 };
    }
    return { longitude: 0, latitude: 0, zoom: 12, pitch: 0 };
  }, [allGeocoded]);

  const [viewState, setViewState] = useState(initialViewState);
  const mapRef = useRef<MapRef>(null);

  const maxDay = useMemo(() => Math.max(...items.map(i => i.day_number), 1), [items]);

  // Items for current day vs other days
  const currentDayGeocoded = useMemo(
    () => allGeocoded.filter(g => g.day_number === selectedDay),
    [allGeocoded, selectedDay]
  );
  const otherDayGeocoded = useMemo(
    () => allGeocoded.filter(g => g.day_number !== selectedDay),
    [allGeocoded, selectedDay]
  );

  if (!mapboxToken) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl bg-card text-muted-foreground">
        <p>Map token not configured</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading Map & Routes...</span>
      </div>
    );
  }

  return (
    <div className="relative h-[500px] overflow-hidden rounded-xl border border-border shadow-card lg:h-[600px]">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={mapboxToken}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        projection={{ name: 'globe' } as any}
        fog={{
          color: 'rgb(186, 210, 235)',
          'high-color': 'rgb(36, 92, 223)',
          'horizon-blend': 0.02,
          'space-color': 'rgb(11, 11, 25)',
          'star-intensity': 0.6,
        } as any}
      >
        <NavigationControl position="top-right" />

        {/* Other day route polylines (dimmed) — real road routes */}
        {Object.entries(dayRoutes)
          .filter(([day]) => Number(day) !== selectedDay)
          .map(([day, route]) => (
            <Source key={`route-day-${day}`} id={`route-day-${day}`} type="geojson" data={route.geojson}>
              <Layer
                id={`route-line-day-${day}`}
                type="line"
                paint={{
                  'line-color': DAY_COLORS[(Number(day) - 1) % DAY_COLORS.length],
                  'line-width': 3,
                  'line-opacity': 0.3,
                }}
              />
            </Source>
          ))}

        {/* Current day SEGMENT routes (traffic-colored per leg) */}
        {dayRoutes[selectedDay]?.segments?.map((seg, i) => (
          seg.geojson && (
            <Source key={`seg-current-${i}`} id={`seg-current-${i}`} type="geojson" data={seg.geojson}>
              <Layer
                id={`seg-line-current-${i}`}
                type="line"
                paint={{
                  'line-color': CONGESTION_COLORS[seg.congestion] || CONGESTION_COLORS.unknown,
                  'line-width': 6,
                  'line-opacity': 0.85,
                }}
              />
            </Source>
          )
        ))}

        {/* Fallback: full route if no segments */}
        {dayRoutes[selectedDay] && (!dayRoutes[selectedDay].segments?.length || !dayRoutes[selectedDay].segments.some(s => s.geojson)) && (
          <Source id="route-current" type="geojson" data={dayRoutes[selectedDay].geojson}>
            <Layer
              id="route-line-current"
              type="line"
              paint={{
                'line-color': DAY_COLORS[(selectedDay - 1) % DAY_COLORS.length],
                'line-width': 5,
                'line-opacity': 0.9,
              }}
            />
          </Source>
        )}

        {/* Other day markers (dimmed, smaller) */}
        {otherDayGeocoded.map((item) => {
          const Icon = markerIcons[item.item_type] || MapPin;
          const dayColor = DAY_COLORS[(item.day_number - 1) % DAY_COLORS.length];
          return (
            <Marker
              key={item.id}
              longitude={item.lng}
              latitude={item.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupItem(item);
              }}
            >
              <div className="group relative cursor-pointer opacity-40 transition-opacity hover:opacity-80">
                <div
                  className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold"
                  style={{ backgroundColor: dayColor, color: '#fff' }}
                >
                  {item.day_number}
                </div>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm"
                  style={{ backgroundColor: '#fff', borderColor: dayColor }}
                >
                  <Icon className="h-3 w-3" style={{ color: dayColor }} />
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Current day markers (full size, bright) */}
        {currentDayGeocoded.map((item, i) => {
          const Icon = markerIcons[item.item_type] || MapPin;
          const color = markerColors[item.item_type] || 'hsl(210, 70%, 55%)';
          return (
            <Marker
              key={item.id}
              longitude={item.lng}
              latitude={item.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupItem(item);
              }}
            >
              <div className="group relative cursor-pointer">
                <div
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: color, color: '#fff' }}
                >
                  {i + 1}
                </div>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-elevated transition-transform group-hover:scale-110"
                  style={{ backgroundColor: '#fff', borderColor: color }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Popup */}
        {popupItem && (
          <Popup
            longitude={popupItem.lng}
            latitude={popupItem.lat}
            anchor="bottom"
            offset={16}
            onClose={() => setPopupItem(null)}
            closeButton
            closeOnClick={false}
          >
            <div className="max-w-[200px] p-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: DAY_COLORS[(popupItem.day_number - 1) % DAY_COLORS.length] }}
                >
                  Day {popupItem.day_number}
                </span>
              </div>
              <h4 className="font-display text-sm font-semibold">{popupItem.title}</h4>
              {popupItem.description && (
                <p className="mt-1 text-xs text-muted-foreground">{popupItem.description}</p>
              )}
              {popupItem.start_time && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {popupItem.start_time}
                  {popupItem.end_time ? ` - ${popupItem.end_time}` : ''}
                </p>
              )}
              {popupItem.location && (
                <p className="mt-0.5 text-xs text-muted-foreground">{popupItem.location}</p>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 rounded-lg bg-card/90 px-3 py-2 shadow-elevated backdrop-blur-sm">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Days</p>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => {
            const count = allGeocoded.filter(g => g.day_number === day).length;
            if (count === 0) return null;
            return (
              <div
                key={day}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity ${day === selectedDay ? 'opacity-100' : 'opacity-50'
                  }`}
                style={{
                  backgroundColor: DAY_COLORS[(day - 1) % DAY_COLORS.length] + '22',
                  color: DAY_COLORS[(day - 1) % DAY_COLORS.length],
                  border: `1px solid ${DAY_COLORS[(day - 1) % DAY_COLORS.length]}40`,
                }}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DAY_COLORS[(day - 1) % DAY_COLORS.length] }} />
                Day {day} ({count})
              </div>
            );
          })}
        </div>
      </div>

      {/* Item count */}
      <div className="absolute right-3 top-3 rounded-lg bg-card/90 px-3 py-1.5 shadow-elevated backdrop-blur-sm">
        <span className="text-xs font-medium text-foreground">
          {allGeocoded.length} locations total
          {currentDayGeocoded.length > 0 && ` | Day ${selectedDay}: ${currentDayGeocoded.length}`}
        </span>
      </div>

      {/* Trip stats overlay */}
      {tripStats && (
        <div className="absolute left-3 top-3 max-w-[260px] rounded-xl bg-card/95 px-4 py-3 shadow-elevated backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-1.5">
            <Route className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Trip Route</span>
            {dayRoutes[selectedDay]?.isOptimized && (
              <span className="ml-auto flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                <Zap className="h-2.5 w-2.5" /> Optimized
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Navigation className="h-3 w-3" /> Distance
              </span>
              <span className="text-sm font-bold text-foreground">{tripStats.total_km} km</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Est. Drive
              </span>
              <span className="text-sm font-bold text-foreground">
                {tripStats.total_min >= 60
                  ? `${Math.floor(tripStats.total_min / 60)}h ${tripStats.total_min % 60}m`
                  : `${tripStats.total_min}m`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> With Traffic
              </span>
              <span className="text-sm font-bold text-foreground">
                {tripStats.total_traffic_min >= 60
                  ? `${Math.floor(tripStats.total_traffic_min / 60)}h ${tripStats.total_traffic_min % 60}m`
                  : `${tripStats.total_traffic_min}m`}
              </span>
            </div>

            {/* Per-segment traffic breakdown for selected day */}
            {dayRoutes[selectedDay]?.segments && dayRoutes[selectedDay].segments.length > 0 && (
              <div className="mt-1.5 border-t border-border pt-1.5">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Day {selectedDay} — Segments</p>
                <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                  {dayRoutes[selectedDay].segments.map((seg, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1">
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CONGESTION_COLORS[seg.congestion] }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-medium text-foreground">
                          {seg.from} <ArrowRight className="inline h-2 w-2" /> {seg.to}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {seg.distance_km}km · {seg.duration_traffic_min}min · {seg.congestion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Traffic legend */}
            <div className="mt-1.5 flex gap-2 border-t border-border pt-1.5">
              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Low
              </span>
              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Moderate
              </span>
              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" /> Heavy
              </span>
            </div>
          </div>
          {tripStats.isFallback && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" />
              <p className="text-[10px] leading-tight text-amber-700">
                <strong>Prototype:</strong> Traffic data for future dates uses conditions from 2 days ago as an estimate.
              </p>
            </div>
          )}
        </div>
      )}

      {allGeocoded.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm">
          <div className="text-center">
            <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No geocoded locations found</p>
            <p className="text-xs text-muted-foreground">Add activities with locations to see them on the map</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMapView;
