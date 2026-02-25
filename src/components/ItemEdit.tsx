import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonLoading,
  IonPage,
  IonTitle,
  IonToolbar,
  IonToast, IonActionSheet, IonIcon, IonFab, IonFabButton, IonModal,
} from '@ionic/react';
import {camera, close, cloudUploadOutline, trash} from 'ionicons/icons';
import { MyPhoto, usePhotos } from '../camera_pages/usePhotos';
import { RouteComponentProps } from 'react-router';
import { ItemProps } from './ItemProps';
import { ItemContext } from './ItemProvider';
import { Preferences } from '@capacitor/preferences';
import { useNetwork } from '../components/useNetwork';
import { getLogger } from '../core';
import './ItemEdit.css';
import MyMap from "./MyMap";
import {useMyLocation} from "../location_pages/useMyLocation";
import { SwipeBackToolbar } from '../animations/SwipeToolbar';
import {enterAnimation, leaveAnimation} from '../animations/MyModal';

const log = getLogger('ItemEdit');



interface ItemEditProps extends RouteComponentProps<{ id?: string }> {}

const ItemEdit: React.FC<ItemEditProps> = ({ history, match }) => {
  const { items, saveItem, deleteItem, updateItemLocally } = useContext(ItemContext);
  const { networkStatus } = useNetwork();

  const [item, setItem] = useState<ItemProps>();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [noTracks, setNoTracks] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [date, setDate] = useState('');
  const[photo, setPhoto]=useState<MyPhoto | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
      item?.location || null
  );
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(
      item?.location || null
  );
  const [version, setVersion] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [hasChanges, setHasChanges] = useState(false);

  const [showChooseMap, setShowChooseMap] = useState(false);
  const [showLocateMap, setShowLocateMap] = useState(false)


  const { takePhotoForItem, loadPhotoForItem } = usePhotos();
  const [photoToDelete, setPhotoToDelete] = useState<MyPhoto>();

  const myLocation = useMyLocation();

  const showToastMessage = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };


  // Load item from memory or Preferences (offline)
  useEffect(() => {
    const loadItem = async () => {
      const routeId = match.params.id || '';
      let foundItem = items?.find(it => it._id === routeId);

      if (!foundItem && !networkStatus.connected) {
        const stored = await Preferences.get({ key: `item_${routeId}` });
        if (stored.value) foundItem = JSON.parse(stored.value);
      }

      setItem(foundItem);

      if (foundItem) {
        setTitle(foundItem.title);
        setArtist(foundItem.artist);
        setNoTracks(foundItem.noTracks?.toString() || '');
        setPhoto(foundItem.photo || null);
        setReleaseDate(
            foundItem.releaseDate && foundItem.releaseDate !== 'N/A'
                ? new Date(foundItem.releaseDate).toISOString().split('T')[0]
                : ''
        );
        setDate(
            foundItem.date
                ? new Date(foundItem.date).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0]
        );
        setVersion(foundItem.version || '');
        setLocation(foundItem.location || null);
      } else {
        setDate(new Date().toISOString().split('T')[0]);
      }
    };

    loadItem();
  }, [match.params.id, items, networkStatus]);

  // useEffect(() => {
  //   if (!item?._id) return;
  //
  //   loadPhotoForItem(item._id).then(savedPhoto => {
  //     if (savedPhoto) setPhoto(savedPhoto);
  //   });
  // }, [item]);


  // Save locally if offline, or online if connected
  const handleSave = async (photoOverride?: MyPhoto) => {
    const currentPhoto = photoOverride || photo;
    const isNewItem = !item?._id;
    const editedItem: ItemProps = {
      ...item,
      title,
      artist,
      noTracks: Number(noTracks),
      releaseDate,
      date: date || new Date().toISOString(),
      version,
      photo: currentPhoto,
      location,
    };

    if (!networkStatus.connected) {
      const tempId = editedItem._id || `temp-${Date.now()}`;
      const offlineItem = { ...editedItem, _id: tempId };
      await saveItemLocally(offlineItem);
      updateItemLocally?.(offlineItem);
      showToastMessage('Item saved locally. Will sync when back online.');
      history.goBack();
      return;
    }

    try {
      setSaving(true);
      await saveItem?.(editedItem);
      showToastMessage(isNewItem ? 'Item added online.' : 'Item updated online.');
      history.goBack();
    } catch (err) {
      showToastMessage('Error saving item online.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Store offline updates in Preferences
  const saveItemLocally = async (offlineItem: ItemProps) => {
    try {
      const { value } = await Preferences.get({ key: 'pendingUpdates' });
      const pending = value ? JSON.parse(value) : [];
      const updatedPending = [
        ...pending.filter((i: any) => i._id !== offlineItem._id),
        offlineItem,
      ];
      await Preferences.set({
        key: 'pendingUpdates',
        value: JSON.stringify(updatedPending),
      });

      await Preferences.set({
        key: `item_${offlineItem._id}`,
        value: JSON.stringify(offlineItem),
      });
      log('[OFFLINE] Saved locally:', offlineItem.title);
    } catch (err) {
      console.error('Error saving item locally', err);
    }
  };

  // Delete online or queue delete offline
  const handleDelete = async () => {
    if (!item?._id) {
      history.goBack();
      return;
    }

    if (networkStatus.connected) {
      try {
        await deleteItem?.(item._id);
        showToastMessage('Item deleted online.');
        history.goBack();
      } catch (err) {
        showToastMessage('Error deleting item online.');
        console.error(err);
      }
    } else {
      const { value } = await Preferences.get({ key: 'pendingDeletes' });
      const pending = value ? JSON.parse(value) : [];
      const updatedDeletes = [...pending, item._id];
      await Preferences.set({
        key: 'pendingDeletes',
        value: JSON.stringify(updatedDeletes),
      });

      updateItemLocally?.({ ...item, _deleted: true });
      showToastMessage('Item deletion saved locally. Will sync when online.');
      history.goBack();
    }
  };

  return (
      <IonPage>
        <IonHeader>
          <SwipeBackToolbar>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#098',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#ccc',
                    fontWeight: 'bold',
                  }}
              >
                {item?.photo?.webviewPath ? (
                    <img
                        src={item.photo.webviewPath}
                        alt="Album"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    'Album'
                )}
              </div>

              <IonTitle>{item ? 'Edit Item' : 'New Item'}</IonTitle>
            </div>

            <IonButtons slot="end">
              <IonButton
                  className={hasChanges ? 'pulse' : ''}
                  onClick={() => {
                    handleSave();
                    setHasChanges(false);
                  }}
              >
                Save
              </IonButton>
            </IonButtons>

            {item && (
                <IonButtons slot="end">
                  <IonButton color="danger" onClick={handleDelete}>
                    Delete
                  </IonButton>
                </IonButtons>
            )}
          </SwipeBackToolbar>

        </IonHeader>

        <IonContent>
          <IonItem>
            <IonLabel position="floating">Title</IonLabel>
            <IonInput
                value={title}
                onIonChange={(e) => {
                  setTitle(e.detail.value || '');
                  setHasChanges(true);}
                }
            />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Artist</IonLabel>
            <IonInput
                value={artist}
                onIonChange={(e) => {
                  setArtist(e.detail.value || '');
                  console.log('⚡ Setting hasChanges -> true');
                  setHasChanges(true);}
               }
            />
          </IonItem>
          <IonItem>
          <IonLabel position="floating">Number of Tracks</IonLabel>
            <IonInput
                value={noTracks}
                onIonChange={(e) => {
                  setNoTracks(e.detail.value || '');
                  setHasChanges(true);}
                }
            />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Release Date</IonLabel>
            <IonInput
                type="date"
                value={releaseDate}
                onIonChange={(e) => {
                  setReleaseDate(e.detail.value!);
                  setHasChanges(true);}
                }
            />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Date Added</IonLabel>
            <IonInput
                value={date || new Date().toISOString().split('T')[0]}
                readonly
            />
          </IonItem>

          <IonLoading isOpen={saving} message="Saving item..." spinner="crescent" />
          <IonToast
              isOpen={showToast}
              message={toastMessage}
              duration={2000}
              onDidDismiss={() => setShowToast(false)}
          />
          <IonFab vertical="bottom" horizontal="center" slot="fixed">
            <div style={{display: 'flex', gap: '12px'}}>
              {/* Camera button */}
              <IonFabButton
                  onClick={async () => {
                    if (item?._id) {
                      const newPhoto = await takePhotoForItem(item._id, 'camera');
                      setPhoto(newPhoto);
                      handleSave(newPhoto);
                    }
                  }}
              >
                <IonIcon icon={camera}/>
              </IonFabButton>

              {/* Upload / gallery button */}
              <IonFabButton
                  onClick={async () => {
                    if (item?._id) {
                      const newPhoto = await takePhotoForItem(item._id, 'gallery');
                      setPhoto(newPhoto);
                      handleSave(newPhoto);
                    }
                  }}
              >
                <IonIcon icon={cloudUploadOutline}/> {/* or another upload icon */}
              </IonFabButton>
            </div>
          </IonFab>
          <IonActionSheet
              isOpen={!!photoToDelete}
              buttons={[{
                text: 'Delete',
                role: 'destructive',
                icon: trash,
                handler: () => {
                  if (photoToDelete) {
                    deletePhoto(photoToDelete);
                    setPhotoToDelete(undefined);
                  }
                }
              }, {
                text: 'Cancel',
                icon: close,
                role: 'cancel'
              }]}
              onDidDismiss={() => setPhotoToDelete(undefined)}
          />
          <IonButton onClick={() => setShowChooseMap(true)}>Choose Item Location</IonButton>

          <div style={{ marginTop: '8px' }}>
            <div>Latitude: {location?.lat ?? 'N/A'}</div>
            <div>Longitude: {location?.lng ?? 'N/A'}</div>
          </div>

          <IonModal
              isOpen={showChooseMap}
              onDidDismiss={() => setShowChooseMap(false)}

              enterAnimation={enterAnimation}
              leaveAnimation={leaveAnimation}
          >
            {(tempLocation || true) && (
                <MyMap
                    lat={tempLocation?.lat ?? location?.lat ?? 46.7712}
                    lng={tempLocation?.lng ?? location?.lng ?? 23.6236}
                    onMapClick={({ latitude, longitude }) => {setTempLocation({ lat: latitude, lng: longitude });
                    setHasChanges(true);
                }}
                    onMarkerClick={() => {}}
                />
            )}
            <IonButton onClick={() => {
              if (tempLocation) setLocation(tempLocation);
              setShowChooseMap(false);
            }}>
              Save Location
            </IonButton>
          </IonModal>


          {/* View / Locate Resource */}
          <IonButton onClick={() => setShowLocateMap(true)}>Locate Resource</IonButton>

          <IonModal
              isOpen={showLocateMap}
              onDidDismiss={() => setShowLocateMap(false)}

          >
            {(item?.location) && (
                <MyMap
                    lat={item?.location?.lat ?? 46.7712}
                    lng={item?.location?.lng ?? 23.6236}
                    onMapClick={() => {}}  // no-op
                    onMarkerClick={() => {}}
                />
            )}
            <IonButton onClick={() => setShowLocateMap(false)}>Close</IonButton>
          </IonModal>
        </IonContent>
      </IonPage>
  );
};

export default ItemEdit;
