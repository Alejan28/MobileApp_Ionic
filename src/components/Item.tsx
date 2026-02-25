import React,{memo} from 'react';
import {IonItem,IonLabel} from '@ionic/react'
import {ItemProps} from './ItemProps';


interface ItemPropsExt extends ItemProps{
    onEdit:(id?: string)=>void;
}

const Item: React.FC<ItemPropsExt> = ({_id,title,artist,photo,onEdit})=>{
    return(
        <IonItem onClick={() => onEdit(_id)}>
            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    marginRight: 12,
                    flexShrink: 0,
                    backgroundColor: '#0a9', // gray background for placeholder
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#ccc',
                    fontWeight: 'bold',
                }}
            >
                {photo?.webviewPath ? (
                    <img
                        src={photo.webviewPath}
                        alt="Album photo"
                        style={{width: '100%', height: '100%', objectFit: 'cover'}}
                    />
                ) : (
                    'Album'
                )}
            </div>
            <IonLabel>{title}</IonLabel>
            <IonLabel>{artist}</IonLabel>
        </IonItem>
    )
}
export default Item;
