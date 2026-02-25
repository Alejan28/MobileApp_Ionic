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
    IonToast,
} from '@ionic/react';
import { getLogger } from '../core';
import { ItemContext } from './ItemProvider';
import { RouteComponentProps } from 'react-router';
import { ItemProps } from './ItemProps';
import { Preferences } from '@capacitor/preferences';
import { useNetwork } from '../components/useNetwork'; // 👈 make sure this hook returns { networkStatus: { connected: boolean } }
import './ItemEdit.css';

const log = getLogger('ItemAdd');

interface ItemAddProps extends RouteComponentProps<{ id?: string }> {}

const ItemAdd: React.FC<ItemAddProps> = ({ history }) => {
    const { saveItem, updateItemLocally } = useContext(ItemContext);
    const { networkStatus } = useNetwork();

    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [noTracks, setNoTracks] = useState('');
    const [releaseDate, setReleaseDate] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [version, setVersion] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const showToastMessage = (msg: string) => {
        setToastMessage(msg);
        setShowToast(true);
    };

    // 👇 Local save helper
    const saveItemLocally = async (offlineItem: ItemProps) => {
        try {
            const { value } = await Preferences.get({ key: 'pendingUpdates' });
            const pending = value ? JSON.parse(value) : [];
            const updatedPending = [...pending.filter((i: any) => i._id !== offlineItem._id), offlineItem];
            await Preferences.set({ key: 'pendingUpdates', value: JSON.stringify(updatedPending) });
            await Preferences.set({ key: `item_${offlineItem._id}`, value: JSON.stringify(offlineItem) });
        } catch (err) {
            console.error('Error saving item locally', err);
        }
    };

    const handleSave = useCallback(async () => {
        const editedItem: ItemProps = {
            title: title.trim(),
            artist: artist.trim(),
            noTracks: Number(noTracks) || 0,
            releaseDate: releaseDate ? new Date(releaseDate).toISOString() : null,
            date: new Date(date).toISOString(),
            version,
        };

        // Offline path
        if (!networkStatus?.connected) {
            const tempId = `temp-${Date.now()}`;
            const offlineItem = { ...editedItem, _id: tempId };
            await saveItemLocally(offlineItem);
            updateItemLocally?.(offlineItem);
            showToastMessage('Item saved locally. Will sync when online.');
            history.goBack();
            return;
        }

        // Online path
        try {
            setSaving(true);
            await saveItem?.(editedItem);
            showToastMessage('Item saved online.');
            history.goBack();
        } catch (err) {
            console.error('Save failed:', err);
            showToastMessage('Error saving item online.');
        } finally {
            setSaving(false);
        }
    }, [title, artist, noTracks, releaseDate, date, version, networkStatus, saveItem, updateItemLocally, history]);

    log('render');

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Add Item</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleSave}>Save</IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <IonItem>
                    <IonLabel position="floating">Title</IonLabel>
                    <IonInput value={title} onIonChange={e => setTitle(e.detail.value || '')} />
                </IonItem>

                <IonItem>
                    <IonLabel position="floating">Artist</IonLabel>
                    <IonInput value={artist} onIonChange={e => setArtist(e.detail.value || '')} />
                </IonItem>

                <IonItem>
                    <IonLabel position="floating">Number of Tracks</IonLabel>
                    <IonInput value={noTracks} onIonChange={e => setNoTracks(e.detail.value || '')} />
                </IonItem>

                <IonItem>
                    <IonLabel position="floating">Date Released</IonLabel>
                    <IonInput type="date" value={releaseDate} onIonChange={e => setReleaseDate(e.detail.value!)} />
                </IonItem>

                <IonItem>
                    <IonLabel position="floating">Date Added</IonLabel>
                    <IonInput value={date} readonly />
                </IonItem>

                <IonLoading isOpen={saving} message="Saving item..." spinner="crescent" />
                <IonToast isOpen={showToast} message={toastMessage} duration={2000} onDidDismiss={() => setShowToast(false)} />
            </IonContent>
        </IonPage>
    );
};

export default ItemAdd;
