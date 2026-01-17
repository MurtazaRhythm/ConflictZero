import datetime
from collections import defaultdict
from typing import List, Dict, Any
from flight_loader import Flight, load_flights

def detect_congestion(
    flights: List[Flight], 
    window_minutes: int = 10, 
    threshold: int = 3
) -> List[Dict[str, Any]]:
    """
    Detects airport departure congestion based on flight schedules.
    
    A congestion event is flagged if more than `threshold` flights depart 
    from the same airport within a `window_minutes` sliding window.
    
    Args:
        flights: List of Flight objects.
        window_minutes: Size of the time window in minutes (default: 10).
        threshold: Max number of flights allowed in the window (default: 6).
        
    Returns:
        A list of congestion events with details.
    """
    congestion_events = []
    
    # Group flights by airport
    flights_by_airport = defaultdict(list)
    for f in flights:
        if f.departure_airport and f.departure_time:
            flights_by_airport[f.departure_airport].append(f)
            
    window_seconds = window_minutes * 60
    
    # Analyze each airport
    for airport, airport_flights in flights_by_airport.items():
        # Sort by departure time for efficient sliding window
        airport_flights.sort(key=lambda x: x.departure_time)
        
        # Sliding window
        n = len(airport_flights)
        i = 0
        while i < n:
            start_flight = airport_flights[i]
            start_time = start_flight.departure_time
            end_time_limit = start_time + window_seconds
            
            # Find all flights in this window [start_time, start_time + window]
            window_flights = []
            j = i
            while j < n and airport_flights[j].departure_time < end_time_limit:
                window_flights.append(airport_flights[j])
                j += 1
            
            count = len(window_flights)
            
            # Check threshold
            if count > threshold:
                # Format output
                start_dt = datetime.datetime.fromtimestamp(start_time, tz=datetime.timezone.utc)
                end_dt = datetime.datetime.fromtimestamp(start_time + window_seconds, tz=datetime.timezone.utc)
                
                # Format without timezone offset for cleaner reading
                fmt = "%Y-%m-%d %H:%M"
                
                event = {
                    "airport": airport,
                    "start_time": start_dt.strftime(fmt),
                    "end_time": end_dt.strftime(fmt),
                    "flight_count": count,
                    "flights": [f.acid for f in window_flights],
                    "recommendation": f"Shift low-priority flights by {window_minutes//2}–{window_minutes} minutes"
                }
                congestion_events.append(event)
                
                # Advance to the end of the current window to avoid duplicate/overlapping alerts for the same burst
                # Ideally, we skip forward to find the next distinct problem area.
                # Advancing to `j` means we skip all flights involved in this congestion event.
                i = j 
            else:
                i += 1
                
    return congestion_events

if __name__ == "__main__":
    # Load data using the existing loader logic
    # flight_loader defaults to canadian_flights_1000.json
    try:
        flights = load_flights("canadian_flights_1000.json")
        print(f"Loaded {len(flights)} flights.")
        
        # Run detection
        print("\n--- Analyzing Airport Congestion ---")
        events = detect_congestion(flights, window_minutes=10, threshold=3)
        
        if not events:
            print("No congestion events detected.")
        else:
            print(f"Found {len(events)} congestion events:")
            for event in events:
                print(f"\n[!] Congestion at {event['airport']} ({event['start_time']} - {event['end_time']})")
                print(f"    Count: {event['flight_count']} flights")
                print(f"    Flights: {', '.join(event['flights'][:5])}" + ("..." if len(event['flights']) > 5 else ""))
                print(f"    Action: {event['recommendation']}")
                
    except Exception as e:
        print(f"Error: {e}")
