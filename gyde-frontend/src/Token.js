import React, {createContext, useContext, useMemo} from 'react';

const TokenContext = createContext(() => {});
export {TokenContext};

export function useTokenService() {
    const token = useContext(TokenContext);
    return token;
}

export function WithTokenService({url='/token', children}) {
    const tokenService = useMemo(() => {
        let currentToken = null,
            timestamp = 0;

        return (async () => {
            const now = Date.now();
            if (now - timestamp > 60000) {
                const resp = await fetch(url);
                if (!resp.ok) {
                    console.log(resp.statusText);
                }
                const body = await resp.json();
                currentToken = body?.token;
                timestamp = now;
            }
            return currentToken;
        });
    }, [url]);

    return (
        <TokenContext.Provider value={tokenService}>
            { children }
        </TokenContext.Provider>
    )
}