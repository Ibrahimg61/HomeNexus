import json
import sqlite3
import sys


def main():
    database_path = sys.argv[1]
    operation = sys.argv[2]

    with sqlite3.connect(database_path) as connection:
        connection.row_factory = sqlite3.Row
        if operation == "history":
            from_timestamp = sys.argv[3] if len(sys.argv) > 3 else ""
            to_timestamp = sys.argv[4] if len(sys.argv) > 4 else ""
            conditions = []
            parameters = []
            if from_timestamp:
                conditions.append("e.timestamp >= ?")
                parameters.append(from_timestamp)
            if to_timestamp:
                conditions.append("e.timestamp <= ?")
                parameters.append(to_timestamp)
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            rows = connection.execute(
                f"SELECT e.powerW, e.timestamp, d.name AS deviceName "
                f"FROM EnergyLog e JOIN Device d ON e.deviceId = d.id "
                f"{where_clause} ORDER BY e.timestamp ASC",
                parameters,
            ).fetchall()
            print(json.dumps([dict(row) for row in rows]))
        elif operation == "devices":
            rows = connection.execute(
                "SELECT id, name, ipAddress FROM Device WHERE type = 'tapo_p110'"
            ).fetchall()
            print(json.dumps([dict(row) for row in rows]))
        elif operation == "update-device":
            connection.execute(
                "UPDATE Device SET name = ?, ipAddress = ? WHERE id = ?",
                sys.argv[3:6],
            )
            connection.commit()
            print("{}");
        elif operation == "insert":
            connection.execute(
                "INSERT INTO EnergyLog (id, deviceId, powerW, timestamp) VALUES (?, ?, ?, ?)",
                sys.argv[3:7],
            )
            connection.commit()
            print("{}");
        elif operation == "create-device":
            connection.execute(
                "INSERT INTO Device (id, name, ipAddress, type) VALUES (?, ?, ?, 'tapo_p110')",
                sys.argv[3:6],
            )
            connection.commit()
            print("{}");
        else:
            raise ValueError(f"Unbekannte Datenbankoperation: {operation}")


if __name__ == "__main__":
    main()
