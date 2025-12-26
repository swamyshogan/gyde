import React, {createContext, useContext, useState, useEffect} from 'react';

const EnvironmentContext = createContext(() => {});
export {EnvironmentContext};

export function useEnvironment() {
    const environment = useContext(EnvironmentContext);
    return environment;
}

export function useFeatureFlag(name) {
    const environment = useEnvironment();
    return (environment?.featureFlags || {})[name];
}

export function WithEnvironment({url='/environment', children}) {
    const [environment, setEnvironment] = useState({});

    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw Error(resp.statusText);
                const data = await resp.json();
                setEnvironment(data)
            } catch (err) {
                console.log(err);
                setEnvironment({err: err});
            }
        })();
    }, [url]);

    return (
        <EnvironmentContext.Provider value={environment}>
            { children }
        </EnvironmentContext.Provider>
    )
}