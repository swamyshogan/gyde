import React, {useMemo, useCallback} from 'react';

export default function MSRuler({
    cellWidth,
    residueNumbers,
    length,
    xOffset,
    features=[],
    selectedColumns,
    updateSelectedColumns,
    columnSwizzle: explicitColumnSwizzle,
    hiddenColumnMarkers,
    onHiddenColumnMarkerClick
}) {
    const columnSwizzle = useMemo(() => {
        if (explicitColumnSwizzle) return explicitColumnSwizzle;
        const columnSwizzle = [];
        for (let i = 0; i < length; ++i) columnSwizzle.push(i);
        return columnSwizzle
    }, [explicitColumnSwizzle, length]);

    const invertSwizzle = useMemo(() => {
        const invertSwizzle = new Array(length);
        columnSwizzle.forEach((s, i) => {invertSwizzle[s] = i});
        return invertSwizzle;
    }, [columnSwizzle, length]);

    const displayResidueNumbers = useMemo(() => {
        if (residueNumbers) {
            return columnSwizzle.map((i) => residueNumbers[i]?.toString());
        } else {
            return columnSwizzle.map((i) => (i+1).toString());
        }
    }, [residueNumbers, columnSwizzle]);

    const swizzledFeatures = useMemo(() => {
        if (!explicitColumnSwizzle) return features;

        const swizzledFeatures = [];
        for (const feature of features) {
            const swizzledPosns = [1e31];
            for (let i = feature.start; i <= feature.end; ++i) {
                const si = invertSwizzle[i];
                if (typeof(si) === 'number') swizzledPosns.push(si);
            }

            swizzledPosns.sort((a, b) => a-b);
            let rangeStart = -1e20, rangeEnd = -1e20;
            for (const j of swizzledPosns) {
                if (j === (rangeEnd + 1)) {
                    rangeEnd = j;
                } else {
                    if (rangeStart >= 0) swizzledFeatures.push({
                        ...feature,
                        start: rangeStart,
                        end: rangeEnd
                    });
                    rangeStart = rangeEnd = j;
                }
            }
        }
        return swizzledFeatures;
    }, [invertSwizzle, explicitColumnSwizzle, features]);

    const rulerLength = displayResidueNumbers.length;

    const onRulerClick = useCallback((ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const ci = ev.target.dataset?.columnIndex;
        if (updateSelectedColumns && ci) {
            updateSelectedColumns({
                op: (ev.ctrlKey || ev.metaKey) 
                    ? 'toggle'
                    : ev.shiftKey
                      ? 'extend'
                      : 'set', 
                column: parseInt(ci),
                swizzle: columnSwizzle
            })
        }
    }, [updateSelectedColumns]);

    const onMarkerClick = useCallback((ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const mi = ev.target.dataset?.markerIndex;
        if (onHiddenColumnMarkerClick && mi) {
            onHiddenColumnMarkerClick(hiddenColumnMarkers[parseInt(mi)]);
        }
    }, [onHiddenColumnMarkerClick, hiddenColumnMarkers]);

    const ticks = [];
    for (let i = 0; i < rulerLength; ++i) {
        ticks.push(
            <div key={ i }
                 title={ displayResidueNumbers[i] }
                 data-column-index={ columnSwizzle[i] }
                 style={{
                    position: 'absolute',
                    top: 0,
                    left: i * cellWidth,
                    width: cellWidth,
                    height: 12,
                    // background: 'white',
                    textAlign: 'center',
                    fontSize: 7.5,
                    overflow: 'visible'                    
                 }}>
                    <div style={{
                        display: 'inline-block',
                        pointerEvents: 'none',
                    }}>
                        { ((i % 2) === 0) ? displayResidueNumbers[i] : '.' }
                    </div>
            </div>
        )
    }

    const ranges = [];
    if (selectedColumns) {

        const sortedIndices = [1e31];
        for (const sc of selectedColumns) {
            if (typeof(invertSwizzle[sc]) === 'number') sortedIndices.push(invertSwizzle[sc]);
        }
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

    const selectionBoxes = ranges.map(([rangeStart, rangeEnd], index) => {
        return (
            <div key={`s${index}`}
                 style={{
                    position: 'absolute',
                    top: 0,
                    left: (rangeStart)*cellWidth,
                    width: (rangeEnd-rangeStart+1)*cellWidth,
                    height: 20,
                    background: 'red',
                    opacity: 0.3,
                    pointerEvents: 'none'
                 }} />
        )
    });

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: 20,
            overflow: 'hidden',
            fontSize: 10,
            userSelect: 'none',
            cursor: 'pointer'
        }} >
            <div 
                onClick={ onRulerClick }
                style={{
                    position: 'absolute',
                    top: 0,
                    left: xOffset,
                    width: cellWidth * length
            }} >
                
                { ticks }
                { swizzledFeatures.map(({start, end, color, feature}, index) => (
                    <div key={index}
                         style={{
                            position: 'absolute',
                            top: 10,
                            left: (start-1)*cellWidth,
                            width: (end-start+1)*cellWidth,
                            height: 10,
                            background: color || 'blue',
                            textAlign: 'center'
                         }} >
                        <div style={{
                            display: 'inline-block',
                            pointerEvents: 'none'
                        }}>
                            { feature }
                        </div>
                    </div>
                )) }
                { selectionBoxes }
                { hiddenColumnMarkers?.map(({position, startDeletion, endDeletion}, index) => (
                    <div key={`h${index}`}
                         title={`Hidden ${residueNumbers[startDeletion]?.toString()}-${residueNumbers[endDeletion]?.toString()}`}
                         onClick={onMarkerClick}
                         data-marker-index={index}
                         style={{
                            position: 'absolute',
                            top: 8,
                            left: ((position-1)*cellWidth+8),
                            width: 0,
                            height: 0,
                            borderTop: '12px solid black',
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                        }} />
                )) }
            </div>
        </div>
    );
}