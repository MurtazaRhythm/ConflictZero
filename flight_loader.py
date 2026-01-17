import json
import logging
import os
from dataclasses import dataclass
from typing import List, Optional, Union

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

@dataclass
class Flight:
    """
    Represents a single flight with all its details.
    """
    acid: str
    plane_type: str
    route: str
    altitude: int
    departure_airport: str
    arrival_airport: str
    departure_time: int
    aircraft_speed: float
    passengers: int
    is_cargo: bool

    @classmethod
    def from_dict(cls, data: dict) -> Optional['Flight']:
        """
        Creates a Flight object from a dictionary, handling missing fields safely.
        Normalizes data from potentially different schemas.
        Returns None if critical data (ACID) is missing or input is not a dict.
        """
        if not isinstance(data, dict):
            return None

        # Helper to get value from multiple possible keys
        def get_val(keys: List[str], default=None):
            for k in keys:
                if k in data and data[k] is not None:
                    return data[k]
            return default

        try:
            # Critical field: ACID
            acid = get_val(["ACID", "acid", "flight_id"])
            if not acid:
                return None
            
            # Normalize other fields with defaults
            return cls(
                acid=str(acid),
                plane_type=str(get_val(["Plane type", "plane_type", "aircraft"], "Unknown")),
                route=str(get_val(["route", "flight_path"], "")),
                altitude=int(get_val(["altitude", "alt", "level"], 0)),
                departure_airport=str(get_val(["departure airport", "dep_airport", "origin"], "Unknown")),
                arrival_airport=str(get_val(["arrival airport", "arr_airport", "dest"], "Unknown")),
                departure_time=int(get_val(["departure time", "dep_time", "timestamp"], 0)),
                aircraft_speed=float(get_val(["aircraft speed", "speed", "ground_speed"], 0.0)),
                passengers=int(get_val(["passengers", "pax"], 0)),
                is_cargo=bool(get_val(["is_cargo", "cargo"], False))
            )
        except (ValueError, TypeError) as e:
            logging.warning(f"Error parsing flight data for ACID {data.get('ACID', 'Unknown')}: {e}")
            return None

def load_flights_from_file(filepath: str) -> List[Flight]:
    """
    Loads flight data from a single JSON file.
    """
    flights = []
    
    if not os.path.exists(filepath):
        logging.error(f"File not found: {filepath}")
        return []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        if not isinstance(data, list):
            logging.error(f"Expected a list of flights in {filepath}, but got {type(data).__name__}")
            return []

        for item in data:
            flight = Flight.from_dict(item)
            if flight:
                flights.append(flight)
            else:
                # Optional: Log skipped items if strict debugging is needed
                pass
                
        logging.info(f"Loaded {len(flights)} flights from {filepath}")
                
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON in {filepath}: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred while loading {filepath}: {e}")
        
    return flights

def load_flights(filepaths: Union[str, List[str]]) -> List[Flight]:
    """
    Loads flight data from one or multiple JSON files and combines them.
    
    Args:
        filepaths: A single file path string or a list of file path strings.
        
    Returns:
        Combined list of Flight objects from all files.
    """
    all_flights = []
    
    if isinstance(filepaths, str):
        filepaths = [filepaths]
        
    for path in filepaths:
        flights = load_flights_from_file(path)
        all_flights.extend(flights)
        
    return all_flights

if __name__ == "__main__":
    import sys
    
    # Default files to load
    files_to_load = ["canadian_flights_1000.json"]
    
    # Allow user to pass specific files via command line
    if len(sys.argv) > 1:
        files_to_load = sys.argv[1:]
    
    print(f"Attempting to load flights from: {files_to_load}")
    
    combined_data = load_flights(files_to_load)
    
    print(f"Successfully loaded a total of {len(combined_data)} flights.")
    if combined_data:
        print(f"Sample flight: {combined_data[252]}")
