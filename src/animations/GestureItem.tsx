import React, { useRef, useState, useEffect } from 'react';
import { CreateAnimation, createGesture, GestureDetail } from '@ionic/react';

const MAX_TRANSLATE = 150; // pixels
const SWIPE_THRESHOLD = 0.2; // 20% of MAX_TRANSLATE
const VELOCITY_TRIGGER = 0.4; // fast swipe trigger

interface GestureItemProps {
    children: React.ReactNode;
    onSwipeComplete?: () => void;
}

export const GestureItem: React.FC<GestureItemProps> = ({ children, onSwipeComplete }) => {
    const animationRef = useRef<CreateAnimation>(null);
    const [progressStart, setProgressStart] = useState<any>();
    const [progressStep, setProgressStep] = useState<any>();
    const [progressEnd, setProgressEnd] = useState<any>();
    const [onFinish, setOnFinish] = useState<any>();
    const initialStep = useRef(0);
    const started = useRef(false);
    const gestureRef = useRef<any>(null);

    useEffect(() => {
        if (!animationRef.current) {

            return;
        }

        const el = Array.from(animationRef.current.nodes.values())[0];


        const gesture = createGesture({
            el,
            gestureName: 'item-swipe',
            threshold: 0,
            onMove,
            onEnd,
        });

        gesture.enable(true);
        gestureRef.current = gesture;

        return () => {

            gesture.destroy();
        };
    }, []);

    const onMove = (ev: GestureDetail) => {
        if (!started.current) {

            setProgressStart({ forceLinearEasing: true });
            started.current = true;
        }

        const step = getStep(ev);
        console.log(`Moving: deltaX=${ev.deltaX.toFixed(2)}, step=${step.toFixed(2)}`);
        setProgressStep({ step });
    };

    const onEnd = (ev: GestureDetail) => {
        if (!started.current) return;
        console.log(' Gesture ended');

        gestureRef.current?.enable(false);

        const step = getStep(ev);
        const velocity = Math.abs(ev.velocityX);
        const shouldComplete = step > SWIPE_THRESHOLD || velocity > VELOCITY_TRIGGER;



        setProgressEnd({ playTo: shouldComplete ? 1 : 0, step });
        setOnFinish({
            callback: () => {

                gestureRef.current?.enable(true);
                setProgressStart(undefined);
                setProgressStep(undefined);
                setProgressEnd(undefined);
                started.current = false;

                if (shouldComplete) {

                    onSwipeComplete?.();
                }
            },
            opts: { oneTimeCallback: true },
        });

        initialStep.current = shouldComplete ? MAX_TRANSLATE : 0;
    };

    const getStep = (ev: GestureDetail) => {
        const delta = initialStep.current + ev.deltaX;
        return clamp(0, delta / MAX_TRANSLATE, 1);
    };

    const clamp = (min: number, n: number, max: number) => Math.max(min, Math.min(n, max));

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
            {/* Background */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingLeft: '20px',
                    fontWeight: 'bold',
                    color: '#2b7a0b',
                    zIndex: 0,
                }}
            >
                ➤ Edit
            </div>

            <CreateAnimation
                ref={animationRef}
                duration={300}
                progressStart={progressStart}
                progressStep={progressStep}
                progressEnd={progressEnd}
                onFinish={onFinish}
                fromTo={{
                    property: 'transform',
                    fromValue: 'translateX(0)',
                    toValue: `translateX(${MAX_TRANSLATE}px)`,
                }}
            >
                <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
            </CreateAnimation>
        </div>
    );
};
