import axios from 'axios';

const inDev = import.meta.env.VITE_ENV === 'dev';

if (inDev && !import.meta.env.VITE_POD_IP) {
  console.warn(
    'Missing ENV variable: VITE_POD_IP! ' +
    "If you'd like to run the vite server locally and send API requests to your pod, you can run " +
    "'VITE_POD_IP=<YOUR_POD_IP> npm run dev' " +
    "ex: 'VITE_POD_IP=<YOUR_POD_IP> npm run dev'"
  );
}
const baseURL = inDev && import.meta.env.VITE_POD_IP ? `http://${import.meta.env.VITE_POD_IP}:3000/api/` : `${window.location.origin}/api/`;

const axiosInstance = axios.create({
  baseURL,
});


export default axiosInstance;
