import React, {createContext, useContext, useMemo} from 'react';

const PingerContext = createContext(() => {});
export {PingerContext};

export function usePinger() {
    const pinger = useContext(PingerContext);
    return pinger;
}

async function defaultPinger(url, action, detail) {
    const body = {action};
    if (detail) body.detail = detail;
    const resp = await fetch(
        url,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    );
}

export function WithDefaultPinger({url='/ping', children}) {
    const pinger = useMemo(() => defaultPinger.bind(null, url), [url]);

    return (
        <PingerContext.Provider value={pinger}>
            { children }
        </PingerContext.Provider>
    )
}