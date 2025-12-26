/// (number[]) => number
/// find the maximum numerical value of an array
export function max(array) {
    let max = -Infinity;
    const len = array.length;
    
    for (let i = 0; i < len; i++) {
        const val = array[i];
        if (val !== null && val > max && val !== Infinity) {
            max = val;
        }
    }

    if (max === -Infinity) {
        return null;
    } else {
        return max;
    }
}

/// (number[]) => number
/// find the minimum numerical value of an array
export function min(array) {
    let min = Infinity;
    const len = array.length;
    
    for (let i = 0; i < len; i++) {
        const val = array[i];
        if (val !== null && val < min && val !== -Infinity) {
            min = val;
        }
    }

    if (min === Infinity) {
        return null;
    } else {
        return min;
    }
}

/// (number[]) => number[]
export function normalizeArrayByMax(array) {
    const result = [];
    const maxVal = max(array);

    for (let i = 0; i < array.length; i++) {
        (array[i] == null || maxVal === 0) ? result.push(null) : result.push(array[i]/maxVal);
    }

    return result;
}

/// (number[], number) => number[]
/// add a scalar value to all entries in a numerical array
export function addScalarToArray(array, scalar) {
    const result = [];

    for (let i = 0; i < array.length; i++) {
        (array[i] == null) ? result.push(null) : result.push(array[i] + scalar);
    }

    return result;
}

/// (number[], number) => number[]
/// multiple all entries in a numerical array with a scalar value
export function multiplyScalarWithArray(array, scalar) {
    const result = [];

    for (let i = 0; i < array.length; i++) {
        (array[i] == null) ? result.push(null) : result.push(array[i] * scalar);
    }

    return result;
}

/// (number[], number, number) =>  number[][]
/// reshape an array[width * height] to an array[width][height]
export function reshapeArray(array, width, height) {
    const result = [];

    for (let i = 0; i < width; i++) {
        result.push([]);

        for (let j = 0; j < height; j++) {
            result[i].push(array[height * i + j]);
        }
    }

    return result;
}

/// (number[]) => number
export function average(array) {
    let result = 0;
    let n = 0;

    array.forEach((val) => {
        if (val !== null && Math.abs(val) !== Infinity) {
            result += val;
            n += 1;
        }
    });

    if (n === 0) {
        return null;
    } else {
        result /= n;
        return result;
    }
}

export function geometricMean(array) {
    const len = array.length;
    if (len === 0)  return;

    const fac = array.reduce((prev, curr) => prev + Math.log(curr)) / len;
    return Math.exp(fac);
}

/// (number[]) => number
// returns the variance of a dsitribution, aka squared standard deviation
export function variance(array) {
    let result = 0;
    let n = 0;
    const avg = average(array);

    array.forEach((val) => {
        if (val !== null && Math.abs(val) !== Infinity) {
            result += Math.pow(val - avg, 2);
            n += 1;
        }
    })

    if (n === 0) {
        return null;
    } else {
        result /= n;
        return result;
    }
}

/// (number[]) => number
// returns the standard deviation of a dsitribution
export function stdev(array) {
    return Math.pow(variance(array), 0.5);
}
