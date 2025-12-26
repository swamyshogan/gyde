import React, { useState, useRef, useCallback, useMemo, forwardRef } from 'react';

import { Button } from "@mui/material";
import { TableChart, QueryStats, FormatListBulleted, Panorama, Category, Checklist,
    Share as Restraint } from "@mui/icons-material";

import structureIcon from "./images/structureIcon.png";
import abIcon from "./images/Y1.png";


const getStyle = (isEditable, isHalfWidth=false) => {
    return {
        display: 'flex',
        flexDirection: 'column',
        textTransform: 'none',
        backgroundColor: isEditable ? '#4f9de8' : 'auto',
        color: 'white',
        fontSize: '10px',
        maxWidth: isHalfWidth ? '1.5rem' : '3.2rem',
        minWidth: isHalfWidth ? '1.5rem' : '3.2rem',
        paddingLeft: '0px',
        paddingRight: '0px',

        ':hover': {
            backgroundColor: '#4f9de8',
        }
    }
}

const TearoffButton = forwardRef(({onClick, onDrag, children, ...more}, ref) => {
    const dragOriginRef = useRef();

    const mouseDown = useCallback((ev) => {
        dragOriginRef.current = [ev.clientX, ev.clientY];
    }, [dragOriginRef]);

    const mouseMove = useCallback((ev) => {
        if (!dragOriginRef.current) return;
        const [ox, oy] = dragOriginRef.current,
              dx = ev.clientX - ox,
              dy = ev.clientY - oy,
              distance = Math.sqrt(dx*dx + dy*dy);
        if (distance > 5) {
            dragOriginRef.current = undefined;
            if (onDrag) onDrag(ev);
        }
    }, [dragOriginRef]);

    const mouseUp = useCallback((ev) => {
        if (!dragOriginRef.current) return;
        dragOriginRef.current = undefined;
        if (onClick) onClick(ev);
    }, [dragOriginRef]);

    const mouseOut = useCallback((ev) => {
        dragOriginRef.current = undefined;
    }, [dragOriginRef]);

    return (
        <Button onMouseDown={mouseDown}
                onMouseMove={mouseMove}
                onMouseUp={mouseUp}
                onMouseLeave={mouseOut}
                ref={ref}
                {...more}>
            { children }
        </Button>
    )
});

function getButtonContent(shoppingCartSize) {
    return {
        'Sequences': <React.Fragment>
            <div>Sequence</div>
            <FormatListBulleted
                sx={{fontSize: '36px'}}
            />
        </React.Fragment>,

        'Structure': <React.Fragment>
            <div>Structure</div>
            <img src={structureIcon}
                 style={{pointerEvents: 'none'}}
                 alt=''
                 width={'36px'}
                 height={'36px'} />
        </React.Fragment>,

        'Data': <React.Fragment>
            <div>Data</div>
            <TableChart
                    sx={{fontSize: '36px'}}
                />
        </React.Fragment>,

        'Struct. Analysis': <React.Fragment>
            <div>Analysis&nbsp;res.</div>
            <Panorama
                    sx={{fontSize: '36px'}}
                />
        </React.Fragment>,

        'TAP': <React.Fragment>
            <div>TAP</div>
            <img
                    src={abIcon}
                    style={{pointerEvents: 'none'}}
                    alt=''
                    width={'36px'}
                    height={'36px'}
                />
        </React.Fragment>,

        'Plot': <React.Fragment>
            <div>Plot</div>
            <QueryStats
                    sx={{fontSize: '36px'}}
                />
        </React.Fragment>,

        'Frequency Analysis': <React.Fragment>
            <div>Frequency Analysis</div>
            <Category
                sx={{fontSize: '36px'}}
            />
        </React.Fragment>,

        'Shopping Cart': (
            <React.Fragment>
                <div>Picklist</div>
                <Checklist
                    sx={{fontSize: '36px'}}
                />
                <div style={{
                    position:'absolute',
                    bottom: 0,
                    right: 0,
                    background: '#e65572',
                    paddingLeft: '5px',
                    paddingRight: '5px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    borderRadius: '10px'
                }}>{shoppingCartSize}</div> 
            </React.Fragment>
        ),

        'Restraints': <React.Fragment>
            <div>Restraints</div>
            <Restraint
                sx={{fontSize: '36px'}}
            />
        </React.Fragment>
    }
}

const getMiniButtonContent = (shoppingCartSize) => {
    return {
        'Sequences': <React.Fragment>
            <FormatListBulleted
                sx={{fontSize: '20px'}}
            />
        </React.Fragment>,

        'Structure': <React.Fragment>
            <img src={structureIcon}
                 style={{pointerEvents: 'none'}}
                 alt=''
                 width={'20px'}
                 height={'20px'} />
        </React.Fragment>,

        'Data': <React.Fragment>
            <TableChart
                    sx={{fontSize: '20px'}}
                />
        </React.Fragment>,

        'Struct. Analysis': <React.Fragment>
            <Panorama
                    sx={{fontSize: '20px'}}
                />
        </React.Fragment>,

        'TAP': <React.Fragment>
            <img
                    src={abIcon}
                    style={{pointerEvents: 'none'}}
                    alt=''
                    width={'20px'}
                    height={'20x'}
                />
        </React.Fragment>,

        'Plot': <React.Fragment>
            <QueryStats
                    sx={{fontSize: '20px'}}
                />
        </React.Fragment>,

        'Frequency Analysis': <React.Fragment>
            <Category
                sx={{fontSize: '20px'}}
            />
        </React.Fragment>,

        'Shopping Cart': (
            <React.Fragment>
                <Checklist
                    sx={{fontSize: '20px'}}
                />
                <div style={{
                    position:'absolute',
                    bottom: 0,
                    right: 0,
                    background: '#e65572',
                    paddingLeft: '5px',
                    paddingRight: '5px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    borderRadius: '10px',
                    fontSize: '7px'
                }}>{shoppingCartSize}</div>
            </React.Fragment>
        ),

        'Restraints': <React.Fragment>
            <Restraint
                sx={{fontSize: '20px'}}
            />
        </React.Fragment>,
    }
}

export default function Sidebar(props) {
    const {
        isAntibody, hasStructAnalysisSection, scrollToSequenceTable, scrollToStructure, 
        scrollToStructAnalysis, scrollToPlot, scrollToTAP, scrollToData, scrollToShoppingCart, 
        updateLayout,layoutDict, checkUpdateLayout, scrollToFrequencyAnalysis, hasFrequencyAnalysis,
        hasShoppingCart, shoppingCartSize, hasRestraints, scrollToRestraints
    } = props;
    const [isEditable, setIsEditable] = useState(false);
    const [dragging, setDragging] = useState();
    const [dragInsertionPoint, setDragInsertionPoint] = useState();
    const [[dragX, dragY], setDragLocation] = useState([-1, -1]);
    const sidebarRef = useRef();

    const sectionVisible = useMemo(() => ({
        'Sequences': true,
        'Structure': true,
        'Data': true,
        'Struct. Analysis': hasStructAnalysisSection,
        'TAP': isAntibody,
        'Plot': true,
        'Frequency Analysis': hasFrequencyAnalysis,
        'Shopping Cart': hasShoppingCart,
        'Restraints': hasRestraints
    }), [hasStructAnalysisSection, isAntibody, hasFrequencyAnalysis, hasShoppingCart]);

    const jumpers = {
        'Sequences': scrollToSequenceTable,
        'Structure': scrollToStructure,
        'Data': scrollToData,
        'Struct. Analysis': scrollToStructAnalysis,
        'TAP': scrollToTAP,
        'Plot': scrollToPlot,
        'Frequency Analysis': scrollToFrequencyAnalysis,
        'Shopping Cart': scrollToShoppingCart,
        'Restraints': scrollToRestraints
    };

    const elementRefs = useRef({});
    const currentLayoutRef = useRef();
    const dragRef = useRef();
    const finishDragRef = useRef();

    let insertRow, insertLeft, insertRight;
    if (dragInsertionPoint) {
        const [p, m] = dragInsertionPoint;
        if (m === 'left') {
            insertLeft = p;
        } else if (m === 'right') {
            insertRight = p;
        } else {
            insertRow = p;
        }
    }

    const dragMove = useCallback((ev) => {
        const bbox = sidebarRef.current.getBoundingClientRect();

        setDragLocation([
            clamp(bbox.left - 20, ev.clientX, bbox.right + 20),
            clamp(bbox.top - 20, ev.clientY, bbox.bottom + 20)
        ]);
        const gridLayout = currentLayoutRef.current;

        const rowTops = [];
        let intoRow = -1;
        for (const [name, el] of Object.entries(elementRefs.current)) {
            if (gridLayout[name].display === 'none') continue;
            const rect = elementRefs.current[name].getBoundingClientRect(),
                  row = ((gridLayout[name].gridRow/2)-1)|0
            if (ev.clientY > rect.top + 10 && ev.clientY < rect.bottom - 10) {
                intoRow = row;
            }
            rowTops[row] = rect.top;
        }

        let insert = rowTops.length;
        let mode = 'full';

        if (intoRow >= 0) {
            insert = intoRow;
            if (ev.clientX < 30) {
                mode = 'left';
            } else {
                mode = 'right';
            }
        } else {
            for (let i = 0; i < rowTops.length; ++i) {
                if (ev.clientY < rowTops[i] + 10) {
                    insert = i;
                    break;
                }
            }
        }

        if (checkUpdateLayout(dragRef.current, insert, mode)) {
            setDragInsertionPoint([insert, mode]);
        } else {
            setDragInsertionPoint(undefined);
        }

    });

    dragRef.current = dragging;
    finishDragRef.current = () => {
        if (dragInsertionPoint) {
            updateLayout(dragging, ...(dragInsertionPoint || []));
        }
    }

    const dragUp = useCallback((ev) => {
        finishDragRef.current();
        setDragging(undefined);

        window.removeEventListener('mousemove', dragMove, false);
        window.removeEventListener('mouseup', dragUp, false);
    });


    function startDrag(type, ev) {
        setDragging(type);
        dragRef.current = type;
        dragMove(ev);
        window.addEventListener('mousemove', dragMove, false);
        window.addEventListener('mouseup', dragUp, false);
    }

    const buttonContent = useMemo(() => getButtonContent(shoppingCartSize), [shoppingCartSize]);
    const miniButtonContent = useMemo(() => getMiniButtonContent(shoppingCartSize), [shoppingCartSize]);

    const gridLayout = {};
    let rows = -1;
    {
        let row = 1, col = 1;
        for (const key of Object.keys(layoutDict)) {
            if (!buttonContent[key] || !sectionVisible[key]) {
                gridLayout[key] = {display: 'none'}
                continue;
            }
            const cols = layoutDict[key].isHalfWidth ? 1 : 2;
            if (col + cols > 3)  {
                ++row; col = 1;
            }
            
            gridLayout[key] = {
                gridRow: row*2,
                gridColumnStart: 1 + col,
                gridColumnEnd: 1 + col + cols 
            }
            col += cols;
        }
        rows = row;
    }
    currentLayoutRef.current = gridLayout;

    const dividers = [],
          sideIndicators = [];
    for (let i = 0; i <= rows; ++i) {
        dividers.push(
            <div key={i}
                 style={{
                    background: '#a1c48f',
                    borderRadius: '3px',
                    height: '6px',
                    gridRow: i*2+1,
                    gridColumnStart: 1,
                    gridColumnEnd: 5,
                    visibility: dragging && (insertRow === i) ? undefined : 'hidden'
            }} />
        )
    }

    for (let i = 1; i <= rows; ++i) {
        sideIndicators.push(
            <div key={`l${i}`}
                 style={{
                    background: '#a1c48f',
                    borderRadius: '3px',
                    gridRow: i*2,
                    gridColumnStart: 1,
                    gridColumnEnd: 2,
                    visibility: dragging && (insertLeft === i-1) ? undefined : 'hidden'
            }} />,
            <div key={`r${i}`}
                 style={{
                    background: '#a1c48f',
                    borderRadius: '3px',
                    gridRow: i*2,
                    gridColumnStart: 4,
                    gridColumnEnd: 5,
                    visibility: dragging && (insertRight === i-1) ? undefined : 'hidden'
            }} />
        )
    }

    return (
        <React.Fragment>
            <div style={{
                display: dragging ? 'flex' : 'none',
                flexDirection: 'column',
                textTransform: 'none',
                textAlign: 'center',
                position: 'absolute',
                top: dragY - 20 + window.scrollY,
                left: Math.max(-20, Math.min(dragX, 80)) - 20 + window.scrollX,
                width: 50,
                height: 50,
                padding: 6,
                borderRadius: 5,
                background: '#153452',
                zIndex: 999,
                color: 'white',
                fontSize: '10px',
                opacity: 0.8
            }}>
                { buttonContent[dragging] }
            </div>

            <div
                ref={sidebarRef}
                style={{
                    position: 'fixed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: isEditable ? 'none' : '#153452',
                    maxWidth: '4.2rem',
                    color: '#ffffff',
                    top: '10vh',
                    gap: '0.5rem',
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem',
                    paddingLeft: '0.25rem',
                    paddingRight: '0.25rem',
                    borderTopRightRadius: '10px',
                    borderBottomRightRadius: '10px'
                }}
            >
                <div style={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: '6px repeat(2, minmax(0, 1fr)) 6px'
                }}>
                    { Object.entries(buttonContent).map(([wName, wButtonContent]) => (
                        <TearoffButton 
                            key={wName}
                            sx={{
                                ...getStyle(isEditable, layoutDict[wName].isHalfWidth),
                                ...gridLayout[wName]
                            }}
                            onClick={jumpers[wName]}
                            onDrag={startDrag.bind(null, wName)}
                            ref={(el) => {elementRefs.current[wName] = el}}
                        >
                            { layoutDict[wName].isHalfWidth ? miniButtonContent[wName] : wButtonContent }
                        </TearoffButton>
                    )) }

                    { dividers }

                    { sideIndicators }
                </div>
            </div>
        </React.Fragment>
    );
}

function clamp(min, x, max) {
    return Math.max(min, Math.min(x, max));
}