'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const API_BASE_URL = 'http://localhost:8000'

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

export default function AnalysisPage() {
  const [selectedFile, setSelectedFile] = useState('canadian_flights_250.json')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'conflicts' | 'airport' | 'airspace' | 'priority'>('conflicts')

  // Data states
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [airportCongestion, setAirportCongestion] = useState<AirportCongestion[]>([])
  const [airspaceHotspots, setAirspaceHotspots] = useState<AirspaceHotspot[]>([])
  const [priorities, setPriorities] = useState<AirspaceHotspot[]>([])

  // Error state
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (endpoint: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (err) {
      console.error(`Error fetching ${endpoint}:`, err)
      throw err
    }
  }

  const loadConflicts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchData(`/api/flights/${selectedFile}/conflicts`)
      setConflicts(data)
    } catch (err) {
      setError(`Failed to load conflicts: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setConflicts([])
    } finally {
      setLoading(false)
    }
  }

  const loadAirportCongestion = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchData(`/api/flights/${selectedFile}/congestion/airport?window_minutes=10&threshold=3`)
      setAirportCongestion(data)
    } catch (err) {
      setError(`Failed to load airport congestion: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setAirportCongestion([])
    } finally {
      setLoading(false)
    }
  }

  const loadAirspaceHotspots = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchData(`/api/flights/${selectedFile}/congestion/airspace`)
      setAirspaceHotspots(data)
    } catch (err) {
      setError(`Failed to load airspace hotspots: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setAirspaceHotspots([])
    } finally {
      setLoading(false)
    }
  }

  const loadPriorities = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchData(`/api/flights/${selectedFile}/congestion/airspace/priority`)
      setPriorities(data)
    } catch (err) {
      setError(`Failed to load priorities: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setPriorities([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auto-load data based on active tab
    if (activeTab === 'conflicts') {
      loadConflicts()
    } else if (activeTab === 'airport') {
      loadAirportCongestion()
    } else if (activeTab === 'airspace') {
      loadAirspaceHotspots()
    } else if (activeTab === 'priority') {
      loadPriorities()
    }
  }, [activeTab, selectedFile])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPriorityColor = (count: number) => {
    if (count > 10) return 'text-red-400'
    if (count > 7) return 'text-orange-400'
    return 'text-yellow-400'
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 pt-6">
        <div className="flex items-center justify-center space-x-8">
          <Link href="/" className="text-white text-sm hover:text-gray-300 transition-colors">
            Home
          </Link>
          <Link href="/globe" className="text-white text-sm hover:text-gray-300 transition-colors">
            Visualization
          </Link>
          <Link href="/analysis" className="text-white text-sm font-semibold border-b border-white">
            Analysis
          </Link>
          <Link href="/about" className="text-white text-sm hover:text-gray-300 transition-colors">
            About
          </Link>
          <Link href="/team" className="text-white text-sm hover:text-gray-300 transition-colors">
            Team
          </Link>
          <Link href="/contact" className="text-white text-sm hover:text-gray-300 transition-colors">
            Contact
          </Link>
        </div>
      </nav>

      {/* Content */}
      <section className="relative min-h-screen pt-24 px-6 pb-12">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-4">Flight Analysis Dashboard</h1>
            <p className="text-gray-300 text-lg">Real-time conflict detection, congestion analysis, and prioritization insights</p>
          </motion.div>

          {/* File Selector */}
          <motion.div
            className="mb-8 flex justify-center items-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <label className="text-gray-300 text-sm">Data File:</label>
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-white/50"
            >
              <option value="canadian_flights_250.json">250 Flights</option>
              <option value="canadian_flights_1000.json">1000 Flights</option>
            </select>
            {loading && (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">Loading...</span>
              </div>
            )}
          </motion.div>

          {/* Error Display */}
          {error && (
            <motion.div
              className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          {/* Tabs */}
          <motion.div
            className="flex flex-wrap justify-center gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {[
              { id: 'conflicts', label: 'Conflicts', count: conflicts.length },
              { id: 'airport', label: 'Airport Congestion', count: airportCongestion.length },
              { id: 'airspace', label: 'Airspace Hotspots', count: airspaceHotspots.length },
              { id: 'priority', label: 'Prioritization', count: priorities.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${activeTab === tab.id
                  ? 'bg-white text-black'
                  : 'bg-gray-900/60 text-white border border-gray-700 hover:border-white/50'
                  }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${activeTab === tab.id ? 'bg-gray-800 text-white' : 'bg-white/20'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Content Sections */}
          <div className="space-y-8">
            {/* Conflicts Tab */}
            {activeTab === 'conflicts' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl font-semibold mb-6">Loss-of-Separation Conflicts</h2>
                {conflicts.length === 0 && !loading && (
                  <div className="p-8 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/30 text-center text-gray-400">
                    No conflicts detected. All flights maintain safe separation.
                  </div>
                )}
                <div className="grid gap-4">
                  {conflicts.map((conflict, i) => (
                    <motion.div
                      key={i}
                      className="p-6 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-red-700/30"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      whileHover={{ borderColor: 'rgba(239, 68, 68, 0.5)', scale: 1.01 }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-red-400 mb-2">
                            {conflict.flight1} ↔ {conflict.flight2}
                          </h3>
                          <p className="text-gray-300">{conflict.reason}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Time</div>
                          <div className="text-white">{conflict.start_time_overlap}</div>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-700/30">
                        <div>
                          <div className="text-sm text-gray-400">Horizontal Separation</div>
                          <div className="text-lg font-semibold text-red-300">{conflict.horizontal_nm} nm</div>
                          <div className="text-xs text-gray-500">Minimum required: 5 nm</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Vertical Separation</div>
                          <div className="text-lg font-semibold text-red-300">{conflict.vertical_ft} ft</div>
                          <div className="text-xs text-gray-500">Minimum required: 2000 ft</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Airport Congestion Tab */}
            {activeTab === 'airport' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl font-semibold mb-6">Airport Departure Congestion</h2>
                {airportCongestion.length === 0 && !loading && (
                  <div className="p-8 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/30 text-center text-gray-400">
                    No airport congestion detected.
                  </div>
                )}
                <div className="grid gap-4">
                  {airportCongestion.map((event, i) => (
                    <motion.div
                      key={i}
                      className="p-6 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-orange-700/30"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      whileHover={{ borderColor: 'rgba(251, 146, 60, 0.5)', scale: 1.01 }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-orange-400 mb-2">
                            {event.airport}
                          </h3>
                          <p className="text-gray-300">{event.flight_count} flights in congestion window</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Time Window</div>
                          <div className="text-white">{event.start_time} - {event.end_time}</div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-700/30">
                        <div className="text-sm text-gray-400 mb-2">Affected Flights:</div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {event.flights.slice(0, 10).map((flight, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-800/50 rounded text-sm">
                              {flight}
                            </span>
                          ))}
                          {event.flights.length > 10 && (
                            <span className="px-2 py-1 bg-gray-800/50 rounded text-sm text-gray-400">
                              +{event.flights.length - 10} more
                            </span>
                          )}
                        </div>
                        <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded">
                          <p className="text-blue-300 text-sm">💡 {event.recommendation}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Airspace Hotspots Tab */}
            {activeTab === 'airspace' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl font-semibold mb-6">Airspace Congestion Hotspots</h2>
                {airspaceHotspots.length === 0 && !loading && (
                  <div className="p-8 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/30 text-center text-gray-400">
                    No airspace hotspots detected.
                  </div>
                )}
                <div className="grid gap-4">
                  {airspaceHotspots.map((hotspot, i) => (
                    <motion.div
                      key={i}
                      className="p-6 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-yellow-700/30"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      whileHover={{ borderColor: 'rgba(234, 179, 8, 0.5)', scale: 1.01 }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-yellow-400 mb-2">
                            Sector ({hotspot.sector_lat}°N, {hotspot.sector_lon}°W)
                          </h3>
                          <p className={`text-lg font-semibold ${getPriorityColor(hotspot.flight_count)}`}>
                            {hotspot.flight_count} flights in sector
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Time Window</div>
                          <div className="text-white">{formatTimestamp(hotspot.window_start)}</div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-700/30">
                        <div className="text-sm text-gray-400 mb-2">Flights in Hotspot:</div>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(hotspot.flights) ? hotspot.flights : Array.from(hotspot.flights)).slice(0, 15).map((flight, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-800/50 rounded text-sm">
                              {flight}
                            </span>
                          ))}
                          {(Array.isArray(hotspot.flights) ? hotspot.flights.length : (hotspot.flights as Set<string>).size) > 15 && (
                            <span className="px-2 py-1 bg-gray-800/50 rounded text-sm text-gray-400">
                              +{(Array.isArray(hotspot.flights) ? hotspot.flights.length : (hotspot.flights as Set<string>).size) - 15} more
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Prioritization Tab */}
            {activeTab === 'priority' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl font-semibold mb-6">Cargo vs Passenger Prioritization</h2>
                {priorities.length === 0 && !loading && (
                  <div className="p-8 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/30 text-center text-gray-400">
                    No prioritization recommendations available. No hotspots detected.
                  </div>
                )}
                <div className="grid gap-4">
                  {priorities.map((hotspot, i) => (
                    <motion.div
                      key={i}
                      className="p-6 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-blue-700/30"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      whileHover={{ borderColor: 'rgba(59, 130, 246, 0.5)', scale: 1.01 }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-blue-400 mb-2">
                            Sector ({hotspot.sector_lat}°N, {hotspot.sector_lon}°W)
                          </h3>
                          <p className="text-gray-300">{hotspot.flight_count} flights in congestion hotspot</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Time Window</div>
                          <div className="text-white">{formatTimestamp(hotspot.window_start)}</div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-700/30 space-y-4">
                        <div>
                          <div className="text-sm text-gray-400 mb-2">Flights Involved:</div>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(hotspot.flights) ? hotspot.flights : Array.from(hotspot.flights)).slice(0, 15).map((flight, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-800/50 rounded text-sm">
                                {flight}
                              </span>
                            ))}
                            {(Array.isArray(hotspot.flights) ? hotspot.flights.length : (hotspot.flights as Set<string>).size) > 15 && (
                              <span className="px-2 py-1 bg-gray-800/50 rounded text-sm text-gray-400">
                                +{(Array.isArray(hotspot.flights) ? hotspot.flights.length : (hotspot.flights as Set<string>).size) - 15} more
                              </span>
                            )}
                          </div>
                        </div>
                        {hotspot.prioritization_suggestion && (
                          <div className="p-4 bg-green-900/20 border border-green-700/30 rounded">
                            <p className="text-green-300 whitespace-pre-line">{hotspot.prioritization_suggestion}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
