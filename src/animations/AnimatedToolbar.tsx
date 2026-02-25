import React, { useRef, useEffect } from 'react';
import { IonToolbar, CreateAnimation } from '@ionic/react';

export const AnimatedToolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const animationRef = useRef<CreateAnimation>(null);

    useEffect(() => {
        if (animationRef.current) {
            animationRef.current.animation.play();
        }
    }, []);

    return (
        <CreateAnimation
            ref={animationRef}
            duration={800}
            easing="ease-out"
            keyframes={[
                { offset: 0, transform: 'translateY(-50px)', opacity: '0' },
                { offset: 1, transform: 'translateY(0)', opacity: '1' }
            ]}
        >
            <IonToolbar>
                {children}
            </IonToolbar>
        </CreateAnimation>
    );
};
