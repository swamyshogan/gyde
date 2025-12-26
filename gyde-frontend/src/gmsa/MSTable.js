import React, {useReducer, useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef} from 'react';
import { useResizeDetector } from 'react-resize-detector';

import MSView from './MSView';
import MSRuler from './MSRuler';
import InfoCol from './InfoCol';
import NoteCol from './NoteCol';
import RatingCol from './RatingCol';
import StatusCol from './StatusCol';
import { VScrollBar, HScrollBar } from './Scrollbar';
import SvgIcon from '@mui/material/SvgIcon';
import NumbersIcon from '@mui/icons-material/Numbers';
import { Tooltip, TextField } from '@mui/material';
import { SequenceLogo } from './SequenceLogo';
import { HeatMap } from './Heatmap';

const DEFAULT_FORMAT = {sigfig: 3};

function reduceColWidths(colWidths, {columns, action, ...update}) {
    const width = Math.max(
        (update.width || 1000) - (columns.length-1)*8 - 12 /* lh + rh drop indicator */ - 20 /* scrollbar */,
        columns.length * 10       // prevent effective size going -ve with lots of columns
    );
    const widthsByKey = {};
    for (const {key, width} of colWidths) {
        widthsByKey[key] = width;
    }
    const newColumns = [];
    const newWidths = columns.map((col, idx) => {
        const key = col.key || `_idx${idx}`

        if (!widthsByKey) newColumns.push(idx);
        return {
            key,
            width: widthsByKey[key] || col.preferredWidth || col.minWidth || 50
        };
    });

    const iota = (min, max) => {
        const r = []
        for (let i = min; i < max; ++i) r.push(i);
        return r;
    }

    const distributeDelta = (delta, columnSet) => {
        const weights = [];
        for (let i = 0; i < columns.length; ++i) weights[i] = 0;
        for (const i of columnSet) {
            const minWidth = columns[i].minWidth || 50;
            const prefWidth = columns[i].preferredWidth || 120;

            if (delta > 0 && newWidths[i].width < prefWidth) {
                weights[i] = Math.abs(prefWidth - newWidths[i].width)
            } else if (delta > 0 && newWidths[i].width < minWidth) {
                weights[i] = Math.abs(minWidth - newWidths[i].width)
            } else if (delta < 0 && newWidths[i].width > prefWidth) {
                weights[i] = Math.abs(prefWidth - newWidths[i].width)
            }
               
        }

        if (weights.every((w) => w === 0)) {
            for (const i of columnSet) {
                if (delta < 0 && newWidths[i].width > columns[i].minWidth || 50) {
                    weights[i] = Math.max(newWidths[i].width, weights[i] = Math.abs((columns[i].minWidth || 50) - newWidths[i].width));
                }
            }
        }

        if (weights.every((w) => w === 0)) {
            for (const i of columnSet) {
                weights[i] = Math.max(newWidths[i].width, 200);
            }
        }

        const totWeight = columnSet.map((c) => weights[c]).reduce((a, b) => a+b, 0);
        if (totWeight < 0.1) return newWidths;

        for (const i of columnSet) {
            newWidths[i].width += (delta * weights[i])/totWeight;
        }
        return newWidths;
    }

    if (action === 'resize') {
        const oldTotal = newWidths.map(({width}) => width).reduce((a, b) => a+b, 0);
        const delta = width - oldTotal;

        const prefWeight = width / Math.min(200, columns.map((c) => c.preferredWidth || 100).reduce((a, b) => a+b));
        for (const nci of newColumns) {
            newWidths[nci].width /= prefWeight;
        }

        return distributeDelta(delta, iota(0, columns.length));
    } else if (action === 'colsize') {
        let delta = update.delta;
        const distTargets = iota(update.columnIndex+1, columns.length);
        if (delta > 0) {
            const distTotalWidth = distTargets.map((i) => newWidths[i].width).reduce((a, b) => a+b),
                  distTotalMin = distTargets.map((i) => columns[i].minWidth || 50).reduce((a, b) => a+b),
                  distHeadroom = distTotalWidth - distTotalMin;
            if (delta > distHeadroom) delta = Math.max(distHeadroom, 0);
        }
        if (delta < 0) {
            const minWidth = columns[update.columnIndex].minWidth,
                  curWidth = newWidths[update.columnIndex].width,
                  headroom = Math.max(0, curWidth - minWidth);

            if (-delta > headroom) delta = -headroom;
        }

        newWidths[update.columnIndex].width += delta;
        if (Math.abs(delta) > 0.01) {
            return distributeDelta(-delta, distTargets);
        } else {
            return newWidths;
        }
    }
    return colWidths;
}

function reduceOffset([ixs, iy], {columnIndex, dx, dy, maxX, maxY}) {
    const newIxs = [...ixs];
    if (columnIndex !== undefined) {
        newIxs[columnIndex] = Math.min(0, Math.max(-maxX, (newIxs[columnIndex]||0) + dx));
    }

    return [newIxs, maxY >= 0 ? Math.min(0, Math.max(-maxY, iy+dy)) : iy];
}

function reduceSelection(selection, {op, item}) {
    if (op === 'set') {
        if (item instanceof Array || item instanceof Set) {
            return [...item];
        } else if (item < 0) {
            return [];
        }  else {
            return [item];
        }
    } else {
        const newSel = [...selection];
        const ei = newSel.indexOf(item);
        if (ei >= 0) {
            newSel.splice(ei, 1);
        } else {
            newSel.push(item);
        }
        newSel.sort();
        return newSel;
    }
}

function SortIcon({colour='black', direction='up', ...props}) {
    let path = "M3 18 L9 18 M3 15 L12 15 M3 12 L15 12 M3 9 L18 9";
    if (direction === 'up') {
        path = "M3 18 L18 18 M3 15 L15 15 M3 12 L12 12 M3 9 L9 9";
    }

    return (
        <SvgIcon viewBox="0 0 24 15">
            <path d={path} strokeWidth="2" stroke={colour} fill="none" />
        </SvgIcon>
    )
}

function FilterIcon({colour='black', ...props}) {
    let path = "M7.5 18 L13.5 18 M6 15 L15 15 M4.5 12 L16.5 12 M3 9 L18 9";

    return (
        <SvgIcon viewBox="0 0 24 15">
            <path d={path} strokeWidth="2" stroke={colour} fill="none" />
        </SvgIcon>
    )
}


function MSTable(props, ref) {
    let {
        allData, columns: rawColumns, rows, selection: managedSelection, updateSelection: updateManagedSelection,
        sortField: managedSortField, updateSortField: updateManagedSortField, swizzle: precomputedSwizzle,
        tableFilters, // Should be an unmanaged variant???
        updateTableFilters, tableFormats={},         // Ditto
        updateTableFormats, filter, cellWidth=8, cellHeight=14, cellPaddingX=2, cellPaddingY=2, maxHeight=500,
        height=undefined, isSequenceLogoVisible, isHeatmapVisible, heatmapDataObject, heatmapDataScale,
        heatmapRelativeToWT, heatmapColorPalette, stagedMutations, setStagedMutations, 
        checkColumnMove, doColumnMove, ...otherProps
     } = props;
    const columns = useMemo(() => rawColumns.map(({columnFilter, columnSwizzle, hiddenColumnMarkers, type, data, ...rest}) => {
        if (type === 'msa') {
            const maxLength = (data || []).map(({seq}) => seq ? seq.length : 0).reduce((a, b) => Math.max(a, b), 0);

            if (!columnSwizzle) {
                columnSwizzle = [];
                for (let i = 0; i < maxLength; ++i) {
                    if (!columnFilter || columnFilter.has(i)) columnSwizzle.push(i);
                }
            }
            if (!hiddenColumnMarkers && columnFilter) {
                hiddenColumnMarkers = [];
                let last = -1;
                columnSwizzle.forEach((s, i) => {
                    if (s !== last+1) {
                        hiddenColumnMarkers.push({
                            position: i,
                            startDeletion: last + 1,
                            endDeletion: s - 1
                        });
                    }
                    last = s;                    
                });
                if (last !== maxLength - 1) {
                    hiddenColumnMarkers.push({
                        position: columnSwizzle.length,
                        startDeletion: last + 1,
                        endDeletion: maxLength - 1
                    })
                }
            }
        }

        return {type, columnSwizzle, hiddenColumnMarkers, data, ...rest}
    }), [rawColumns]);
    const columnRef = useRef(columns);
    columnRef.current = columns;

    const [[xOffsets, yOffset], updateOffset] = useReducer(reduceOffset, [columns.map(() => 0), 0]);
    const updateOffsetForColumn = useMemo(() => {
        return columns.map((_, i) => (dx, dy, maxX, maxY) => {
            updateOffset({columnIndex: i, dx, dy, maxX, maxY});
        })
    }, [columns, updateOffset])

    const {ref: resizerRef, width} = useResizeDetector();

    let [colWidthData, updateColWidths] = useReducer(
        reduceColWidths,
        columns.map((c, idx) => ({
            key: c.key || `_idx${idx}`,
            width: c.preferredWidth || c.minWidth
        }))
    );
    const colWidths = useMemo(() => {
        const widthsByKey = {};
        for (const {key, width} of colWidthData) {
            widthsByKey[key] = width;
        }
        return columns.map((col, idx) => {
            return widthsByKey[col.key || `_idx${idx}`] || 0
        });
    }, [colWidthData, columns]);

    useEffect(() => {
        updateColWidths({
            action: 'resize',
            width: width,
            columns: columns
        })
    }, [width, columns]);

    const columnResizeStatusRef = useRef();

    let onMouseMove, onMouseUp;
    onMouseMove = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const dif = ev.clientX - columnResizeStatusRef.current.x;
            if (dif) {
                updateColWidths({
                    action: 'colsize',
                    delta: dif,
                    columns: columns,
                    columnIndex: columnResizeStatusRef.current.columnIndex
                });
            }

            columnResizeStatusRef.current = {
                x: ev.clientX,
                y: ev.clientY,
                columnIndex: columnResizeStatusRef.current.columnIndex
            };

        },
        [columnResizeStatusRef, updateColWidths, columns]
    );

    onMouseUp = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const dif = ev.clientX - columnResizeStatusRef.current.x;
            if (dif !== 0) {
                updateColWidths({
                    action: 'colsize',
                    delta: dif,
                    columns: columns,
                    columnIndex: columnResizeStatusRef.current.columnIndex
                });
            }

            columnResizeStatusRef.current = null;

            window.removeEventListener('mousemove', onMouseMove, true);
            window.removeEventListener('mouseup', onMouseUp, true);
        },
        [onMouseMove, onMouseUp, columnResizeStatusRef, updateColWidths, columns]
    );

    const onMouseDown = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const columnIndex = parseInt(ev.target.dataset.columnIndex)
            columnResizeStatusRef.current = {x: ev.clientX, y: ev.clientY, columnIndex};

            window.addEventListener('mousemove', onMouseMove, true);
            window.addEventListener('mouseup', onMouseUp, true);
        },
        [onMouseMove, onMouseUp, columnResizeStatusRef]
    );

    const unmanagedSelectionPair = useReducer(reduceSelection, []);
    const [selection, updateSelection] = (typeof(managedSelection) === 'undefined')
        ? unmanagedSelectionPair
        : [managedSelection, updateManagedSelection];

    const unmanagedSortPair = useReducer((oldSort, field) => {
        if (oldSort === field) {
            return '-' + field;
        } else {
            return field;
        }
    });
    const [sortField, updateSortField] = (typeof(managedSortField) === 'undefined')
        ? unmanagedSortPair
        : [managedSortField, updateManagedSortField];


    const swizzle = useMemo(() => {
        if (precomputedSwizzle) return precomputedSwizzle;

        const allRows = [];
        for (let i = 0; i < rows || 0; ++i) {
            allRows.push(i);
        }

        if (sortField) {
            const [reverse, fieldKey] = sortField[0] === '-' 
                ? [true, sortField.substring(1)] 
                : [false, sortField];

            const sortColumn = columns.filter((col, idx) => (col.key || `_idx${idx}`) === fieldKey)[0];
            if (sortColumn && sortColumn.data) {
                return makeSortedTableSwizzle(sortColumn.data, filter, allRows, reverse)
            }
        }

        // Fallback for no sortField OR couldn't-find-column.
        if (filter) {
            return allRows.filter((s) => filter.has(s));
        } else {
            return allRows;
        }
    }, [columns, rows, sortField, precomputedSwizzle, filter]);

    if (!height) height = swizzle.length * cellHeight;
    if (maxHeight && height > maxHeight) height = maxHeight;

    const onClick = useCallback((ev) => {
        if (updateSelection) {
            updateSelection({
                op: (ev.ctrlKey || ev.metaKey) 
                    ? 'toggle'
                    : ev.shiftKey
                      ? 'extend'
                      : 'set', 
                item: ev.item,
                column: ev.column,
                swizzle: ev.swizzle
            })
        }
    }, [updateSelection]);

    useEffect(() => {
        const length  = swizzle.length;
        updateOffset({dx: 0, dy: 0, maxY: Math.max(0, length * cellHeight - height)})
    }, [swizzle, updateOffset, height])

    const [sivTargetRow, setSivTargetRow] = useState(null);
    useImperativeHandle(ref, () => ({
        scrollIntoView: (rowIndex) => {
            setSivTargetRow(rowIndex);
        }
    }), [setSivTargetRow]);
    useEffect(() => {
        if (sivTargetRow !== null) {
            let row = sivTargetRow;
            if (swizzle) row = swizzle.indexOf(row);
            if (row >= 0) {
                const pos = row * cellHeight;
                if (pos > height-cellHeight-yOffset) {
                    updateOffset({dy: -yOffset - pos + height - cellHeight, maxY: (swizzle ? swizzle.length : columns[0].data.length) * cellHeight - height});
                } else if (pos < -yOffset) {
                    updateOffset({dy: -yOffset - pos, maxY: (swizzle ? swizzle.length : columns[0].data.length) * cellHeight - height});
                }
            }
            setSivTargetRow(null);
        }
    }, [sivTargetRow, setSivTargetRow, swizzle, updateOffset, yOffset]);

    const [showFilterUI, setShowFilterUI] = useState();
    let filterUiPos = 0;
    {
        let pos = 0;
        columns.forEach((column, index) => {
             const key = column.key || `_idx${index}`;
             if (key === showFilterUI) {
                 filterUiPos = pos + 10 - (Math.max(0, 240 - colWidths[index])/2);
                 filterUiPos = Math.max(10, filterUiPos);
                 filterUiPos = Math.min(width - 220, filterUiPos);
             }
             pos = pos + 8 + colWidths[index];
        })
    }

    const [showFormatUI, setShowFormatUI] = useState();
        let formatColumnPos = 0;
    {
        let pos = 0;
        columns.forEach((column, index) => {
             const key = column.key || `_idx${index}`;
             if (key === showFormatUI) {
                 formatColumnPos = pos + colWidths[index]/2;
             }
             pos = pos + 8 + colWidths[index];
        })
    }

    const updateFilterValue = useCallback((ev) => {
        if (updateTableFilters) {
            updateTableFilters({[showFilterUI]: ev.target.value ? ev.target.value : undefined});
        }
    }, [showFilterUI, updateTableFilters]);

    const setFilterSpecial = useCallback((ev) => {
        const special = ev.target.value;
        if (updateTableFilters) {
            updateTableFilters({[showFilterUI]: special ? {special} : ''});
        }
    }, [showFilterUI, updateTableFilters]);

    let topColumnHeight = 52;
    if (isSequenceLogoVisible) topColumnHeight += 73;
    if (isHeatmapVisible) topColumnHeight += 306;

    const showFilterUIValue = showFilterUI ? tableFilters[showFilterUI] : undefined;

    const headerDragRef = useRef({});
    const [headerDragLabel, setHeaderDragLabel] = useState(null);
    const [headerDragPosition, setHeaderDragPosition] = useState(null);
    const [headerDropIndex, setHeaderDropIndex] = useState(null);

    const tableRef = useRef();

    let onHeaderDragMove, onHeaderMouseUp;
    onHeaderDragMove = useCallback((ev) => {
        if (!headerDragRef.current.active && Math.abs(ev.clientX - headerDragRef.current.x) > 5) {
            headerDragRef.current.active = true;
            const col = columnRef.current[headerDragRef.current.columnIndex];
            setHeaderDragLabel(col.displayName || col.name);
        }

        headerDragRef.current.originX = tableRef.current.getBoundingClientRect().x
        setHeaderDragPosition(ev.clientX);


        let newIndex = -1;
        if (headerDragRef.current.active) {
            const pos = ev.clientX - headerDragRef.current.originX;
            let tot = 4;
            for (let i = 0; i < headerDragRef.current.colWidths.length; ++i) {
                tot += headerDragRef.current.colWidths[i] + 8;
                if (pos <= tot) {
                    newIndex = i;
                    break;
                }
            }
            if (newIndex < 0) newIndex = headerDragRef.current.colWidths.length;  
            const oldIndex = headerDragRef.current.columnIndex;
            const valid = checkColumnMove ? checkColumnMove(oldIndex, newIndex) : false;

            setHeaderDropIndex(valid ? newIndex : -1);
        }
    }, [checkColumnMove]);

    onHeaderMouseUp = useCallback((ev) => {
        setHeaderDragLabel(null);
        setHeaderDropIndex(null);

        window.removeEventListener('mousemove', onHeaderDragMove, true);
        window.removeEventListener('mouseup', onHeaderMouseUp, true);

        let newIndex = -1;
        if (headerDragRef.current.active) {
            const pos = ev.clientX - headerDragRef.current.originX;
            let tot = 4;
            for (let i = 0; i < headerDragRef.current.colWidths.length; ++i) {
                tot += headerDragRef.current.colWidths[i] + 8;
                if (pos <= tot) {
                    newIndex = i;
                    break;
                }
            }
            if (newIndex < 0) newIndex = headerDragRef.current.colWidths.length;  
            const oldIndex = headerDragRef.current.columnIndex;
            const valid = checkColumnMove ? checkColumnMove(oldIndex, newIndex) : false;

            if (valid) {
                doColumnMove(oldIndex, newIndex)
            }
        }
    }, [checkColumnMove, doColumnMove]);

    const onHeaderMouseDown = useCallback((ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const columnIndex = parseInt(ev.currentTarget.dataset.colidx);
        headerDragRef.current = {
            x: ev.clientX,
            y: ev.clientY,
            columnIndex,
            active: false,
            originX: tableRef.current.getBoundingClientRect().x,
            colWidths
        };

        window.addEventListener('mousemove', onHeaderDragMove, true);
        window.addEventListener('mouseup', onHeaderMouseUp, true);
    }, [colWidths]);

    return (
        <div ref={resizerRef}
             style={{
                 display: 'flex',
                 flexDirection: 'row',
                 width: '100%',
                 position: 'relative',
                 minHeight: height + 72,
                 cursor: headerDropIndex === -1 ? 'no-drop' : null
        }}>
            <div ref={tableRef} style={{width: 0, height: 0}} />

            <div style={{
                         background: 0 === headerDropIndex ? '#ff0000' : '#ffffff',
                         marginLeft: 0,
                         marginRight: 2, flex:  '0 0 2px',
                  }} />

            { columns.map(({
                type, data, residueNumbers, name, displayName, features=[], bgColours, onClick: onColClick, update, selectedColumns, updateSelectedColumns, 
                columnSwizzle, hiddenColumnMarkers, onHiddenColumnMarkerClick, selected, updateSelected, ...columnProps}, index) => 
            {
                const cc = [],
                      cw = colWidths[index];

                const key = columnProps.key || `_idx${index}`;

                let content = null;
                let topContent = null;
                let bottomContent = null;

                if (type === 'note') {
                    content = (
                        <NoteCol data={data}
                                 itemHeight={cellHeight}
                                 yOffset={yOffset}
                                 swizzle={swizzle}
                                 selection={selection}
                                 bgColours={bgColours}
                                 update={update}
                                 updateSelection={updateSelection}
                                 height={height} />
                    );
                } else if (type === 'rating') {
                    content = (
                        <RatingCol data={data}
                                 itemHeight={cellHeight}
                                 yOffset={yOffset}
                                 swizzle={swizzle}
                                 bgColours={bgColours}
                                 update={update}
                                 selection={selection}
                                 updateSelection={updateSelection}
                                 height={height} />
                    );
                } else if (type === 'status') {
                    content = (
                        <StatusCol data={data}
                                   itemHeight={cellHeight}
                                   yOffset={yOffset}
                                   swizzle={swizzle}
                                   bgColours={bgColours}
                                   update={update}
                                   selection={selection}
                                   updateSelection={updateSelection}
                                   height={height} />
                    )
                } else if (type === 'msa') {
                    content = (
                        <div style={{paddingRight: isHeatmapVisible ? 16 : 0}}>
                            <MSView alignment={data}
                                    xOffset={xOffsets[index]}
                                    yOffset={yOffset}
                                    updateOffset={updateOffsetForColumn[index]}
                                    selection={selection}
                                    selectedColumns={selectedColumns}
                                    onClick={onColClick || onClick}
                                    {...columnProps}
                                    {...otherProps}
                                    cellWidth={cellWidth}
                                    cellHeight={cellHeight}
                                    cellPaddingX={cellPaddingX}
                                    cellPaddingY={cellPaddingY}
                                    swizzle={swizzle}
                                    columnSwizzle={columnSwizzle}
                                    height={height}
                                    hiddenColumnMarkers={hiddenColumnMarkers} />
                        </div>
                    );

                    topContent = (
                        <div>
                            {(isSequenceLogoVisible) 
                                ? <div style={{paddingRight: isHeatmapVisible ? 16 : 0}}>
                                    <SequenceLogo
                                        alignment={data}
                                        filter={filter}
                                        xOffset={xOffsets[index]}
                                        yOffset={yOffset}
                                        systemFont={otherProps.systemFont}
                                        columnSwizzle={columnSwizzle}
                                        cellWidth={cellWidth}
                                    />
                                  </div>
                                : null
                            }
                            {(isHeatmapVisible) 
                                ? 
                                <HeatMap
                                    alignment={data}
                                    colName={key}
                                    colName2={name}
                                    xOffset={xOffsets[index]}
                                    heatmapDataObject={heatmapDataObject}
                                    heatmapDataScale={heatmapDataScale}
                                    relativeToWT={heatmapRelativeToWT}
                                    colorPalette={heatmapColorPalette}
                                    residueNumbers={ residueNumbers }
                                    updateSelection={ updateSelection }
                                    swizzle={ swizzle }
                                    columnSwizzle={columnSwizzle}
                                    cellWidth={cellWidth}
                                    updateOffset={updateOffsetForColumn[index]}
                                    stagedMutations={stagedMutations}
                                    setStagedMutations={setStagedMutations}
                                    isVariantSelectionActive={props.isVariantSelectionActive}
                                />
                                : null
                            }
                            <div style={{paddingRight: isHeatmapVisible ? 16 : 0}}>
                                <MSRuler 
                                    cellWidth={ cellWidth }
                                    residueNumbers={ residueNumbers }
                                    length={ data[0]?.seq?.length}
                                    xOffset={ xOffsets[index] }
                                    features={ features }
                                    selectedColumns={ selectedColumns }
                                    updateSelectedColumns={ updateSelectedColumns }
                                    columnSwizzle={columnSwizzle}
                                    hiddenColumnMarkers={hiddenColumnMarkers}
                                    onHiddenColumnMarkerClick={onHiddenColumnMarkerClick}
                                />
                                </div>
                        </div>
                    );
                        
                    bottomContent = (
                        <div style={{paddingRight: isHeatmapVisible ? 16 : 0}}>
                            <HScrollBar data={data}
                                        xOffset={xOffsets[index]}
                                        swizzle={swizzle}
                                        cellWidth={cellWidth}
                                        cellHeight={cellHeight}
                                        updateOffset={updateOffsetForColumn[index]}
                                        columnSwizzle={columnSwizzle} />
                        </div>
                    );
                } else {
                    content = (
                        <InfoCol data={data}
                                 itemHeight={cellHeight}
                                 yOffset={yOffset}
                                 swizzle={swizzle}
                                 selection={selection}
                                 bgColours={bgColours}
                                 update={update}
                                 updateSelection={updateSelection}
                                 height={height}
                                 format={tableFormats[key] || DEFAULT_FORMAT} />
                    );

                    if (type === 'selectable') {
                        topContent = (
                            <div style={{
                                    background: selected ? 'red' : undefined, 
                                    opacity: 0.3,
                                    position: 'relative',
                                    width: '100%',
                                    height: 20,
                                    overflow: 'hidden',
                                    cursor: 'pointer'
                                  }}
                                  onClick={updateSelected} />
                        );
                    }
                }

                if (topContent) {
                    topContent = (
                        <React.Fragment> 
                            <div onMouseDown={onHeaderMouseDown}
                                 data-colidx={index}
                                 style={{
                                    height: 32,
                                    borderBottom: '1px solid gray',
                                    userSelect: 'none'
                            }}>
                                {displayName ?? name}
                            </div>
                            { topContent }
                        </React.Fragment>
                    )
                } else {
                    topContent = (
                        <div style={{height: topColumnHeight}}
                             onMouseDown={onHeaderMouseDown}
                             data-colidx={index} >
                            <Tooltip title={displayName ?? name}>
                                <div style={{userSelect: 'none'}}>{ displayName ?? name }</div>
                            </Tooltip>
                            { type === 'numeric'
                                ? <Tooltip title="Number formatting">
                                    <div
                                        style={{display: 'inline-block', margin: 0}}
                                        onClick={(ev) => { setShowFormatUI(showFormatUI ? undefined : key) }}
                                    >
                                        <NumbersIcon viewBox="0 0 24 15" sx={{color: "#aaaaaa"}}/>
                                    </div>
                                </Tooltip>
                                : undefined }
                            <Tooltip title="Sort on this column">
                                <div
                                    style={{display: 'inline-block',  margin: 0}}
                                    onClick={(ev) => {updateSortField(key)}}
                                >
                                    <SortIcon
                                        colour={(('-' + key) === sortField) || (key === sortField) ? 'black': '#aaaaaa'}
                                        direction={('-'+key) === sortField ? 'down' : 'up'}
                                    />
                                </div>
                            </Tooltip>
                            { updateTableFilters ? 
                                <Tooltip title="Filter this column">
                                    <div 
                                        style={{display: 'inline-block', margin: 0}}
                                        onClick={(ev) => { setShowFilterUI(showFilterUI ? undefined : key) }}
                                    >
                                        <FilterIcon colour={showFilterUI === key ? 'blue' : (tableFilters[key] ? 'black' : '#aaaaaa')}/>
                                    </div>
                                </Tooltip>
                                : null }
                            
                        </div>
                    );
                }

                if (bottomContent) {
                    //
                } else {
                    //
                }

                cc.push(
                    <div key={index}
                         style={{
                            flex: `1 0 ${cw}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                    }}>
                        <div style={{
                            background: '#dddddd',
                            flex: `0 0 40px`,
                            whiteSpace: 'nowrap'
                        }} >
                            { topContent }
                        </div>
                        { content }
                        <div style={{
                            background: '#dddddd',
                            flex: `0 0 20px`,
                            whiteSpace: 'nowrap'
                        }}>
                            { bottomContent }
                        </div>
                    </div>
                );

                if (index < columns.length - 1) {
                    cc.push(
                        <div key={'c' + index}
                             style={{
                                     cursor: 'col-resize',
                                     background: index + 1 === headerDropIndex ? '#ff0000' : '#666666',
                                     borderColor: 'white',
                                     borderLeft: '2px solid white',
                                     borderRight: '2px solid white',
                                     flex:  '0 0 2px',
                              }}
                              data-column-index={index}
                              onMouseDown={onMouseDown} />
                    );
                }

                return (
                    <React.Fragment key={index}>
                        { cc }
                    </React.Fragment>
                )
            } ) }
            <div style={{
                         background: columns.length === headerDropIndex ? '#ff0000' : '#dddddd',
                         marginLeft: 0,
                         marginRight: 0, flex:  '0 0 2px',
                  }} />
            <div style={{
                    flex: `0 0 20px`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
            }}>
                <div style={{
                    background: '#dddddd',
                    flex: `0 0 ${52 + (isSequenceLogoVisible ? 70 : 0) + (isHeatmapVisible ? 300 : 0)}px`,
                    whiteSpace: 'nowrap'
                }} >

                </div>
                <VScrollBar height={height}
                            cellHeight={cellHeight}
                            yOffset={yOffset}
                            swizzle={swizzle}
                            updateOffset={updateOffset} />
                <div style={{
                    background: '#dddddd',
                    flex: `0 0 20px`,
                    whiteSpace: 'nowrap'
                }}>
                </div>
            </div>
            
            { showFilterUI 
                ? <div style={{
                        position: 'absolute',
                        width: 200,
                        left: filterUiPos,
                        top: 40,
                        //height: 65,
                        background: 'white',
                        border: '2px solid gray',
                        padding: '5px'
                    }}>
                        <select value={tableFilters[showFilterUI]?.special || ''}
                                onChange={setFilterSpecial} >
                            <option value="">Filter...</option>
                            <option value="notnull">Not empty</option>
                            <option value="null">Empty</option>
                        </select>
                        <input type="text"
                               onChange={ updateFilterValue } 
                               placeholder="E.g. 'EGFR', '>3', or '>3; <6'"
                               value={ showFilterUIValue && !(showFilterUIValue?.special) ? showFilterUIValue : '' } />
                        <button onClick={() => setShowFilterUI(undefined)}>Done</button>
                        <button onClick={() => updateTableFilters({[showFilterUI]: undefined})}>Clear</button>
                  </div>
                : null }

            { showFormatUI
                ? <div style={{
                        position: 'absolute',
                        width: 150,
                        left: formatColumnPos-120,
                        top: 40,
                        //height: 65,
                        background: 'white',
                        border: '2px solid gray',
                        padding: '5px'
                    }}>
                        <TextField
                            fullWidth
                            value={(tableFormats || {})[showFormatUI]?.sigfig ?? 3}
                            label="Significant figures"
                            onChange={(ev) => updateTableFormats({[showFormatUI]: {sigfig: parseInt(ev.target.value)}})}
                            inputProps={{
                                step: 1,
                                min: 1,
                                max: 10,
                                type: 'number',
                            }}
                        />
                    </div>
                : undefined }

            { headerDragLabel
              ? <div style={{
                     position: 'absolute',
                     top: 50,
                     left: headerDragPosition - headerDragRef.current.originX,
                     background: '#dddddd',
                     padding: '1rem',
                     borderRadius: '0.5rem'

                }}>
                    { headerDragLabel }
                </div>
              : null }



        </div>
    );
}

export default forwardRef(MSTable);


export function makeSortedTableSwizzle(columnData, filter, rows, reverse) {
    let stringCount = 0,
        numCount = 0,
        emptyCount = 0;

    for (const d of columnData) {
        if (d === undefined || d === null || d === '') {
            ++emptyCount;
            continue;
        }
        const t = typeof(d);
        if (t === 'string') ++stringCount;
        if (t === 'number') ++numCount;
    }

    const sortAsText = (stringCount > 0);

    const sortData = rows.map((v, idx) => {return {v: columnData[idx], idx: idx}});
    sortData.sort((a, b) => {
        let d;
        if (sortAsText) {
            const av = typeof(a.v) === 'string' ? a.v : (''+a.v),
                  bv = typeof(b.v) === 'string' ? b.v : (''+b.v);
            d = av.localeCompare(bv);
        } else {
            d = parseFloat(a.v||0) - parseFloat(b.v||0);
        }
        if (!d) d=a.idx-b.idx;
        if (reverse) d=-d;
        return d;
    })

    let s = sortData.map(({idx}) => idx);
    if (filter) {
        s = s.filter((s) => filter.has(s));
    }
    return s;
}