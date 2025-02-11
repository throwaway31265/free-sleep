# App Documentation

## Overview
This application is a React-based frontend designed to manage the 8 sleep pod's settings, schedules, and temperature controls. 
It communicates with the backend API to fetch, update, and synchronize data. 
The app uses Material-UI for styling and layout, Zustand for state management, and React Query for API interaction.


## Developing
1. **Optional**: If you also want to make changes to the back-end server at the same time, setup the back-end server to run in hot reload mode [server/README_SERVER.md](../server/README_SERVER.md#Developing)
1. Run vite hot reloading & specify the IP address for your Pod. This tells axios to make API requests at a different IP (see [app/src/api/api.ts](app/src/api/api.ts))
- `VITE_POD_IP=<YOUR_POD_IP> bun run dev`
- `VITE_POD_IP=192.168.1.50 bun run dev`

---

## Key Features
- **Dynamic Temperature Control**: Adjust temperature settings with a circular slider.
- **Scheduling**: Set and manage daily temperature schedules with power on/off times and temperature adjustments.
- **Settings Management**: Update timezone, enable/disable away mode, and configure daily priming.
- **Device Status**: Monitor and update the device's operational status.
- **Multi-Side Control**: Configure settings for both left and right sides of the device.
- **Alarms** (Coming soon, work in progress)
---

## Directory Structure

### **Main Application Files**
- `main.tsx`: Entry point, sets up routing, themes, and context providers.
- `vite-env.d.ts`: Type definitions for the Vite environment.

### **State Management**
- `appStore.tsx`: Global state using Zustand for tracking UI updates, selected side, and fetching status.

### **API**
- `api/`: Contains methods for communicating with backend endpoints.
    - `deviceStatus.ts`: Get/update device status.
    - `schedules.ts`: Get/update schedules.
    - `settings.ts`: Get/update settings.
    - `timeZones.ts`: List of supported timezones.
    - Shared schemas using Zod for validation

### **Components**
- `Layout`: Main application layout with a navbar and routed content.
- `Navbar`: Provides navigation for different app sections with responsive support.
- `PageContainer`: Standardized container for page content.

### **Pages**
- **ControlTempPage**: Manage real-time temperature adjustments.
    - Includes slider, power button, and away mode notifications.
- **SettingsPage**: Configure timezone, away mode, and daily priming.
- **SchedulePage**: View and edit daily schedules with features like applying settings to multiple days.

---

## State Management
The app uses:
1. **Zustand**: For local state management, such as UI updates and active side selection.
2. **React Query**: For fetching and caching API data, with features like automatic refetching and retries.

---

## API Integration
- **React Query** is used for seamless API interactions with optimistic updates and error handling.
- Axios provides the underlying HTTP client setup in `api/api.ts`.

--- 

## Themes and Styles
- **Material-UI**: Provides consistent theming and components.

---

## Error Handling
- **Device Status Errors**: Prompts the user to retry fetching status.
- **Schedule Validation**: Ensures times and temperatures are within valid ranges.

---

## Extensibility
- **Add Features**: Easily add new pages by extending the routing setup in `main.tsx`.

---

## License and Disclaimer
The app is open source under the MIT License. For full terms, refer to the license modal in the settings page.
