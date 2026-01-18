'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import Link from 'next/link'

const Globe = dynamic(
  () => import('react-globe.gl').catch(() => ({ default: () => <div>Globe loading...</div> })),
  { ssr: false, loading: () => <div className="text-white">Loading globe...</div> }
)

const API_BASE_URL = 'http://localhost:8000'

interface Flight {
  ACID: string
  'Plane type': string
  route: string
  altitude: number
  'departure airport': string
  'arrival airport': string
  'departure time': number
  'aircraft speed': number
  passengers: number
  is_cargo: boolean
}

interface Conflict {
  flight1: string
  flight2: string
  horizontal_nm: number
  vertical_ft: number
  reason: string
  start_time_overlap: string
}

interface AirportCongestion {
  airport: string
  start_time: string
  end_time: string
  flight_count: number
  flights: string[]
  recommendation: string
}

interface AirspaceHotspot {
  sector_lat: number
  sector_lon: number
  window_start: number
  flight_count: number
  flights: string[] | Set<string>
  prioritization_suggestion?: string
}

const airports: Record<string, [number, number]> = {
  CYYZ: [43.68, -79.63],
  CYVR: [49.19, -123.18],
  CYUL: [45.47, -73.74],
  CYYC: [51.11, -114.02],
  CYOW: [45.32, -75.67],
  CYWG: [49.91, -97.24],
  CYHZ: [44.88, -63.51],
  CYEG: [53.31, -113.58],
  CYQB: [46.79, -71.39],
  CYYJ: [48.65, -123.43],
  CYYT: [47.62, -52.75],
  CYXE: [52.17, -106.7],
}

function parseWaypoint(waypoint: string): [number, number] | null {
  const match = waypoint.match(/(\d+\.?\d*)N\/(\d+\.?\d*)W/)
  if (match) return [parseFloat(match[1]), -parseFloat(match[2])]
  return null
}

// Return a representative coordinate for a flight:
// 1) known departure airport, otherwise
// 2) first waypoint in the route, otherwise null.
const getFlightCoord = (flight: Flight): [number, number] | null => {
  const fromAirport = airports[flight['departure airport']]
  if (fromAirport) return fromAirport
  const firstWp = flight.route?.split(' ').find(Boolean)
  if (firstWp) {
    const coords = parseWaypoint(firstWp)
    if (coords) return coords
  }
  return null
}

// Build full path coordinates (departure, waypoints, arrival)
const getFlightPath = (flight: Flight): [number, number][] => {
  const path: [number, number][] = []
  const dep = airports[flight['departure airport']]
  if (dep) path.push(dep)
  flight.route
    ?.split(' ')
    .filter(Boolean)
    .forEach((wp) => {
      const coords = parseWaypoint(wp)
      if (coords) path.push(coords)
    })
  const arr = airports[flight['arrival airport']]
  if (arr) path.push(arr)
  return path
}

export default function GlobePage() {
  const globeEl = useRef<any>(null)
  const [selectedFile, setSelectedFile] = useState('canadian_flights_250.json')
  const [flights, setFlights] = useState<Flight[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [airportCongestion, setAirportCongestion] = useState<AirportCongestion[]>([])
  const [airspaceHotspots, setAirspaceHotspots] = useState<AirspaceHotspot[]>([])
  const [priorityHotspots, setPriorityHotspots] = useState<AirspaceHotspot[]>([])
  const [arcs, setArcs] = useState<any[]>([])
  const [points, setPoints] = useState<any[]>([])
  const [conflictPoints, setConflictPoints] = useState<any[]>([])
  const [airportPoints, setAirportPoints] = useState<any[]>([])
  const [airspacePoints, setAirspacePoints] = useState<any[]>([])
  const [priorityPoints, setPriorityPoints] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)
  const [showFlights, setShowFlights] = useState(true)
  const [showConflicts, setShowConflicts] = useState(true)
  const [showAirports, setShowAirports] = useState(true)
  const [showAirspace, setShowAirspace] = useState(true)
  const [showPriority, setShowPriority] = useState(true)

  const fetchJSON = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
  }

  useEffect(() => {
    let cancelled = false
    // Clear previous data to avoid stale markers while new data loads
    setArcs([])
    setPoints([])
    setConflictPoints([])
    setAirportPoints([])
    setAirspacePoints([])
    setPriorityPoints([])
    setSelectedFlight(null)
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [fl, cf, ac, ah, pr] = await Promise.all([
          fetchJSON<Flight[]>(`${API_BASE_URL}/api/flights?file=${selectedFile}`),
          fetchJSON<Conflict[]>(`${API_BASE_URL}/api/flights/${selectedFile}/conflicts`),
          fetchJSON<AirportCongestion[]>(`${API_BASE_URL}/api/flights/${selectedFile}/congestion/airport?window_minutes=10&threshold=3`),
          fetchJSON<AirspaceHotspot[]>(`${API_BASE_URL}/api/flights/${selectedFile}/congestion/airspace`),
          fetchJSON<AirspaceHotspot[]>(`${API_BASE_URL}/api/flights/${selectedFile}/congestion/airspace/priority`),
        ])
        if (cancelled) return
        setFlights(fl)
        setConflicts(cf)
        setAirportCongestion(ac)
        setAirspaceHotspots(ah)
        setPriorityHotspots(pr)

        const arcsData: any[] = []
        const pointsData: any[] = []
        const conflictMarkers: any[] = []
        const airportMarkers: any[] = []
        const airspaceMarkers: any[] = []
        const priorityMarkers: any[] = []
        const conflictAgg = new Map<string, { lat: number; lng: number; count: number; flights: string[] }>()
        const airportAgg = new Map<string, { lat: number; lng: number; count: number; airport: string }>()
        const airspaceAgg = new Map<string, { lat: number; lng: number; count: number; window: number }>()
        const priorityAgg = new Map<string, { lat: number; lng: number; count: number; suggestion?: string }>()
        let skippedNoCoord = 0
        let skippedAirportNoCoord = 0
        let skippedPriorityNoCargo = 0
        let skippedPriorityNoFlights = 0

        const flightById = new Map(fl.map((f) => [f.ACID, f]))

        fl.forEach((flight) => {
          const path = getFlightPath(flight)
          if (path.length < 2) return

          // Add arcs for each segment in the route (departure -> waypoints -> arrival)
          for (let i = 0; i < path.length - 1; i++) {
            const [sLat, sLng] = path[i]
            const [eLat, eLng] = path[i + 1]
            arcsData.push({
              startLat: sLat,
              startLng: sLng,
              endLat: eLat,
              endLng: eLng,
              color: flight.is_cargo
                ? ['rgba(255,100,100,0.6)', 'rgba(255,100,100,0.3)']
                : ['rgba(100,150,255,0.6)', 'rgba(100,150,255,0.3)'],
              flight,
            })
          }

          pointsData.push(
            { lat: path[0][0], lng: path[0][1], size: 0.5, color: '#60a5fa', label: flight['departure airport'], flight },
            { lat: path[path.length - 1][0], lng: path[path.length - 1][1], size: 0.5, color: '#34d399', label: flight['arrival airport'], flight }
          )

          flight.route?.split(' ').filter(Boolean).forEach((wp) => {
            const coords = parseWaypoint(wp)
            if (coords) pointsData.push({ lat: coords[0], lng: coords[1], size: 0.3, color: '#fbbf24', label: wp, flight })
          })
        })

        cf.forEach((c) => {
          const f1 = flightById.get(c.flight1)
          const f2 = flightById.get(c.flight2)
          if (!f1 || !f2) return
          const p1 = getFlightCoord(f1)
          const p2 = getFlightCoord(f2)
          if (!p1 || !p2) {
            skippedNoCoord += 1
            return
          }
          const lat = (p1[0] + p2[0]) / 2
          const lng = (p1[1] + p2[1]) / 2
          const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
          const current = conflictAgg.get(key)
          if (current) {
            current.count += 1
            if (current.flights.length < 6) {
              current.flights.push(c.flight1, c.flight2)
            }
          } else {
            conflictAgg.set(key, { lat, lng, count: 1, flights: [c.flight1, c.flight2] })
          }
        })

        conflictAgg.forEach((v) => {
          const size = Math.min(0.25 + v.count * 0.01, 0.8)
          conflictMarkers.push({
            lat: v.lat,
            lng: v.lng,
            size,
            color: '#ef4444',
            label: `Conflicts: ${v.count}\nSample flights: ${v.flights.slice(0, 6).join(', ')}`,
            count: v.count,
          })
        })

        ac.forEach((event) => {
          const loc = airports[event.airport]
          if (!loc) {
            skippedAirportNoCoord += 1
            return
          }
          const key = `${loc[0].toFixed(4)},${loc[1].toFixed(4)}`
          const cur = airportAgg.get(key)
          if (cur) {
            cur.count += event.flight_count
          } else {
            airportAgg.set(key, { lat: loc[0], lng: loc[1], count: event.flight_count, airport: event.airport })
          }
        })

        airportAgg.forEach((v) => {
          const size = Math.min(0.2 + v.count * 0.05, 1)
          airportMarkers.push({
            lat: v.lat,
            lng: v.lng,
            size,
            color: '#f97316',
            label: `Airport: ${v.airport}\nDepartures in window: ${v.count}`,
            count: v.count,
          })
        })

        ah.forEach((hotspot) => {
          const key = `${hotspot.sector_lat.toFixed(4)},${hotspot.sector_lon.toFixed(4)}`
          const current = airspaceAgg.get(key)
          if (current) {
            current.count += hotspot.flight_count
          } else {
            airspaceAgg.set(key, { lat: hotspot.sector_lat, lng: -Math.abs(hotspot.sector_lon), count: hotspot.flight_count, window: hotspot.window_start })
          }
        })

        airspaceAgg.forEach((v) => {
          const size = Math.min(0.2 + v.count * 0.02, 1)
          airspaceMarkers.push({
            lat: v.lat,
            lng: v.lng,
            size,
            color: '#facc15',
            label: `Airspace hotspot\nFlights: ${v.count}\nWindow start: ${new Date(v.window * 1000).toLocaleString()}`,
            count: v.count,
          })
        })

        pr.forEach((hotspot) => {
          const flightIds = Array.isArray(hotspot.flights) ? hotspot.flights : Array.from(hotspot.flights || [])
          if (!flightIds.length) {
            skippedPriorityNoFlights += 1
            return
          }
          const hasCargoFlight = flightIds.some((id) => {
            const f = flightById.get(id)
            return f?.is_cargo
          })
          if (!hasCargoFlight) {
            skippedPriorityNoCargo += 1
            return
          }
          const key = `${hotspot.sector_lat.toFixed(4)},${hotspot.sector_lon.toFixed(4)}`
          const current = priorityAgg.get(key)
          if (current) {
            current.count += 1
            if (!current.suggestion && hotspot.prioritization_suggestion) current.suggestion = hotspot.prioritization_suggestion
          } else {
            priorityAgg.set(key, { lat: hotspot.sector_lat, lng: -Math.abs(hotspot.sector_lon), count: 1, suggestion: hotspot.prioritization_suggestion })
          }
        })

        priorityAgg.forEach((v) => {
          const size = Math.min(0.2 + v.count * 0.02, 1)
          priorityMarkers.push({
            lat: v.lat,
            lng: v.lng,
            size,
            color: '#22c55e',
            label: `Prioritization hotspot\nFlights: ${v.count}\nSuggestion: ${v.suggestion || 'N/A'}`,
            count: v.count,
          })
        })

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/06c8c688-79d3-44e9-91e2-4006468c9235', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H4',
            location: 'app/globe/page.tsx:airportMarkers',
            message: 'Computed airport markers',
            data: { selectedFile, markers: airportMarkers.length, skippedAirportNoCoord, aggregatedKeys: airportAgg.size },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/06c8c688-79d3-44e9-91e2-4006468c9235', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H2',
            location: 'app/globe/page.tsx:conflictMarkers',
            message: 'Computed conflict markers',
            data: { selectedFile, markers: conflictMarkers.length, skippedNoCoord, aggregatedKeys: conflictAgg.size },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/06c8c688-79d3-44e9-91e2-4006468c9235', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H5',
            location: 'app/globe/page.tsx:airspaceMarkers',
            message: 'Computed airspace markers',
            data: { selectedFile, markers: airspaceMarkers.length, aggregatedKeys: airspaceAgg.size },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/06c8c688-79d3-44e9-91e2-4006468c9235', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H6',
            location: 'app/globe/page.tsx:priorityMarkers',
            message: 'Computed priority markers',
            data: { selectedFile, markers: priorityMarkers.length, aggregatedKeys: priorityAgg.size, skippedPriorityNoCargo, skippedPriorityNoFlights },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion

        setArcs(arcsData)
        setPoints(pointsData)
        setConflictPoints(conflictMarkers)
        setAirportPoints(airportMarkers)
        setAirspacePoints(airspaceMarkers)
        setPriorityPoints(priorityMarkers)
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load data')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedFile])

  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true
      globeEl.current.controls().autoRotateSpeed = 0.5
    }
  }, [])

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <motion.nav className="absolute top-0 left-0 right-0 z-50 pt-6" initial={{ y: -100 }} animate={{ y: 0 }}>
        <div className="flex justify-center gap-8 text-white text-sm">
          <Link href="/">Home</Link>
          <Link href="/globe">Visualization</Link>
          <Link href="/analysis">Analysis</Link>
          <Link href="/about">About</Link>
          <Link href="/team">Team</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </motion.nav>

      <div className="absolute top-16 left-4 z-50">
        <select
          value={selectedFile}
          onChange={(e) => setSelectedFile(e.target.value)}
          className="px-3 py-2 bg-gray-900 text-white border border-gray-700 rounded"
        >
          <option value="canadian_flights_250.json">250 Flights</option>
          <option value="canadian_flights_1000.json">1000 Flights</option>
        </select>
        <div className="mt-3 space-y-1 text-sm text-white bg-black/60 border border-gray-700 rounded p-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showFlights} onChange={(e) => setShowFlights(e.target.checked)} />
            Flight paths
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showConflicts} onChange={(e) => setShowConflicts(e.target.checked)} />
            Conflicts
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showAirports} onChange={(e) => setShowAirports(e.target.checked)} />
            Airport congestion
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showAirspace} onChange={(e) => setShowAirspace(e.target.checked)} />
            Airspace hotspots
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showPriority} onChange={(e) => setShowPriority(e.target.checked)} />
            Prioritization
          </label>
        </div>
      </div>

      <div className="w-full h-full pt-20">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-white">Loading flight data...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400">{error}</div>
        ) : (
          <Globe
            key={selectedFile}
            ref={globeEl}
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            backgroundColor="rgba(0,0,0,0)"
            arcsData={showFlights ? arcs : []}
            arcStartLat={(d: any) => d.startLat}
            arcStartLng={(d: any) => d.startLng}
            arcEndLat={(d: any) => d.endLat}
            arcEndLng={(d: any) => d.endLng}
            arcColor={(d: any) => d.color}
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={2000}
            pointsData={[
              ...(showConflicts ? conflictPoints : []),
              ...(showAirports ? airportPoints : []),
              ...(showAirspace ? airspacePoints : []),
              ...(showPriority ? priorityPoints : []),
            ]}
            pointLat={(d: any) => d.lat}
            pointLng={(d: any) => d.lng}
            pointColor={(d: any) => d.color}
            pointRadius={(d: any) => d.size}
            pointLabel={(d: any) => d.label || ''}
          />
        )}
      </div>

      <motion.div
        className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm p-4 rounded-lg border border-blue-500/20 z-50"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-white font-semibold mb-2">Legend</h3>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2"><div className="w-4 h-1 rounded-full bg-blue-300"></div><span className="text-gray-300">Flight paths</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-gray-300">Conflicts</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-gray-300">Airport congestion</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400"></div><span className="text-gray-300">Airspace hotspots</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-gray-300">Prioritization</span></div>
        </div>
      </motion.div>

    </div>
  )
}

