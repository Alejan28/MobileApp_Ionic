import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { getLogger } from '../core';
import { login as loginApi, logout as logoutApi } from './authApi';

const log = getLogger('AuthProvider');

type LoginFn = (username?: string, password?: string) => void;
type LogoutFn=()=>void;

export interface AuthState {
  authenticationError: Error | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isLoggingOut:boolean;
  login?: LoginFn;
  logout?: LogoutFn;
  pendingAuthentication?: boolean;
  pendingLogOut?:boolean;
  username?: string;
  password?: string;
  token: string;
}
const tokenFromStorage = localStorage.getItem('token');
const initialState: AuthState = {
  isAuthenticated: !!tokenFromStorage,
  isAuthenticating: false,
  authenticationError: null,
  pendingAuthentication: false,
  token: tokenFromStorage || '',
};

export const AuthContext = React.createContext<AuthState>(initialState);

interface AuthProviderProps {
  children: PropTypes.ReactNodeLike,
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);
  const { isAuthenticated, isAuthenticating, isLoggingOut, authenticationError, pendingAuthentication,pendingLogOut, token } = state;
  const login = useCallback<LoginFn>(loginCallback, []);
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoggingOut: true }));
    try {
      await logoutApi(state.token);
      localStorage.clear();
      setState(prev => ({
        ...prev,
        token: '',
        isAuthenticated: false,
        isLoggingOut: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        authenticationError: err as Error,
        isLoggingOut: false,
      }));
    }
  }, [state.token]);

  useEffect(authenticationEffect, [pendingAuthentication]);
  useEffect(logoutEffect,[pendingLogOut]);
  const value = { isAuthenticated, login,logout,isAuthenticating, authenticationError, token, isLoggingOut  };
  log('render');
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );

  function loginCallback(username?: string, password?: string): void {
    log('login');
    setState({
      ...state,
      pendingAuthentication: true,
      username,
      password,
      token:''
    });
  }
  function logoutCallback(): void {
    log('logout');
    setState({
      ...state,
      pendingLogOut: true,
    });
  }
  function logoutEffect(){
    let canceled = false;
    logUserOut();
    return () => {
      canceled = true;
    }
    async function logUserOut(){
      if (!pendingLogOut) {
        log('authenticate, !pendingAuthentication, return');
        return;
      }
      try{
        log('authenticate...');
        setState({
          ...state,
          isLoggingOut: true,
        });
        const { token } = state;
        await logoutApi(token);
        if (canceled) {
          return;
        }
        log('logout succeeded');
        setState({
          ...state,
          token:'',
          pendingLogOut: false,
          isAuthenticated: false,
          isLoggingOut:false,
        });
      }catch(error){
        if (canceled) {
          return;
        }
        log('authenticate failed');
        setState({
          ...state,
          authenticationError: error as Error,
          pendingLogOut: false,
          isLoggingOut: false,
        });
      }
    }
  }
  function authenticationEffect() {
    let canceled = false;
    authenticate();
    return () => {
      canceled = true;
    }

    async function authenticate() {
      if (!pendingAuthentication) {
        log('authenticate, !pendingAuthentication, return');
        return;
      }
      try {
        log('authenticate...');
        setState({
          ...state,
          isAuthenticating: true,
        });
        const { username, password } = state;
        const { token } = await loginApi(username, password);
        if (canceled) {
          return;
        }
        localStorage.setItem('token', token);
        log('authenticate succeeded');
        setState({
          ...state,
          token,
          pendingAuthentication: false,
          isAuthenticated: true,
          isAuthenticating: false,
        });
      } catch (error) {
        if (canceled) {
          return;
        }
        log('authenticate failed');
        setState({
          ...state,
          authenticationError: error as Error,
          pendingAuthentication: false,
          isAuthenticating: false,
        });
      }
    }
  }
};
