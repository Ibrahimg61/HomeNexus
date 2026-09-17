import asyncio
import os
import sys
import json
from tapo import ApiClient

async def main():
    try:
        ip = sys.argv[1]
        email = sys.argv[2]
        password = os.environ["TAPO_PASSWORD"]

        # Verbindung zur herstellen (KLAP)
        client = ApiClient(email, password)
        device = await client.p110(ip)
        
        # Stromverbrauch abrufen
        energy = await device.get_energy_usage()
        
        # JSON ausgabe 
        print(json.dumps({"success": True, "power_watts": energy.current_power / 1000}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())