from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import json

from flight_loader import Flight, load_flights
from flight_analysis import detect_loss_of_separation, validate_flight
from congestion_analysis import detect_congestion
from airspace_congestion import detect_congestion as detect_airspace_congestion, suggest_prioritization

app = FastAPI(title="Conflict Zero API", version="1.0.0")

# CORS middleware to allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",  # In case Next.js runs on different port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def flight_to_dict(flight: Flight) -> dict:
    """Convert Flight dataclass to dict matching frontend format"""
    return {
        "ACID": flight.acid,
        "Plane type": flight.plane_type,
        "route": flight.route,
        "altitude": flight.altitude,
        "departure airport": flight.departure_airport,
        "arrival airport": flight.arrival_airport,
        "departure time": flight.departure_time,
        "aircraft speed": flight.aircraft_speed,
        "passengers": flight.passengers,
        "is_cargo": flight.is_cargo
    }


@app.get("/")
def read_root():
    return {"message": "Conflict Zero API", "version": "1.0.0"}


@app.get("/api/flights")
def get_flights(file: str = Query(default="canadian_flights_250.json", description="JSON filename")):
    """
    Load and return flights from a JSON file.
    
    Args:
        file: JSON filename (default: canadian_flights_250.json)
    """
    try:
        flights = load_flights(file)
        return [flight_to_dict(f) for f in flights]
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flights/{file}/conflicts")
def get_conflicts(file: str):
    """
    Detect loss-of-separation conflicts from flights.
    
    Args:
        file: JSON filename (e.g., canadian_flights_250.json)
    """
    try:
        flights = load_flights(file)
        conflicts = detect_loss_of_separation(flights)
        return conflicts
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flights/{file}/congestion/airport")
def get_airport_congestion(
    file: str,
    window_minutes: int = Query(default=10, ge=1, le=60, description="Time window size in minutes"),
    threshold: int = Query(default=3, ge=1, description="Maximum flights allowed in window")
):
    """
    Detect airport departure congestion.
    
    Args:
        file: JSON filename
        window_minutes: Time window size in minutes (default: 10)
        threshold: Maximum flights allowed in window (default: 3)
    """
    try:
        flights = load_flights(file)
        congestion = detect_congestion(flights, window_minutes, threshold)
        return congestion
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flights/{file}/congestion/airspace")
def get_airspace_congestion(file: str):
    """
    Detect airspace congestion hotspots.
    
    Args:
        file: JSON filename (e.g., canadian_flights_250.json)
    """
    try:
        flights = load_flights(file)
        hotspots = detect_airspace_congestion(flights)
        # Convert sets to lists for JSON serialization
        for hotspot in hotspots:
            if isinstance(hotspot.get('flights'), set):
                hotspot['flights'] = list(hotspot['flights'])
        return hotspots
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flights/{file}/congestion/airspace/priority")
def get_airspace_priority(file: str):
    """
    Detect airspace congestion hotspots with cargo vs passenger prioritization suggestions.
    
    Uses existing logic from airspace_congestion.py to:
    - Detect congestion hotspots
    - Generate prioritization recommendations for each hotspot
    
    Args:
        file: JSON filename (e.g., canadian_flights_250.json)
    
    Returns:
        List of hotspots with prioritization suggestions attached
    """
    try:
        # Load flights and create lookup dictionary for prioritization logic
        flights = load_flights(file)
        flight_lookup = {flight.acid: flight for flight in flights}
        
        # Detect airspace congestion using existing module
        hotspots = detect_airspace_congestion(flights)
        
        # Enhance each hotspot with prioritization suggestions
        result = []
        for hotspot in hotspots:
            # Convert sets to lists for JSON serialization
            hotspot_data = hotspot.copy()
            if isinstance(hotspot_data.get('flights'), set):
                hotspot_data['flights'] = list(hotspot_data['flights'])
            
            # Generate prioritization suggestion using existing logic
            prioritization_suggestion = suggest_prioritization(hotspot, flight_lookup)
            hotspot_data['prioritization_suggestion'] = prioritization_suggestion
            
            result.append(hotspot_data)
        
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flights/{file}/validate")
def validate_flights(file: str):
    """
    Validate flights against operational constraints (altitude & speed).
    
    Args:
        file: JSON filename
    """
    try:
        flights = load_flights(file)
        all_issues = []
        for flight in flights:
            issues = validate_flight(flight)
            if issues:
                all_issues.extend(issues)
        return {
            "total_flights": len(flights),
            "flights_with_issues": len(set(issue["flight"] for issue in all_issues)),
            "total_issues": len(all_issues),
            "issues": all_issues
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File {file} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Conflict Zero API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
