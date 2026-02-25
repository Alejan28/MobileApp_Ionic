export interface ItemProps{
    _id?: string;
    title?: string;
    artist?: string;
    noTracks?:string;
    releaseDate?:string;
    date?: string;
    version?: number;
    location?: { lat: number; lng: number };
    photo?: {
        filepath: string;
        webviewPath?: string;
    };
}