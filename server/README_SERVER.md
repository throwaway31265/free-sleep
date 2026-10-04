# Server Documentation

## Overview
Express server intended to run on the 8 sleep pod.  

## Developing

### Dependency compatibility

The Pod installer and Volta configuration use Node 24.11.0. Keep runtime dependencies compatible with that version; upgrading packages does not require changing the Pod runtime.

- Prisma CLI and client are pinned together at 6.19.3. Prisma 7 requires a SQLite driver adapter and testing that native dependency on the Pod before migration.
- Sentry CLI 3 is a development dependency used when building off the Pod; the production server does not execute it.
- TypeScript is upgraded to 6.0, the newest version supported by typescript-eslint 8. TypeScript 7 changes the compiler API used by linting and ts-node, so that migration needs compatible tooling. Node type definitions stay on major 24 to match the Pod runtime.
- Zod stays on major 3 to preserve nested partial REST updates and shared frontend types.
- ESLint 10 uses `eslint.config.js`. Sentry 11 explicitly preserves the previous data-collection restrictions and transaction lifecycle.

After changing dependencies, regenerate the Prisma client and checked-in server output, then check types and lint:

```bash
npm ci
npm run generate
npm run build:pr
npm run lint
npx tsc --noEmit
```

`build:pr` injects source-map debug IDs locally and does not upload to Sentry.

### Hot Reloading (on Pod) 
1. SSH into the Pod and run
```
fs-dev-server

# When you're done, undo this by CTR+C out of the npm run dev command & run:
systemctl start free-sleep
```
2. Run the front-end app with hot reload and point it to your Pod [app/README_APP.md](../app/README_APP.md#Developing)

### Hot Reloading (on computer, not your Pod)
- `npm run dev:local`


### My development process
1. I run this server on my Pod with hot reloading (see above)
1. I have IntelliJ setup to auto upload my file changes to the Pod [IntelliJ documentation for this config](https://www.jetbrains.com/help/idea/tutorial-deployment-in-product.html#downloading).
VSCode also has a similar feature, I think this is the documentation for it [VSCode](https://code.visualstudio.com/docs/remote/ssh)

--- 


## Architecture
The server is composed of the following key components:

### 1. **Core Server (`server.ts`):**
- Sets up and starts an Express.js server.
- Initializes middleware and routes.
- Manages graceful shutdown processes for reliability.

### 2. **Routes:**
- **`/api/deviceStatus`:** Fetches and updates the status of the device.
- **`/api/settings`:** Manages device settings (e.g., timezone, away mode, priming schedules).
- **`/api/schedules`:** Handles scheduling for device operations.
- **`/api/execute`:** Sends commands directly to the device.
- **`/api/metrics/vitals`:** Biometrics (heart rate, HRV, breathing rate)
- **`/api/metrics/sleep`:** Sleep intervals 

### 3. **Jobs Scheduler (`src/jobs/`):**
- Schedules periodic tasks like temperature adjustments, power on/off, and device priming using the `node-schedule` library.
- Monitors changes to the DB storage files in `src/db/`, clears all schedules and recreates them every time changes are made


### 4. **Database (`src/db/`):**
- The JSON files are created the first time the server runs, you do not need to create them
- Uses `lowdb` for simple JSON-based storage.
- Includes schemas for schedules, settings, and time zones, validated with `zod`.


### 5. **8 Sleep Integration (`src/8sleep/`):**
- Contains utilities to communicate with the "Franken" device using Unix sockets.
  - This is based off of the EXISTING code on the pod in /home/dac/app/

---

## Key Features

### Device control
- The server connects to the device using a Unix socket @ `/deviceinfo/dac.sock` (varies by Pod version & firmware version, path is detected in install.sh script and saved to `/persistent/free-sleep-data/dac_sock_path.txt`)
- Commands are sent to the device for various operations, including temperature adjustments and status retrieval.

### Scheduling
- Jobs like temperature changes, power toggling, and device priming are scheduled based on user-defined schedules.
- Changes to schedules or settings automatically trigger updates to the jobs

---

## Installation

### Prerequisites
- Volta for node version control

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Start the server:
   ```bash
   npm start
   ```

---

## File Structure
```
server/
├── free-sleep-data/        # For local development - mimics the /persistent/free-sleep-data/ folder on Pod
├── src/
│   ├── 8sleep/             # Integration with the "Franken" device
│   ├── db/                 # JSON database and schemas
│   ├── jobs/               # Job scheduling utilities
│   ├── logger.ts           # Logging configuration
│   ├── routes/             # API routes
│   ├── setup/              # Middleware and routes setup
│   ├── server.ts           # Core server entry point
├── dist/                   # Compiled output (generated by TypeScript)
├── tsconfig.json           
├── package.json            
```

---
