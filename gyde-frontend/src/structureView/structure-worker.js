import { align } from 'molstar/lib/mol-model/sequence/alignment/alignment';


onmessage = ({data: {action, tag, payload}}) => {
    try {
        if (action === 'align') {
            const {seqA, seqB, options} = payload;
            const ali = align(seqA, seqB, options)
            postMessage({tag, result: ali});
        } else {
            throw Error('Unknown action ' + action);
        }
    } catch (err) {
        postMessage({tag, error: err.message || err.toString()})
    }
};