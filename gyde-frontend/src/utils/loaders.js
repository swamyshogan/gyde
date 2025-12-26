import * as XLSX from 'xlsx';
import {csvParseRows} from 'd3';

export function convertToJson(headers, data) {
    const seen = new Set();    
    const fixedHeaders = [...headers].map((h) => {
        if (!h) h = 'Untitled';
        h = '' + h;

        const b = h;
        let n = 2;
        while (seen.has(h)) {
            h = b + ' ' + (n++);
        }
        seen.add(h);
        return h;
    });

    let lastNonBlank = 0;
    const dataObjs = data.map((row, index) => {
        let rowData = {}
        row.forEach((element, index) => {
            if (index < fixedHeaders.length) {
                rowData[fixedHeaders[index]] = element;
            }
        });
        if (Object.keys(row).length > 0) {
            lastNonBlank = index;
        }
        return rowData;
    });

    if (dataObjs.length - lastNonBlank > 1) {
        dataObjs.splice(lastNonBlank+1);
    }    

    dataObjs.columns = fixedHeaders;  // For compatibility with d3-dsv.
    return dataObjs;
}

export function loadSpreadsheet(buffer, format='xlsx') {
    if (format === 'csv') {
        return csvParseRows(new TextDecoder().decode(buffer), (row) => row.map((x) => {
            if (x === '') return x;
            // Similar idea to d3 autoType, but *only* does the number coersion.
            const num = +x;
            if (!Number.isNaN(num)) {
                return num;
            } else {
                return x;
            }
        }));
    } else {
        const workBook = XLSX.read(buffer);

        //get first sheet
        const workSheetName = workBook.SheetNames[0];
        const workSheet = workBook.Sheets[workSheetName];
        //convert to array
        return XLSX.utils.sheet_to_json(workSheet, { header: 1 });
    }
}

export function parseMutationSpreadsheet(buffer, format='xlsx', headerColumns=[
        'name', 'concept_name', 'position', 'mutation', 'structure_url', 'model_1_url', 'complex',
        'HC_sequence', 'LC_sequence'
]) {
    const fileData = loadSpreadsheet(buffer, format);

    const lcHeaderColumns = {};
    for (const c of headerColumns) lcHeaderColumns[c.toLowerCase()] = c;
    let maxHeaderFields = 0,
        bestHeaderMatch = -1;

    for (let i = 0; i < Math.min(fileData.length, 10); ++i) {
        let headerFields = 0;
        for (const h of fileData[i]) if (lcHeaderColumns[(''+h).toLowerCase()]) ++headerFields;
        if (headerFields > maxHeaderFields) {
            bestHeaderMatch = i;
            maxHeaderFields = headerFields;
        }
    }

    if (bestHeaderMatch < 0) {
        throw Error('Could not find any plausible header in spreadsheet');
    }

    const headers = [...fileData[bestHeaderMatch]];
    for (let i = 0; i < headers.length; ++i) {
        if (lcHeaderColumns[('' + headers[i]).toLowerCase()]) headers[i] = lcHeaderColumns[('' + headers[i]).toLowerCase()];
    }

    const rowScore1 = rowScore(fileData[bestHeaderMatch+1], headers, lcHeaderColumns),
          rowScore2 = rowScore(fileData[bestHeaderMatch+2], headers, lcHeaderColumns);

    let dataStart = bestHeaderMatch + 1;
    if (rowScore2 > rowScore1 && fileData[bestHeaderMatch+1].every((field) => !looksLikeSequence(field))) dataStart += 1;    

    fileData.splice(0, dataStart);

    return convertToJson(headers, fileData);
}

function looksLikeSequence(s) {
    return typeof(s) === 'string' && s.length > 50 && /^[A-Z]+$/.exec(s);
}

function rowScore(row, headers, importantHeaders) {
    if (!row) return -1;
    let score = 0;
    for (let i = 0; i < Math.min(row.length, headers.length); ++i) {
        if (headers[i] && row[i]) {
            ++score;
            if (importantHeaders[headers[i]]) score += 2;
            if (looksLikeSequence(row[i])) score += 3;
        }
    }
    return score;
}

export function readAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            resolve(reader.result);
        });
        reader.addEventListener('error', () => {
            reject('Error reading file');
        });
        reader.readAsArrayBuffer(blob);
    });
}

export function readAsText(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            resolve(reader.result);
        });
        reader.addEventListener('error', () => {
            reject('Error reading file');
        });
        reader.readAsText(blob);
    });
}
