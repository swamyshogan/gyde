import React, {useCallback, useRef, useMemo, useLayoutEffect} from 'react';

import { useResizeDetector } from 'react-resize-detector';

export function VScrollBar({
    yOffset=0,
    height=500,
    cellHeight=14,
    swizzle=null,
    updateOffset=null
}) {
    const length = swizzle?.length || 0;

    const trackLength = height - 10,
          thumbHeight = Math.min(1.0, Math.max(0.1, (height/cellHeight) / length)) * trackLength,
          thumbPos = (-yOffset/cellHeight)/(length-(height/cellHeight)) * (trackLength-thumbHeight);

    const scrollBarTrackRef = useRef();
    const dragOriginRef = useRef({x: null, y: null, yOffset})
    dragOriginRef.current.yOffset = yOffset;
    dragOriginRef.current.trackLength = trackLength;
    dragOriginRef.current.thumbHeight = thumbHeight;
    dragOriginRef.current.thumbPos = thumbPos;
    dragOriginRef.current.length = length;
    dragOriginRef.current.cellHeight = cellHeight;
    dragOriginRef.current.height = height;

    let onMouseDown, onMouseUp, onMouseMove;

    onMouseMove = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const bbox = scrollBarTrackRef.current.getBoundingClientRect(),
                  barX = ev.clientX - bbox.x, barY = ev.clientY - bbox.y;

            const delta = barY - dragOriginRef.current.y;
            if (delta) {
                const scale = (dragOriginRef.current.trackLength-dragOriginRef.current.thumbHeight) / 
                              (dragOriginRef.current.length*dragOriginRef.current.cellHeight - dragOriginRef.current.height);
                
                if (scale) {
                    const offsetDelta = delta / scale;
                    if (updateOffset) {
                        updateOffset({dy: -offsetDelta, maxY: dragOriginRef.current.length * dragOriginRef.current.cellHeight - dragOriginRef.current.height})
                    }
                }
            }

            dragOriginRef.current.x = barX;
            dragOriginRef.current.y = barY;
        }, [updateOffset]
    );

    onMouseUp = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            window.removeEventListener('mousemove', onMouseMove, false);
            window.removeEventListener('mouseup', onMouseUp, false);
        },
        [onMouseMove]
    );

    onMouseDown = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const bbox = scrollBarTrackRef.current.getBoundingClientRect(),
                  barX = ev.clientX - bbox.x, barY = ev.clientY - bbox.y;

            dragOriginRef.current.x = barX;
            dragOriginRef.current.y = barY;

            window.addEventListener('mousemove', onMouseMove, false);
            window.addEventListener('mouseup', onMouseUp, false);
        },
        [onMouseUp, onMouseMove]
    );

    return (
        <div style={{
             position: 'relative',
             width: '100%',
             height: '100%',
             background: '#dddddd'}}
             ref={scrollBarTrackRef}
        >
            <div style={{
                position: 'absolute',
                top: 5 + (Number.isNaN(thumbPos) ? 0 : thumbPos),
                left: '5px',
                width: '10px',
                height: Number.isNaN(thumbHeight) ? 0 :thumbHeight,
                background: 'darkgray',
                borderRadius: 5,
            }}
            onMouseDown={onMouseDown} />
        </div>
    );
}

export function HScrollBar({
    data = [],
    xOffset=0,
    cellWidth=10,
    swizzle=null,
    updateOffset=null,
    columnSwizzle=null
}) {
    // Ref that _we_ use to access scrollbar-track.
    const scrollBarTrackRef = useRef();

    // Special "ref" that react-resize-detector uses to access scrollbar-track.
    // in recent react-resize-detector, this is actually a function, not a 
    // "useref" object
    const {ref: scrollBarTrackRefRD, width} = useResizeDetector({
        refreshMode: 'throttle',
        refreshRate: 40
    });

    // Make our own callback which fans out the track reference to both our own
    // ref object and the react-resize-detector callback.
    const scrollBarTrackRefCB = useCallback((track) => {
        scrollBarTrackRef.current = track;
        scrollBarTrackRefRD(track);
    }, [scrollBarTrackRef, scrollBarTrackRefRD]);

    const length = useMemo(() => {
        if (columnSwizzle) return columnSwizzle.length;

        const swizzledAlignment = swizzle
            ? swizzle.map((i) => data[i] || {})
            : data;
        return swizzledAlignment.map((a) => typeof(a.seq) === 'string' ? a.seq.length : 0).reduce((a, b) => Math.max(a, b), 0);
    }, [data, swizzle, columnSwizzle]);

    const trackLength = width - 10,
          thumbWidth = Math.min(1.0, Math.max(0.1, (width/cellWidth) / length)) * trackLength,
          thumbPos = (-xOffset/cellWidth)/(length-(width/cellWidth)) * (trackLength-thumbWidth);

    const dragOriginRef = useRef({x: null, y: null, xOffset})
    dragOriginRef.current.xOffset = xOffset;
    dragOriginRef.current.trackLength = trackLength;
    dragOriginRef.current.thumbWidth = thumbWidth;
    dragOriginRef.current.thumbPos = thumbPos;
    dragOriginRef.current.length = length;
    dragOriginRef.current.cellWidth = cellWidth;
    dragOriginRef.current.width = width;

    let onMouseDown, onMouseUp, onMouseMove;

    onMouseMove = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const bbox = scrollBarTrackRef.current.getBoundingClientRect(),
                  barX = ev.clientX - bbox.x, barY = ev.clientY - bbox.y;

            const delta = barX - dragOriginRef.current.x;
            if (delta) {
                const offsetDelta = delta / (dragOriginRef.current.trackLength-dragOriginRef.current.thumbWidth) * (dragOriginRef.current.length*dragOriginRef.current.cellWidth - dragOriginRef.current.width);
                if (updateOffset) {
                    updateOffset(-offsetDelta, 0, dragOriginRef.current.length * dragOriginRef.current.cellWidth - dragOriginRef.current.width, -1);
                }
            }

            dragOriginRef.current.x = barX;
            dragOriginRef.current.y = barY;
        }, [updateOffset]
    );

    onMouseUp = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            window.removeEventListener('mousemove', onMouseMove, false);
            window.removeEventListener('mouseup', onMouseUp, false);
        },
        [onMouseMove]
    );

    onMouseDown = useCallback(
        (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const bbox = scrollBarTrackRef.current.getBoundingClientRect(),
                  barX = ev.clientX - bbox.x, barY = ev.clientY - bbox.y;

            dragOriginRef.current.x = barX;
            dragOriginRef.current.y = barY;

            window.addEventListener('mousemove', onMouseMove, false);
            window.addEventListener('mouseup', onMouseUp, false);
        },
        [onMouseUp, onMouseMove]
    );

    useLayoutEffect(() => {
        updateOffset(0, 0, dragOriginRef.current.length * dragOriginRef.current.cellWidth - (dragOriginRef.current.width || 0), -1);
    }, [columnSwizzle, data])

    return (
        <div style={{
             position: 'relative',
             width: '100%',
             height: '100%',
             background: '#dddddd'}}
             ref={scrollBarTrackRefCB}
        >
            <div style={{
                position: 'absolute',
                top: 5,
                left: 5 + (Number.isNaN(thumbPos) ? 0 : thumbPos),
                height: '10px',
                width: Number.isNaN(thumbWidth) ? 0 : thumbWidth,
                background: 'darkgray',
                borderRadius: 5,
            }}
            onMouseDown={onMouseDown} />
        </div>
    );
}