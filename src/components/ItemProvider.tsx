import React, { useCallback, useContext, useEffect, useReducer, useState } from 'react';
import { getLogger } from '../core';
import { ItemProps } from './ItemProps';
import { createItem, deleteItemApi, getItems, newWebSocket, updateItem, getArtists } from './itemApi';
import { AuthContext } from '../auth';
import { Preferences } from '@capacitor/preferences';
import { useNetwork } from '../components/useNetwork';

const log = getLogger('ItemProvider');

export interface ItemsState {
  items: ItemProps[];
  fetching: boolean;
  fetchingError?: Error | null;
  saving: boolean;
  savingError?: Error | null;
  saveItem?: (item: ItemProps) => Promise<void>;
  deleting: boolean;
  deleteItem?: (id: string) => Promise<void>;
  page: number;
  hasMore: boolean;
  fetchItemsPage?: (page?: number) => Promise<void>;
  artists: string[];
  fetchingArtists: boolean;
  fetchingArtistsError?: Error;
  fetchArtists?: () => Promise<void>;
  updateItemLocally?: (item: ItemProps | { _deleted?: boolean }) => void;
}

interface ActionProps {
  type: string;
  payload?: any;
}

const initialState: ItemsState = {
  items: [],
  fetching: false,
  saving: false,
  deleting: false,
  page: 1,
  hasMore: true,
  artists: [],
  fetchingArtists: false,
};

const FETCH_ITEMS_STARTED = 'FETCH_ITEMS_STARTED';
const FETCH_ITEMS_SUCCEEDED = 'FETCH_ITEMS_SUCCEEDED';
const FETCH_ITEMS_FAILED = 'FETCH_ITEMS_FAILED';
const SAVE_ITEM_STARTED = 'SAVE_ITEM_STARTED';
const SAVE_ITEM_SUCCEEDED = 'SAVE_ITEM_SUCCEEDED';
const SAVE_ITEM_FAILED = 'SAVE_ITEM_FAILED';
const DELETE_ITEM_STARTED = 'DELETE_ITEM_STARTED';
const DELETE_ITEM_SUCCEEDED = 'DELETE_ITEM_SUCCEEDED';
const FETCH_ARTISTS_STARTED = 'FETCH_ARTISTS_STARTED';
const FETCH_ARTISTS_SUCCEEDED = 'FETCH_ARTISTS_SUCCEEDED';
const FETCH_ARTISTS_FAILED = 'FETCH_ARTISTS_FAILED';
const UPDATE_ITEM_LOCALLY = 'UPDATE_ITEM_LOCALLY';

const reducer = (state: ItemsState, action: ActionProps): ItemsState => {
  switch (action.type) {
    case FETCH_ITEMS_STARTED:
      return { ...state, fetching: true, fetchingError: null };
    case FETCH_ITEMS_SUCCEEDED:
      return {
        ...state,
        items: action.payload.page === 1 ? action.payload.items : [...state.items, ...action.payload.items],
        fetching: false,
      };
    case FETCH_ITEMS_FAILED:
      return { ...state, fetchingError: action.payload.error, fetching: false };
    case SAVE_ITEM_STARTED:
      return { ...state, saving: true, savingError: null };
    case SAVE_ITEM_SUCCEEDED: {
      const items = [...state.items];
      const index = items.findIndex(it => it._id === action.payload.item._id);
      if (index === -1) items.unshift(action.payload.item);
      else items[index] = action.payload.item;
      return { ...state, items, saving: false };
    }
    case SAVE_ITEM_FAILED:
      return { ...state, savingError: action.payload.error, saving: false };
    case DELETE_ITEM_STARTED:
      return { ...state, deleting: true };
    case DELETE_ITEM_SUCCEEDED:
      return { ...state, items: state.items.filter(it => it._id !== action.payload.id), deleting: false };
    case FETCH_ARTISTS_STARTED:
      return { ...state, fetchingArtists: true };
    case FETCH_ARTISTS_SUCCEEDED:
      return { ...state, artists: action.payload.artists, fetchingArtists: false };
    case FETCH_ARTISTS_FAILED:
      return { ...state, fetchingArtistsError: action.payload.error, fetchingArtists: false };
    case UPDATE_ITEM_LOCALLY: {
      const updatedItem: ItemProps = action.payload.item;
      if (updatedItem._deleted) {
        return { ...state, items: state.items.filter(i => i._id !== updatedItem._id) };
      }
      const items = [...state.items];
      const idx = items.findIndex(i => i._id === updatedItem._id);
      if (idx === -1) items.unshift(updatedItem);
      else items[idx] = updatedItem;
      return { ...state, items };
    }
    default:
      return state;
  }
};

export const ItemContext = React.createContext<ItemsState>(initialState);

export const ItemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const { networkStatus } = useNetwork();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  useEffect(wsEffect, [token]);
  const fetchItemsPage = useCallback(
      async (pageNumber = 1, limit = 10, artistSearch = '', titleSearch = '') => {
        try {
          dispatch({ type: FETCH_ITEMS_STARTED });
          const response = await getItems(token, pageNumber, limit, artistSearch, titleSearch);
          const { items: newItems, hasMore } = response;
          dispatch({ type: FETCH_ITEMS_SUCCEEDED, payload: { items: newItems, page: pageNumber } });
          setHasMore(hasMore);
          setPage(pageNumber);
        } catch (error) {
          dispatch({ type: FETCH_ITEMS_FAILED, payload: { error } });
        }
      },
      [token]
  );

  const fetchArtists = useCallback(async () => {
    dispatch({ type: FETCH_ARTISTS_STARTED });
    try {
      const artists = await getArtists(token);
      dispatch({ type: FETCH_ARTISTS_SUCCEEDED, payload: { artists } });
    } catch (error) {
      dispatch({ type: FETCH_ARTISTS_FAILED, payload: { error } });
    }
  }, [token]);

  /** Save Item (Offline + Online) */
  const saveItem = useCallback(
      async (item: ItemProps) => {
        if (!networkStatus.connected) {
          const tempId = item._id || `temp-${Date.now()}`;
          const offlineItem = { ...item, _id: tempId };
          dispatch({ type: UPDATE_ITEM_LOCALLY, payload: { item: offlineItem } });

          const { value } = await Preferences.get({ key: 'pendingUpdates' });
          const pending = value ? JSON.parse(value) : [];
          const updatedPending = [...pending.filter((i: any) => i._id !== offlineItem._id), offlineItem];
          await Preferences.set({ key: 'pendingUpdates', value: JSON.stringify(updatedPending) });
          await Preferences.set({ key: `item_${offlineItem._id}`, value: JSON.stringify(offlineItem) });
          log('Saved locally (offline)', offlineItem);
          return;
        }

        try {
          dispatch({ type: SAVE_ITEM_STARTED });
          const savedItem = item._id ? await updateItem(token, item) : await createItem(token, item);
          dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: savedItem } });
        } catch (error) {
          dispatch({ type: SAVE_ITEM_FAILED, payload: { error } });
        }
      },
      [token, networkStatus.connected]
  );

  /** Delete Item (Offline + Online) */
  const deleteItem = useCallback(
      async (id: string) => {
        if (!networkStatus.connected) {
          const { value } = await Preferences.get({ key: 'pendingDeletes' });
          const pending = value ? JSON.parse(value) : [];
          pending.push(id);
          await Preferences.set({ key: 'pendingDeletes', value: JSON.stringify(pending) });
          dispatch({ type: UPDATE_ITEM_LOCALLY, payload: { item: { _id: id, _deleted: true } } });
          log('Deletion stored locally (offline)', id);
          return;
        }

        try {
          dispatch({ type: DELETE_ITEM_STARTED });
          await deleteItemApi(token, id);
          dispatch({ type: DELETE_ITEM_SUCCEEDED, payload: { id } });
        } catch (error) {
          console.error(error);
        }
      },
      [token, networkStatus.connected]
  );

  const updateItemLocally = useCallback((item: ItemProps | { _deleted?: boolean }) => {
    dispatch({ type: UPDATE_ITEM_LOCALLY, payload: { item } });
  }, []);

  /** Sync pending offline updates/deletes */
  const syncPendingChanges = useCallback(async () => {
    if (!networkStatus.connected) return;

    try {
      // Updates
      const { value: updates } = await Preferences.get({ key: 'pendingUpdates' });
      if (updates) {
        const pendingUpdates: ItemProps[] = JSON.parse(updates);
        const stillPending: ItemProps[] = [];
        for (const item of pendingUpdates) {
          try {
            let synced: ItemProps;
            if (item._id?.startsWith('temp-')) {
              const { _id, ...cleanItem } = item;
              synced = await createItem(token, cleanItem);
            } else {
              synced = await updateItem(token, item);
            }
            dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: synced } });
            await Preferences.set({ key: `item_${synced._id}`, value: JSON.stringify(synced) });
          } catch (err) {
            stillPending.push(item);
          }
        }
        if (stillPending.length === 0) await Preferences.remove({ key: 'pendingUpdates' });
        else await Preferences.set({ key: 'pendingUpdates', value: JSON.stringify(stillPending) });
      }

      // Deletes
      const { value: deletes } = await Preferences.get({ key: 'pendingDeletes' });
      if (deletes) {
        const pendingDeletes: string[] = JSON.parse(deletes);
        const stillDeletes: string[] = [];
        for (const id of pendingDeletes) {
          try {
            await deleteItemApi(token, id);
          } catch (err) {
            stillDeletes.push(id);
          }
        }
        if (stillDeletes.length === 0) await Preferences.remove({ key: 'pendingDeletes' });
        else await Preferences.set({ key: 'pendingDeletes', value: JSON.stringify(stillDeletes) });
      }
      log('[SYNC] Offline changes synced');
    } catch (err) {
      console.error('[SYNC] Failed', err);
    }
  }, [networkStatus.connected, token]);

  /** Sync when connection restored */
  useEffect(() => {
    if (networkStatus.connected) syncPendingChanges();
  }, [networkStatus.connected, token, syncPendingChanges]);

  /** WebSocket for live updates */
  function wsEffect() {
    let canceled = false;
    log('wsEffect - connecting');
    let closeWebSocket: () => void;
    if (token?.trim()) {
      closeWebSocket = newWebSocket(token, message => {
        if (canceled) {
          return;
        }
        const { type, payload: item } = message;
        log(`ws message, item ${type}`);
        if (type === 'created' || type === 'updated') {
          dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item } });
        }
      });
    }
    return () => {
      log('wsEffect - disconnecting');
      canceled = true;
      closeWebSocket?.();
    }
  }

  return (
      <ItemContext.Provider
          value={{
            ...state,
            saveItem,
            deleteItem,
            fetchItemsPage,
            page,
            hasMore,
            fetchArtists,
            updateItemLocally,
          }}
      >
        {children}
      </ItemContext.Provider>
  );
};
