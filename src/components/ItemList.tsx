import React, { useContext, useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../components/useAppState';
import { useNetwork } from '../components/useNetwork';
import { Preferences } from '@capacitor/preferences';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonList,
  IonLoading,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  IonSearchbar,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonToast,
} from '@ionic/react';
import { add, search } from 'ionicons/icons';
import Item from './Item';
import { getLogger } from '../core';
import { ItemContext } from './ItemProvider';
import { AuthContext } from '../auth';
import { useIonViewWillEnter } from '@ionic/react';
import { GestureItem } from '../animations/GestureItem';
import {AnimatedToolbar} from "../animations/AnimatedToolbar";

const log = getLogger('ItemList');

const ItemList: React.FC = () => {
  const history = useHistory();
  const {
    items = [],
    fetching,
    fetchingError,
    fetchItemsPage,
    page,
    hasMore,
    fetchArtists,
    artists = [],
    updateItemLocally,
  } = useContext(ItemContext);

  const { logout } = useContext(AuthContext);
  const { appState } = useAppState();
  const { networkStatus } = useNetwork();

  const [artistFilter, setArtistFilter] = useState<string>('');
  const [titleFilter, setTitleFilter] = useState<string>('');
  const [localArtists, setLocalArtists] = useState<any[]>([]);
  const [offlineItems, setOfflineItems] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  // Load local artists
  const loadLocalArtists = async () => {
    try {
      const stored = await Preferences.get({ key: 'artists' });
      if (stored.value) setLocalArtists(JSON.parse(stored.value));
    } catch (err) {
      console.error(err);
    }
  };

  // Load offline albums + pending updates
  const loadOfflineItems = async () => {
    try {
      const storedAlbums = await Preferences.get({ key: 'albums' });
      const storedPending = await Preferences.get({ key: 'pendingUpdates' });

      const albums = storedAlbums.value ? JSON.parse(storedAlbums.value) : [];
      const pending = storedPending.value ? JSON.parse(storedPending.value) : [];

      // Merge offline changes
      const merged = albums.map((a: any) => {
        const pendingEdit = pending.find((p: any) => p._id === a._id);
        return pendingEdit ? pendingEdit : a;
      });
      const onlyPending = pending.filter((p: any) => !albums.find((a: any) => a._id === p._id));

      setOfflineItems([...onlyPending, ...merged]);
    } catch (err) {
      console.error(err);
    }
  };

  useIonViewWillEnter(async () => {
    if (!networkStatus.connected) {
      loadOfflineItems();
      loadLocalArtists();
    }
  });

  // Fetch online items or merge offline items
  useEffect(() => {
    if (networkStatus.connected && fetchItemsPage) {
      fetchItemsPage(1, 10, artistFilter, titleFilter);
      fetchArtists?.();
    } else {
      loadOfflineItems();
      loadLocalArtists();
    }
  }, [networkStatus, artistFilter, titleFilter, fetchItemsPage, fetchArtists]);

  // Update offline cache whenever items change
  useEffect(() => {
    const cacheOffline = async () => {
      if (!networkStatus.connected) {
        await Preferences.set({ key: 'albums', value: JSON.stringify(items) });
        loadOfflineItems();
      }
    };
    cacheOffline();
  }, [items, networkStatus.connected]);

  const loadMore = async (event: CustomEvent<void>) => {
    if (!networkStatus.connected || !hasMore) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }
    if (fetchItemsPage) await fetchItemsPage(page + 1, 10, artistFilter, titleFilter);
    (event.target as HTMLIonInfiniteScrollElement).complete();
  };

  const handleSearch = () => {
    if (networkStatus.connected && fetchItemsPage) {
      fetchItemsPage(1, 10, artistFilter, titleFilter);
    } else {
      triggerToast('Cannot search while offline.');
    }
  };

  const displayItems = networkStatus.connected ? items : offlineItems;

  return (
      <IonPage>
        <IonHeader>
          <AnimatedToolbar>
            <IonTitle>Album Tracking</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={logout}>Logout</IonButton>
            </IonButtons>
          </AnimatedToolbar>

          <div style={{padding: '15px', background: '#f4f4f9'}}>
            <div>
              <h3>Network Status</h3>
              <p>
                {networkStatus?.connected ? (
                    <span style={{color: 'green'}}>Online</span>
                ) : (
                    <span style={{color: 'red'}}>Offline</span>
                )}
              </p>
            </div>
          </div>

          <IonToolbar>
            <IonSelect
                value={artistFilter}
                placeholder="Select artist"
                onIonChange={(e) => setArtistFilter(e.detail.value!)}
                disabled={!networkStatus.connected}
            >
              <IonSelectOption value="">All Artists</IonSelectOption>
              {(localArtists.length > 0 ? localArtists : artists).map((artist: any, i) => (
                  <IonSelectOption key={i} value={artist.name || artist}>
                    {artist.name || artist}
                  </IonSelectOption>
              ))}
            </IonSelect>
          </IonToolbar>

          <IonToolbar>
            <IonSearchbar
                value={titleFilter}
                debounce={500}
                onIonChange={(e) => setTitleFilter(e.detail.value!)}
                placeholder="Search by title"
                showClearButton="focus"
                disabled={!networkStatus.connected}
            />
            <IonButton slot="end" onClick={handleSearch} disabled={!networkStatus.connected}>
              <IonIcon icon={search}/>
            </IonButton>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <IonLoading isOpen={fetching && networkStatus.connected} message="Fetching albums..."/>
          {fetchingError && <div>{fetchingError.message || 'Failed to fetch albums'}</div>}

          <IonList>
            {displayItems.length > 0 ? (
                displayItems.map((item) => (
                    <GestureItem
                        key={item._id || item.id}
                        onSwipeComplete={async () => {
                          // Save offline copy before navigating
                          await Preferences.set({
                            key: `item_${item._id || item.id}`,
                            value: JSON.stringify(item),
                          });

                          // Update local state
                          updateItemLocally?.(item);

                          // Navigate to ItemEdit
                          history.push(`/item/${item._id || item.id}`);
                        }}
                    >
                      <div
                          style={{
                            margin: '15px',
                            padding: '20px',
                            border: '1px solid #ccc',
                            borderRadius: '10px',
                            background: '#fff',
                          }}
                      >
                        <Item
                            {...item}
                            onEdit={async (id) => {
                              // Optional: allow manual edit via button inside Item
                              await Preferences.set({
                                key: `item_${id}`,
                                value: JSON.stringify(item),
                              });
                              updateItemLocally?.(item);
                              history.push(`/item/${id}`);
                            }}
                        />
                      </div>
                    </GestureItem>
                ))
            ) : (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  No albums found {networkStatus.connected ? '' : '(offline cache empty)'}
                </div>
            )}
          </IonList>



          <IonInfiniteScroll threshold="100px" disabled={!hasMore || !networkStatus.connected} onIonInfinite={loadMore}>
            <IonInfiniteScrollContent loadingText="Loading more albums..." />
          </IonInfiniteScroll>

          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton onClick={() => history.push('/item')}>
              <IonIcon icon={add} />
            </IonFabButton>
          </IonFab>

          <IonToast isOpen={showToast} message={toastMessage} duration={2000} onDidDismiss={() => setShowToast(false)} />
        </IonContent>
      </IonPage>
  );
};

export default ItemList;
