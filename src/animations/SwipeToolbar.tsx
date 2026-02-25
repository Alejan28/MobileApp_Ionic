import React, { useEffect, useRef, useState } from 'react';
import { IonToolbar, createGesture, GestureDetail } from '@ionic/react';
import { useHistory } from 'react-router-dom';

const SWIPE_THRESHOLD = 100; // pixels needed to trigger
const VELOCITY_TRIGGER = 0.3;

interface SwipeBackToolbarProps {
    children: React.ReactNode;
}

export const SwipeBackToolbar: React.FC<SwipeBackToolbarProps> = ({ children }) => {
    const toolbarRef = useRef<HTMLIonToolbarElement>(null);
    const history = useHistory();
    const [translateX, setTranslateX] = useState(0);
    const active = useRef(false);

    useEffect(() => {
        const el = toolbarRef.current;
        if (!el) return;

        const gesture = createGesture({
            el,
            threshold: 0,
            gestureName: 'toolbar-swipe',
            onMove: (ev: GestureDetail) => {
                if (ev.deltaX > 0) {
                    active.current = true;
                    setTranslateX(Math.min(ev.deltaX, 150));
                }
            },
            onEnd: (ev: GestureDetail) => {
                if (!active.current) return;
                active.current = false;

                const shouldGoBack = ev.deltaX > SWIPE_THRESHOLD || ev.velocityX > VELOCITY_TRIGGER;

                if (shouldGoBack) {
                    console.log('🔙 Swipe detected → Navigating back to /items');
                    el.style.transition = 'transform 0.3s ease-out';
                    el.style.transform = `translateX(100%)`;
                    setTimeout(() => {
                        el.style.transition = '';
                        el.style.transform = '';
                        history.push('/items');
                    }, 250);
                } else {
                    // Snap back if not enough swipe
                    el.style.transition = 'transform 0.2s ease-out';
                    el.style.transform = 'translateX(0)';
                    setTimeout(() => {
                        el.style.transition = '';
                    }, 200);
                }
            },
        });

        gesture.enable(true);

        return () => {
            gesture.destroy();
        };
    }, [history]);

    return (
        <IonToolbar
            ref={toolbarRef}
            style={{
                transform: `translateX(${translateX}px)`,
                transition: active.current ? 'none' : 'transform 0.2s ease-out',
                touchAction: 'pan-y',
            }}
        >
            {children}
        </IonToolbar>
    );
};
