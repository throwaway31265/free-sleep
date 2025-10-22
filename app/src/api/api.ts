import axios from 'axios';

const baseURL = import.meta.env.VITE_POD_IP
  ? `http://${import.meta.env.VITE_POD_IP}:3000`
  : `${window.location.origin}`;

const axiosInstance = axios.create({
  baseURL: `${baseURL}/api/`,
});

export default axiosInstance;
export { baseURL };
