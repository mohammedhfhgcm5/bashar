import { useEffect } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Link } from 'react-router-dom'
import { damageLevelLabel, reportStatusLabel, type DamageLevel } from '@damage/shared'
import type { MapFeatureCollection } from '../api'

const damageColor: Record<DamageLevel, string> = {
  LOW: '#2f6f4e',
  MEDIUM: '#a16207',
  HIGH: '#c2410c',
  CRITICAL: '#9f1239',
}

function damageIcon(color: string) {
  return L.divIcon({
    className: 'damage-pin',
    html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

export type BBox = { west: number; south: number; east: number; north: number }

function BoundsWatcher({ onBounds }: { onBounds: (box: BBox) => void }) {
  const map = useMap()
  const publish = () => {
    const bounds = map.getBounds()
    onBounds({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    })
  }
  useMapEvents({ moveend: publish })
  useEffect(() => {
    publish()
  }, [map])
  return null
}

function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

export function MapCanvas({
  features,
  onBounds,
  pin,
  onPick,
}: {
  features?: MapFeatureCollection
  onBounds?: (box: BBox) => void
  pin?: { lat: number; lng: number } | null
  onPick?: (lat: number, lng: number) => void
}) {
  return (
    <div className="surface h-[min(70vh,560px)] overflow-hidden">
      <MapContainer center={[33.5138, 36.2765]} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onBounds ? <BoundsWatcher onBounds={onBounds} /> : null}
        {onPick ? <Picker onPick={onPick} /> : null}
        {pin ? <CircleMarker center={[pin.lat, pin.lng]} radius={10} pathOptions={{ color: '#27306b', fillColor: '#d7b56d', fillOpacity: 0.95 }} /> : null}
        {features ? (
          <MarkerClusterGroup chunkedLoading>
            {features.features.map((feature) => {
              const [lng, lat] = feature.geometry.coordinates
              const level = feature.properties.damageLevel
              return (
                <Marker
                  key={feature.properties.id}
                  position={[lat, lng]}
                  icon={damageIcon(damageColor[level])}
                >
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <strong>{feature.properties.referenceCode}</strong>
                      <div>
                        {damageLevelLabel[level]} · {reportStatusLabel[feature.properties.status]}
                      </div>
                      <Link to={`/reports/${feature.properties.id}`}>عرض البلاغ</Link>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MarkerClusterGroup>
        ) : null}
      </MapContainer>
    </div>
  )
}

export function DamageLegend() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs font-medium text-muted">
      {(Object.keys(damageColor) as DamageLevel[]).map((level) => (
        <li key={level} className="inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: damageColor[level] }} />
          {damageLevelLabel[level]}
        </li>
      ))}
    </ul>
  )
}
