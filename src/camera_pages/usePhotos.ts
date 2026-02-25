import { useEffect, useState } from 'react';
import { useCamera } from './useCamera';
import{useGallery} from "./pickPhoto";
import { useFilesystem } from './useFilesystem';
import { usePreferences } from '../components/usePreferences';

export interface MyPhoto {
    filepath: string;
    webviewPath?: string;
    isCamera?: boolean;
}

const PHOTOS = 'photos';

export function usePhotos() {
    const [photos, setPhotos] = useState<MyPhoto[]>([]);
    const { getPhoto } = useCamera();
    const {pickFromGallery}=useGallery();
    const { readFile, writeFile, deleteFile,downloadPhoto } = useFilesystem();
    const { get, set } = usePreferences();
    useEffect(loadPhotos, [get, readFile, setPhotos]);
    return {
        photos,
        takePhoto,
        deletePhoto,
        takePhotoForItem,
        loadPhotoForItem,
    };

    async function takePhoto() {
        const data = await getPhoto();
        const filepath = new Date().getTime() + '.jpeg';
        await writeFile(filepath, data.base64String!);
        const webviewPath = `data:image/jpeg;base64,${data.base64String}`
        const newPhoto = { filepath, webviewPath };
        const newPhotos = [newPhoto, ...photos];
        await set(PHOTOS, JSON.stringify(newPhotos.map(p => ({ filepath: p.filepath }))));
        downloadPhoto(webviewPath, newPhoto.filepath);
        setPhotos(newPhotos);
    }


    async function takePhotoForItem(
        itemId: string,
        source: 'camera' | 'gallery' = 'camera'
    ) {
        console.log(`[takePhotoForItem] Start for itemId=${itemId}, source=${source}`);

        // Pick photo depending on source
        let data: Photo | null = null;
        if (source === 'camera') {
            data = await getPhoto();
        } else if (source === 'gallery') {
            data = await pickFromGallery();
        }

        console.log('[takePhotoForItem] photo result:', data);

        // User cancelled
        if (!data?.webPath && !data?.base64String) {
            console.log('[takePhotoForItem] User cancelled photo selection.');
            return null;
        }

        // Determine filename and webview path
        const filepath = `${itemId}-${Date.now()}.jpeg`;
        const webviewPath = data.base64String
            ? `data:image/jpeg;base64,${data.base64String}`
            : data.webPath!;

        // Save Base64 to app storage if available (camera or gallery)
        if (data.base64String) {
            await writeFile(filepath, data.base64String);
            console.log('[takePhotoForItem] Saved Base64 photo to:', filepath);


            if (source === 'camera') {
                downloadPhoto(webviewPath, filepath);
                console.log('[takePhotoForItem] Downloaded photo');
            }
        }

        const newPhoto: MyPhoto = { filepath, webviewPath };


        await set(`item_photo_${itemId}`, JSON.stringify(newPhoto));
        console.log('[takePhotoForItem] Saved photo to local storage');

        setPhotos([newPhoto, ...photos]);
        console.log('[takePhotoForItem] Updated photos state');

        return newPhoto;
    }





    async function deletePhoto(photo: MyPhoto) {
        const newPhotos = photos.filter(p => p.filepath !== photo.filepath);
        await set(PHOTOS, JSON.stringify(newPhotos));
        await deleteFile(photo.filepath);
        setPhotos(newPhotos);
    }

    async function loadPhotoForItem(itemId: string): Promise<MyPhoto | null> {
        const savedPhotoString = await get(`item_photo_${itemId}`);
        if (!savedPhotoString) return null;
        const savedPhoto = JSON.parse(savedPhotoString) as MyPhoto;

        // Read file content for webview display
        const data = await readFile(savedPhoto.filepath);
        savedPhoto.webviewPath = `data:image/jpeg;base64,${data}`;

        return savedPhoto;
    }


    function loadPhotos() {
        loadSavedPhotos();

        async function loadSavedPhotos() {
            const savedPhotoString = await get(PHOTOS);
            const savedPhotos = (savedPhotoString ? JSON.parse(savedPhotoString) : []) as MyPhoto[];
            console.log('load', savedPhotos);
            for (let photo of savedPhotos) {
                const data = await readFile(photo.filepath);
                photo.webviewPath = `data:image/jpeg;base64,${data}`;
            }
            setPhotos(savedPhotos);
        }
    }
}
