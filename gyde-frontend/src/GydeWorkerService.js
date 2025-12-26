import React, {createContext, useContext, useState, useEffect} from 'react';

const GydeWorkerServiceContext = createContext(() => undefined);
export {GydeWorkerServiceContext};

export function useGydeWorkerService() {
    const gws = useContext(GydeWorkerServiceContext);
    return gws;
}

export function WithGydeWorkers({n=4, children}) {
    const [workerService, setWorkerService] = useState(undefined);

    useEffect(() => {
        const workers = [];
        for (let i = 0; i < n; ++i) {
            const w = new Worker(new URL('./structureView/structure-worker.js', import.meta.url));
            workers.push(w);
        } 
        setWorkerService(new GydeWorkerService(workers));
    }, []);

    return (
        <GydeWorkerServiceContext.Provider value={workerService}>
            { children }
        </GydeWorkerServiceContext.Provider>
    )
}

class GydeWorkerService {
    constructor(workers) {
        this.onWorkerResponse = this.onWorkerResponse.bind(this);
        this.workers = workers;
        workers.forEach((w) => w.onmessage = this.onWorkerResponse);

        this.workerTagSeed = 0;
        this.workerTaskPromises = {};
    }

    onWorkerResponse({data: {tag, result, error}}) {
        if (error) {
            this.workerTaskPromises[tag].reject(error);
        } else {
            this.workerTaskPromises[tag].resolve(result);
        }
        delete this.workerTaskPromises[tag];
    };

    runWorkerTask(action, payload) {
        const n = this.workerTagSeed++;
        const tag = `j${n}`;
        const p = new Promise((resolve, reject) => {
            this.workerTaskPromises[tag] = {resolve, reject};
            this.workers[n%this.workers.length].postMessage({
                action,
                tag,
                payload
            });
        });
        return p;
    }

    align(seqA, seqB, options={}) {
        return this.runWorkerTask('align', {seqA, seqB, options: {substMatrix: 'blosum62', ...options}});
    }
}