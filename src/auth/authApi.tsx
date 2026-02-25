import axios from 'axios';
import { baseUrl, config, withLogs } from '../core';

const authUrl = `http://${baseUrl}/api/auth/login`;
const logOutUrl=`http://${baseUrl}/api/auth/logout`;

export interface AuthProps {
  token: string;
}

export const login: (username?: string, password?: string) => Promise<AuthProps> = (username, password) => {
  return withLogs(axios.post(authUrl, { username, password }, config), 'login');
}
// Logout function
export const logout: (token?: string) => Promise<void> = async (token) => {
  try {
    if (token) {
      await withLogs(
          axios.post(logOutUrl, null, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          'logout'
      );
    }
  } catch (err) {
    console.warn('Server logout failed, still clearing token locally', err);
  }

};
