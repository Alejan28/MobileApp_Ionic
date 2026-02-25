import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import {useCallback} from "react";

export  function useGallery() {
    const pickFromGallery = useCallback<() => Promise<Photo>>(
        () => Camera.getPhoto({
            resultType: CameraResultType.Base64,
            source: CameraSource.Photos,
            quality: 100,
        }), []);

    return {
        pickFromGallery,
    };
}
