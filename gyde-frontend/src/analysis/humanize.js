function compareResidueIDs(p1, p2) {
    if (!p1 || !p2 || p1[0] !== p2[0]) return false;
    const i1 = parseInt(p1.substring(1)), i2 = parseInt(p2.substring(1));
    if (i1 > i2) {
        return true;
    } else if (i1 === i2) {
        return p1.localeCompare(p2) >= 0;
    }
}

export function humanize(seq, germline, chain, residueNumbers, cdrPos, vernierPos) {
    vernierPos = new Set(vernierPos);

    const humanSeq = [],
          cdrMask = [];

    {
        for (let i = 0; i < seq.length; ++i) cdrMask[i] = false;

        for (const [name, {start, stop, color}] of Object.entries(cdrPos)) {
            for (let i = 0; i < residueNumbers.length; ++i) {
                if (compareResidueIDs(residueNumbers[i], start)) {
                    for (let j = i + 1; j < residueNumbers.length; ++j) {
                        if (compareResidueIDs(residueNumbers[j], stop)) {
                            for (let m  = i; m <= j; ++m) cdrMask[m] = true
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }

    const alternatives = [];
    for (let i = 0; i < seq.length; ++i) {
        if (cdrMask[i] || germline[i] === '-' || germline[i] === 'X' || vernierPos.has(chain + residueNumbers[i])) {
            humanSeq.push(seq[i]);
            if (vernierPos.has(chain + residueNumbers[i]) && seq[i] !== germline[i] && germline[i] !== 'X') {
                alternatives.push({
                    position: i + 1,
                    options: [
                        seq[i],
                        germline[i]
                    ]
                });
            }
        } else {
            humanSeq.push(germline[i]);
        }
    }

    return {seq: humanSeq.join(''), alternatives}
}