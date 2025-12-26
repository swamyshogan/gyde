import React, {createContext, useContext, useState, useEffect} from 'react';

const UserDataContext = createContext(() => {});
export {UserDataContext};

export function useUserData() {
    const userData = useContext(UserDataContext);
    return userData;
}

export function WithUserData({url='/user-info', children}) {
    const [userData, setUserData] = useState({});

    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw Error(resp.statusText);
                const data = await resp.json();
                setUserData(data);
            } catch (err) {
                console.log(err);
                setUserData({err: err});
            }
        })();
    }, [url]);

    return (
        <UserDataContext.Provider value={userData}>
            { children }
        </UserDataContext.Provider>
    )
}