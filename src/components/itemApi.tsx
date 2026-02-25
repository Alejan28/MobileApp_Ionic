import axios from 'axios';
import { authConfig, baseUrl, getLogger, withLogs } from '../core';
import { ItemProps } from './ItemProps';


const itemUrl = `http://${baseUrl}/api/item`;

export const getItems = async (
    token: string,
    page: number = 1,
    limit: number = 10,
    artistSearch?: string, // Search by artist (optional)
    titleSearch?: string // Search by title (optional)
): Promise<{ items: ItemProps[]; hasMore: boolean }> => {
  // Start constructing the URL with the basic page and limit
  let url = `${itemUrl}?page=${page}&limit=${limit}`;

  // Add the artist search if it's provided
  if (artistSearch) {
    url += `&artist=${encodeURIComponent(artistSearch)}`;
  }

  // Add the title search if it's provided
  if (titleSearch) {
    url += `&title=${encodeURIComponent(titleSearch)}`;
  }

  // Make the API request with the constructed URL
  const response = await withLogs(axios.get(url, authConfig(token)), 'getItems');

  console.log('axios response:', response);

  // Check for response validity
  if (!response) {
    throw new Error('No response from getItems');
  }

  // If the response has both items and hasMore, return the data
  if ('items' in response && 'hasMore' in response) {
    return response as { items: ItemProps[]; hasMore: boolean };
  }

  // If response.data has both items and hasMore, return the data
  if (response.data && 'items' in response.data && 'hasMore' in response.data) {
    return response.data;
  }

  // Throw an error if the structure is unexpected
  throw new Error('Unexpected response structure from getItems');
};



export const createItem: (token: string, item: ItemProps) => Promise<ItemProps[]> = (token, item) => {
  return withLogs(axios.post(itemUrl, item, authConfig(token)), 'createItem');
}

export const updateItem: (token: string, item: ItemProps) => Promise<ItemProps[]> = (token, item) => {
  return withLogs(axios.put(`${itemUrl}/${item._id}`, item, authConfig(token)), 'updateItem');
}
export const deleteItemApi: (token:string, id: string) => Promise<void> = (token, id) => {
  return withLogs(axios.delete(`${itemUrl}/${id}`, authConfig(token)), 'deleteItem');
};

export const getArtists = async (token: string): Promise<string[]> => {
  const url = `http://${baseUrl}/api/item/artists`;

  try {
    const response = await withLogs(axios.get(url, authConfig(token)), 'getArtists');
    console.log('axios response:', response);
    console.log('Fetched artists:', response);

    if (Array.isArray(response)) {
      return response; // Return the artists array if valid
    } else {
      throw new Error('Fetched artists is not an array');
    }
  } catch (error) {
    console.error('Error fetching artists:', error);
    throw error;
  }
};
interface MessageData {
  type: string;
  payload: ItemProps;
}
const log = getLogger('ws');
export const newWebSocket = (token:string, onMessage: (data: MessageData) => void) => {
  const ws = new WebSocket(`ws://${baseUrl}`)
  ws.onopen = () => {
    log('web socket onopen');
    ws.send(JSON.stringify({ type: 'authorization', payload: { token } }));
  };
  ws.onclose = () => {
    log('web socket onclose');
  };
  ws.onerror = error => {
    log('web socket onerror', error);
  };
  ws.onmessage = messageEvent => {
    log('web socket onmessage');
    log(messageEvent.data)
    onMessage(JSON.parse(messageEvent.data));
  };
  return () => {
    ws.close();
  }
}
