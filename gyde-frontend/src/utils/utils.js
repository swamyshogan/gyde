export function aosToSoa(aos) {
    const soa = {};
    for (const k of Object.keys(aos[0])) {
        soa[k] = aos.map((x) => x[k]);
    }
    return soa;
}

export function aosToSoaInclusive(aos) {
    const allKeys = Object.keys(aos[0]);
    for (const s of aos) {
        for (const k of Object.keys(s)) {
            if (allKeys.indexOf(k) < 0) allKeys.push(k);
        }
    }

    const soa = {};
    for (const k of allKeys) {
        soa[k] = aos.map((x) => x[k]);
    }
    return soa;
}


export function soaToAos(soa) {
    const aos = [],
          keys = Object.keys(soa),
          length = soa[keys[0]].length;

    for (let i = 0; i < length; ++i) {
        const obj = {};
        for (const k of keys) obj[k] = soa[k][i];
        aos.push(obj);
    }
    return aos;
}

export function rgbStringToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    
    let rgb_ = rgb.split("(")[1].split(")")[0];
    const rgbList = rgb_.split(',');
    const rgbHexList = rgbList.map((x) => {
        x = parseInt(x).toString(16);
        return (x.length === 1) ? "0" + x : x;
    })

    return "#" + rgbHexList.join("");
}

export function cleanNumberForDisplay(num, precision=2) {
    const x = parseFloat(num);
    const fac = Math.pow(10, precision);

    if (!x) {
        return null;
    }

    if (Math.abs(x) < 1/fac) {
        return x.toExponential(precision);
    } else {
        return Math.floor(Math.round(fac * x))/fac;
    }
}

export function arrayCmp(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export function arrayCmpDeep(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
        if (!arrayCmpDeep(a[i], b[i])) return false;
    }
    return true;
}

export function pause(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), time);
    });
}


export function* fastaParse(data) {
    let description = '',
        seqLines = [];

    const makeSeq = () => {
        const record = {
            seq: seqLines.join(''),
            description

        }
        seqLines = []; description = '';
        return record;
    }

    for (const line of data.split('\n')) {
        if (line.length === 0) continue;
        if (line[0] === '>') {
            if (seqLines.length) yield makeSeq();

            description = line.substring(1).trim();
        } else {
            seqLines.push(line.trim());
        }
    }

    if (seqLines.length) yield makeSeq();
}
