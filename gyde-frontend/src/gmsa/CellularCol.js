import React, {useCallback, useMemo} from 'react';

export default function CellularCol({
    data = [],
    yOffset=0,
    itemHeight=14,
    selection,
    swizzle=null,
    bgColours = [],
    updateSelection,
    update,
    CellComponent,
    height=500,
    ...rest
}) {
    const swizzledData = swizzle 
        ? swizzle.map((i) => data[i])
        : data;
    const swizzledBG = swizzle
        ? swizzle.map((i) => bgColours[i])
        : bgColours;

    const selectedRanges = useMemo(() => {
        const sel = swizzle ? 
            selection.flatMap((s) => {
                const i = swizzle.indexOf(s);
                if (i >= 0) return [i]; 
            }) : selection;

        const ranges = [];
        {
            const sortedIndices = [...sel, 1e31];
            sortedIndices.sort((a, b) => a-b);

            let rangeStart = -1e20, rangeEnd = -1e20;
            for (const j of sortedIndices) {
                if (j === (rangeEnd + 1)) {
                    rangeEnd = j;
                } else {
                    if (rangeStart >= 0) ranges.push([rangeStart, rangeEnd]);
                    rangeStart = rangeEnd = j;
                }
            }
        }
        return ranges;
    }, [selection, swizzle]);

    const selectionSet = new Set(selection || []);

    const updateSelectionBoundSwizzle = useCallback((update) => {
        updateSelection({...update, swizzle});
    }, [updateSelection, swizzle]);

    const firstVisible = Math.max(0, (-yOffset/itemHeight)|0),
          lastVisible = Math.min(((-yOffset+height+itemHeight)/itemHeight)|0, (swizzle ? swizzle.length : data.length) - 1);

    // Round visible ranges so that small scrolling doesn't always trigger a re-render.
    const roundedFirstVisible = ((firstVisible/10)|0)*10,
          roundedLastVisible = Math.min(Math.ceil(lastVisible/10)*10, data.length -1);

    const visIndices = [];
    for (let i = firstVisible; i <= lastVisible; ++i) visIndices.push(i);

    return (
        <div style={{
                 position: 'relative',
                 width: '100%',
                 height: '100%',
                 overflow: 'hidden',
                 fontSize: 12,
                 background: 'white'
             }}
        >
            <div style={{
                position: 'absolute',
                top: yOffset,
                left: 0,
                width: '100%'
            }} >
                { visIndices.map((i) => {
                    const d = swizzledData[i];
                    return (
                        <div key={i}
                             style={{
                                position: 'absolute',
                                left: 0,
                                top: i*itemHeight,
                                height: itemHeight,
                                marginBottom: '-1px',
                                borderBottom: '1px solid #bbbbbb',
                                width: '100%',
                                display: 'flex',
                                background: swizzledBG[i],
                                
                        }} >
                            <CellComponent data={swizzledData[i]}
                                           index={swizzle ? swizzle[i] : i}
                                           selection={selection}
                                           isSelected={selectionSet.has(swizzle ? swizzle[i] : i)}
                                           updateSelection={updateSelectionBoundSwizzle}
                                           update={update}
                                           {...rest} />
                        </div>
                    );
                }) }

                { selectedRanges.map(([start, end], idx) => (
                    <div key={idx} style={{
                        position: 'absolute',
                        top: start * itemHeight,
                        left: 0,
                        height: (end-start+1) * itemHeight - 4 ,
                        width: 'calc(100% - 4px)',
                        border: '2px solid #ff6666',
                        pointerEvents: 'none'
                    }} />
                )) }
            </div>
        </div>
    );
}