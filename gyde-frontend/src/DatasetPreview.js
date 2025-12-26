import React, {useMemo} from 'react';

import SequenceTable from './SequenceTable';

export default function DatasetPreview({
    name, 
    columnarData, 
    dataColumns, 
    dataRowCount, 
    maxPreviewColumns=20,
    nameColumn = 'concept_name',
    ...props
}) {
    const columnSetDescs = [];
    for (const cdk of ['seqColumns', 'seqRefColumns', 'msaColumns', 'msaRefColumns', 'abNumColumns', 'abNumRefColumns']) {
        if (props[cdk]) columnSetDescs.push(props[cdk]);
    }

    const {dataRows, viewColumnarData, visibleColumns, alignments, overflowColumns} = useMemo(() => {
        const hiddenColumns = new Set(['Names', nameColumn, 'seqid']);
        for (const csd of columnSetDescs) {
            for (const d of csd || []) {
                if (d && d.column)  hiddenColumns.add(d.column);
            } 
        }

        const dataRows = [];
        for (let i = 0; i < dataRowCount; ++i) dataRows.push(i);

        const names = (() => {
            const names = [];
            const cname = columnarData[nameColumn] || [],
                  seqid = columnarData.seqid || [];
            for (let i = 0; i < dataRowCount; ++i) {
                names.push(cname[i] || seqid[i]);
            }
            return names;
        })();

        const viewColumnarData = {...columnarData, 'Names': names};
        const visibleColumns = [
            'Names',
            ...(props.seqColumns || []).map(({column}) => column),
            ...dataColumns.filter((x) => !hiddenColumns.has(x) && !x.startsWith('_gyde'))];
        const alignments = (props.seqColumns || []).map(({column, numbers=[]}) => {
            const ali = [...(columnarData[column] || [])];
            ali.residueNumbers = numbers;
            return ali;
        });

        let overflowColumns = [];
        if (visibleColumns.length > maxPreviewColumns) {
            overflowColumns = visibleColumns.splice(maxPreviewColumns);
        }

        return {dataRows, viewColumnarData, visibleColumns, alignments, overflowColumns};
    }, [dataRowCount, columnarData, dataColumns, props.seqColumns, maxPreviewColumns, ...columnSetDescs])

    return (
        <div style={{
            background: 'white',
            color: 'black',
        }}>
            { overflowColumns?.length > 0
                ? <div>Hidden {overflowColumns.length} columns in preview due to space constraints</div>
                : undefined }
            <SequenceTable columnarData={ viewColumnarData }
                           dataRows={ dataRows }
                           dataColumns={ visibleColumns }
                           seqColumns={ props.seqColumns || [] }
                           seqColumnNames={ props.seqColumnNames }
                           alignments={ alignments }
                           columnTypes={ {} /*columnTypes*/}
                           systemFont="Inconsolata"
                           systemFontScale={0.9} 
                           maxHeight={300} />
        </div>
    );        
}
