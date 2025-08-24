
### API Endpoints
The server exposes RESTful endpoints for interaction:

## API Endpoints

### `/api/deviceStatus`

**GET**:
- Description: Retrieves the current status of the device.
- Sample Response:

```json
{
  "left": {
    "currentTemperatureF": 83,
    "targetTemperatureF": 90,
    "secondsRemaining": 300,
    "isAlarmVibrating": true,
    "isOn": true
  },
  "right": {
    "currentTemperatureF": 83,
    "targetTemperatureF": 92,
    "secondsRemaining": 400,
    "isAlarmVibrating": false,
    "isOn": true
  },
  "waterLevel": "true",
  "isPriming": false,
  "settings": {
    "v": 1,
    "gainLeft": 1, 
    "gainRight": 1, 
    "ledBrightness": 1
  },
}
```

**POST**:
- Updates the device, you don't have to specify everything
- Sample Request Body:
```json
{
  "left": {
    "targetTemperatureF": 88,
    "isOn": true
  },
  "right": {
    "targetTemperatureF": 90,
    "isOn": false
  },
  "isPriming": true
}
```

---

### `/api/settings`

**GET**:
- Description: Retrieves the current settings of the system.
- Sample Response:
```json
{
  "timeZone": "America/New_York",
  "temperatureFormat": "fahrenheit",
  "rebootDaily": true,
  "left": {
    "awayMode": false,
    "awayStart": null,
    "awayReturn": null
  },
  "right": {
    "awayMode": true,
    "awayStart": null,
    "awayReturn": "2025-01-10T22:00:00.000Z"
  },
  "primePodDaily": {
    "enabled": true,
    "time": "14:00"
  }
}
```

**POST**:
- Description: Updates system settings.
- Sample Request Body:
```json
{
  "timeZone": "America/New_York",
  "temperatureFormat": "fahrenheit",
  "rebootDaily": true,
  "left": {
    "awayMode": false,
    "awayStart": null,
    "awayReturn": null
  },
  "right": {
    "awayMode": true,
    "awayStart": "2025-01-05T20:00:00.000Z",
    "awayReturn": "2025-01-10T22:00:00.000Z"
  },
  "primePodDaily": {
    "enabled": true,
    "time": "14:00"
  }
}
```
- Sample Response:
```json
{
  "timeZone": "America/Los_Angeles",
  "rebootDaily": true,
  "left": {
    "awayMode": true
  },
  "right": {
    "awayMode": true
  },
  "primePodDaily": {
    "enabled": false,
    "time": "14:00"
  }
}
```

---

### `/api/schedules`

**GET**:
- Description: Retrieves the current schedules for the system.
- Sample Response:
```json
{
  "left": {
    "monday": {
      "temperatures": {
        "07:00": 72,
        "22:00": 68
      },
      "power": {
        "on": "20:00",
        "off": "08:00",
        "onTemperature": 82,
        "enabled": true
      },
      "alarm": {
        "time": "08:00",
        "vibrationIntensity": 1,
        "vibrationPattern": "rise",
        "duration": 10,
        "enabled": true,
        "alarmTemperature": 78
      }
    }
  }
}
```

**POST**:
- Description: Updates the schedules for the system.
- Sample Request Body:
```json
{
  "left": {
    "monday": {
      "power": {
        "on": "19:00",
        "off": "07:00",
        "enabled": true
      }
    }
  }
}
```
- Sample Response:
```json
{
  "left": {
    "monday": {
      "temperatures": {},
      "power": {
        "on": "19:00",
        "off": "07:00",
        "onTemperature": 82,
        "enabled": true
      },
      "alarm": {
        "time": "08:00",
        "vibrationIntensityStart": 1,
        "vibrationIntensityEnd": 1,
        "duration": 10,
        "enabled": false,
        "alarmTemperature": 78
      }
    }
  }
}
```

---

### `/api/execute`

**POST**:
- Description: Executes a specific command on the device.
- Sample Request Body:
```json
{
  "command": "SET_TEMP",
  "arg": "90"
}
```
- Sample Response:
```json
{
  "success": true,
  "message": "Command 'SET_TEMP' executed successfully."
}
```


### `/api/metrics/sleep`

#### **GET**

- Fetches sleep records based on optional query parameters.
- **Query Parameters:**
    - `side` (optional): Filter by the side of the bed (e.g., "left" or "right").
    - `startTime` (optional): Filter by the start time of sleep records, in ISO 8601 format.
    - `endTime` (optional): Filter by the end time of sleep records, in ISO 8601 format.
- Sample Response:
  ```json
  [
    {
      "id": 1,
      "side": "left",
      "entered_bed_at": "2025-02-15T22:00:00Z",
      "left_bed_at": "2025-02-16T06:00:00Z",
      "sleep_period_seconds": 28800,
      "times_exited_bed": 2
    },
    {
      "id": 2,
      "side": "right",
      "entered_bed_at": "2025-02-15T23:00:00Z",
      "left_bed_at": "2025-02-16T07:00:00Z",
      "sleep_period_seconds": 28800,
      "times_exited_bed": 1
    }
  ]
  ```


### `/api/metrics/vitals`

#### **GET /vitals**

- **Description:** Fetches vital records based on optional query parameters.
- **Query Parameters:**
    - `side` (optional): Filter by the side of the bed (e.g., "left" or "right").
    - `startTime` (optional): Filter by the start time of vital records, in ISO 8601 format.
    - `endTime` (optional): Filter by the end time of vital records, in ISO 8601 format.
- **Sample Response:**
  ```json
  [
    {
      "id": 1,
      "side": "left",
      "timestamp": "2025-02-15T22:00:00Z",
      "heart_rate": 72,
      "breathing_rate": 16,
      "hrv": 42
    },
    {
      "id": 2,
      "side": "right",
      "timestamp": "2025-02-15T23:00:00Z",
      "heart_rate": 74,
      "breathing_rate": 15,
      "hrv": 45
    }
  ]
  ```

### `/api/metrics/vitals/summary`

#### **GET /vitals/summary**

- **Description:** Fetches summary statistics for vitals, including heart rate, breathing rate, and HRV (heart rate variability) within a specified time range.
- **Query Parameters:**
    - `side` (optional): Filter by the side of the bed (e.g., "left" or "right").
    - `startTime` (optional): Filter by the start time of records, in ISO 8601 format.
    - `endTime` (optional): Filter by the end time of records, in ISO 8601 format.

- **Sample Response:**
  ```json
  {
    "avgHeartRate": 72,
    "minHeartRate": 65,
    "maxHeartRate": 80,
    "avgHRV": 52,
    "avgBreathingRate": 17
  }
  ```

### `/api/base-control`

#### **GET /base-control**

- **Description:** Retrieves the current position and status of the adjustable base.
- **Sample Response:**
  ```json
  {
    "head": 30,
    "feet": 15,
    "isMoving": false,
    "lastUpdate": "2025-02-15T12:00:00.000Z"
  }
  ```

#### **POST /base-control**

- **Description:** Sets the position of the adjustable base.
- **Request Body:**
  ```json
  {
    "head": 45,        // Head angle in degrees (0-60)
    "feet": 20,        // Feet angle in degrees (0-45)
    "feedRate": 50     // Optional: Movement speed (30-100), defaults to 50
  }
  ```
- **Sample Response:**
  ```json
  {
    "success": true,
    "position": {
      "head": 45,
      "feet": 20,
      "feedRate": 50
    }
  }
  ```

#### **POST /base-control/preset**

- **Description:** Sets the base to a predefined position preset.
- **Request Body:**
  ```json
  {
    "preset": "relax"  // Options: "flat", "sleep", "relax"
  }
  ```
- **Preset Positions:**
  - `flat`: head=0°, feet=0°
  - `sleep`: head=10°, feet=5°
  - `relax`: head=30°, feet=15°
- **Sample Response:**
  ```json
  {
    "success": true,
    "preset": "relax",
    "position": {
      "head": 30,
      "feet": 15,
      "feedRate": 50
    }
  }
  ```

## Partial Updates for POST Requests

For the POST endpoints (`/api/deviceStatus`, `/api/settings`, `/api/schedules`), you do not need to send a complete payload. These endpoints support partial updates, meaning you can send only the fields you wish to modify, and the system will merge your input with the existing data.

### Example for `/api/deviceStatus`:
**Request Body:**
```json
{
  "left": {
    "targetTemperatureF": 88
  }
}
```
