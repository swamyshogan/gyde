import {useReducer, useEffect} from 'react';

export function usePeriodicUpdates(interval=5000) {
    const [tickNumber, doTick] = useReducer((x) => x+1, 0);
    useEffect(() => {
        const timer = setInterval(doTick, interval);
        return () => {clearInterval(timer)}
    }, [interval]);
    return tickNumber;
}
