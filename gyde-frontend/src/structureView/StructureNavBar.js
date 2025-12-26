import React, { useState, useCallback, useMemo } from "react";
import {createPortal} from 'react-dom';
import { saveAs } from "file-saver";
import {
    Button, CircularProgress, Menu, MenuItem, Stack, TextField, Radio, ListItemText, Checkbox,
    FormControlLabel
} from "@mui/material";
import { ArrowDropDown, Download, ArrowRight } from "@mui/icons-material";

import { PdbUploadButton } from './PdbUploadButton';
import { navbarButtonCSS } from "../NavBar";
import GMenu, { GMenuItem, GDropDown, GSubMenu } from '../utils/GMenu';
import { getStructureBlob, mimeToStructureType } from "./utils";

import {useSlivka} from '../czekolada/lib';

export const StructureNavBar = (props) => {
    // selection mode control
    const [selectByAnchor, setSelectByAnchor] = useState(null);
    const selectByOnClick = useCallback((ev) => {
        setSelectByAnchor(ev.currentTarget);
    }, []);
    const selectByOnClose = useCallback((ev) => {
        setSelectByAnchor(null);
    }, []);

    // structure prediction menu
    const [structurePredictionAnchor, setStructurePredictionAnchor] = useState(null);

    const structurePredictionMenuOnClick = (event) => {
        setStructurePredictionAnchor(event.currentTarget);
    }

    const structurePredictionMenuOnClose = () => {
        setStructurePredictionAnchor(null);
    }

    const buttonStyle = {
        ...navbarButtonCSS, 
        fontSize: props.compact ? '10px' : '14px',
        padding: props.compact ? '1px' : null,
        borderRadius: props.compact ? '5px' : '10px'
    }

    const predictionButtonStyle = {
        ...navbarButtonCSS, 
        fontSize: props.sequenceCompact ? '10px' : '14px',
        padding: props.sequenceCompact ? '1px' : null,
        borderRadius: props.sequenceCompact ? '5px' : '10px'
    }

    return (
        <React.Fragment>
            <Stack direction='row' 
                sx={{
                    alignItems: 'stretch',
                    gap: props.compact ? '0px' : '5px',
                    mb: '5px'
                }}
            >
                <GDropDown name={(props.hasReference ? props.structureSequence : null) === 'ref' ? 'Reference sequence' : 'Selected sequence'}
                           id="seq-select"
                           compact={props.compact}>

                    <GMenuItem onClick={() => {props.setStructureSequence('selected')}}>Selected sequence</GMenuItem>                
                    { props.hasReference 
                        ? <GMenuItem onClick={() => {props.setStructureSequence('ref')}}>Reference sequence</GMenuItem> 
                        : undefined }
                </GDropDown>
                <StructureSelectionMenu
                    compact={props.compact}
                    
                    selection={props.selection}
                    availStructureKeys={props.availStructureKeys}
                    visibleStructures={props.visibleStructures}
                    toggleStructureVisibility={props.toggleStructureVisibility}
                />
                <ColorByMenu
                    compact={props.compact}

                    setColorScheme={props.setStructureColorScheme}
                    colorScheme={props.colorScheme}
                    isHeatmapVisible={props.isHeatmapVisible}
                    isAntibody={props.isAntibody}
                    hasPLDDT={props.hasPLDDT}
                />
                <Button
                    sx={buttonStyle}
                    onClick={(ev) => {
                        props.setAutoSuperpose(!props.autoSuperpose)
                    }}
                >
                    <Checkbox
                        sx={{padding: '0px'}}
                        checked={!!props.autoSuperpose}
                    />
                    Auto-superpose
                </Button>
                <Button
                    disabled={!props.structureInfos || props.structureInfos.length === 0}
                    sx={buttonStyle}
                    onClick={async () => {
                        for (const si of props.structureInfos) {
                            const structureBlob = await getStructureBlob(si.url);
                            let format = mimeToStructureType(si.type || structureBlob.type);
                            if (format === 'mmcif') format='cif';
                            saveAs(structureBlob, `${si.rowName}_${si.structureKey}.${format}`)
                        }
                    }}
                >
                    Download structures
                    <Download sx={{fontSize: props.compact ? '16px' : 'auto'}}/>
                </Button>
                <PdbUploadButton
                    columnarData={props.columnarData}
                    selection={props.selection}
                    structureKeys={props.structureKeys}
                    addValueToNewStructureColumn={props.addValueToNewStructureColumn}
                    setVisibleStructures={props.setVisibleStructures}
                    style={buttonStyle}
                    compact={props.compact}
                />
            </Stack>
            { props.primaryNavBarExtras.current
              ? createPortal(

                    <StructurePredictionMenu
                        anchor={structurePredictionAnchor}
                        onClose={structurePredictionMenuOnClose}
                        onShow={structurePredictionMenuOnClick}
                        style={predictionButtonStyle}

                        isAntibody={props.isAntibody}
                        predictionKey={props.predictionKey}
                        structureInfos={props.structureInfos}
                        predictionsPending={props.predictionsPending}
                        predictionsStatus={props.predictionsStatus}
                        predictionMethods={props.predictionMethods}
                    />,
                    props.primaryNavBarExtras.current
                )
              : undefined }
        </React.Fragment>
    );
}

const StructureSelectionMenu = (props) => {
    const {
        compact, availStructureKeys, visibleStructures, toggleStructureVisibility, selection
    } = props;

    return (
        <GDropDown name="Show structures"
                   id="structure-select-menu"
                   compact={compact}>
            { availStructureKeys.map((k) => (
                <GMenuItem
                    onClick={() => toggleStructureVisibility(k)}
                    noClose
                    key={k} 
                    value={k}
                >
                    <Checkbox checked={visibleStructures.indexOf(k) > -1}/>
                    <ListItemText>{k}</ListItemText>
                </GMenuItem>
            )) }
        </GDropDown>
    )
}

const ColorByMenu = (props) => {
    const {
        compact, colorScheme, setColorScheme, isHeatmapVisible, isAntibody, hasPLDDT
    } = props;

    return (
        <GDropDown name={`Color by: ${colorScheme || '-'}`}
                   id="structure-color-by-menu"
                   compact={compact}>
            <GMenuItem
                value='Chain'
                onClick={() => {
                    setColorScheme('chain');
                }}>
                Chain
            </GMenuItem>
            <GMenuItem
                value='CDRs'
                disabled={!isAntibody}
                onClick={() => {
                    setColorScheme('CDRs');
                }}>
                CDRs
            </GMenuItem>
            <GMenuItem value="pLDDT"
                      disabled={!hasPLDDT}
                      onClick={() => {
                          setColorScheme('pLDDT');
                      }}>
                pLDDT
            </GMenuItem>
            <GMenuItem value="Diffs to reference"
                       onClick={() => {setColorScheme('Diffs to reference')}}>
                Diffs to reference
            </GMenuItem>
            <HeatmapMetricMenu
                isHeatmapVisible={isHeatmapVisible}
                setColorScheme={setColorScheme}
                colorScheme={colorScheme}
            />
        </GDropDown>
    )
}


const HeatmapMetricMenu = (props) => {
    const {
        setColorScheme, colorScheme, isHeatmapVisible, 
    } = props;

    return (
        <GSubMenu disabled={!isHeatmapVisible}
                  id="coloring-metrics-menu"
                  name="Heatmap">
            { ['average', 'variance', 'max', 'min'].map((metric) => (
                <GMenuItem
                    key={metric}
                    noClose
                    onClick={() => {
                        setColorScheme('heatmap ' + metric);
                    }}
                >
                    <Radio checked={colorScheme.includes(metric)}/>
                    <ListItemText>{metric}</ListItemText>
                </GMenuItem>
            ))}
        </GSubMenu>
    )
}

const StructurePredictionMenu = (props) => {
    const {
        anchor, onShow, onClose, runABuilder, isAntibody, predictionPending, predictionKey,
        style, structureInfos, predictionsPending, predictionsStatus, predictionMethods
    } = props;
    const isOpen = !!anchor;

    const [groupOpen, setGroupOpen] = useState();
    const [groupMenuAnchor, setGroupMenuAnchor] = useState();
    const slivkaService = useSlivka();
    const services = new Set((slivkaService.services || []).map((s) => s.id));

    function methodStatus(methodKey) {
        const methodStatus = predictionsStatus[methodKey] || {},
              methodPending = predictionsPending[methodKey] || {};

        const status = structureInfos.map(({predictionKey}) => methodStatus[predictionKey]).filter((a) => a)[0];
        const pending = structureInfos.map(({predictionKey}) => methodPending[predictionKey]).reduce((a, b) => a || b, false);

        return [pending, status];
    }

    const hasPredictableAntibodies = structureInfos?.some((si) => si.hc && si.lc),
          hasPredictableVHH = structureInfos?.some((si) => si.hc && !si.lc);

    const preds = predictionMethods.
        filter((pred) => (!pred.gateOnService || services.has(pred.gateOnService)) && pred.enabled).
        map((pred) => {
            const [pending, status] = methodStatus(pred.key);

            let available = (structureInfos || []).filter((si) => si.proteinSequences.length > 0).length > 0;
            if (typeof(pred.available) !== 'undefined') {
                if (pred.available === true) {
                    // noop
                } else if (pred.available === 'antibody') {
                    available = available && isAntibody && hasPredictableAntibodies
                } else if (pred.available === 'vhh') {
                    available = available && isAntibody && hasPredictableVHH
                } else if (pred.available === 'molecules') {
                    available = (structureInfos || []).filter((si) => si.sequences.length > 0 || si.ligands?.length > 0).length > 0;
                } else {
                    available = false;
                }
            }

            return {
                enabled: true,
                ...pred,
                pending,
                status,
                available
            }

        });

    const anyPending = preds.some((p) => p.pending);

    const {defaultPreds, groupPreds} = useMemo(() => {
        const defaultPreds = [];
        const groupPreds = {};

        for (const p of preds) {
            const g = p.group;
            if (g) {
                if (!groupPreds[g]) groupPreds[g] = [];
                groupPreds[g].push(p);
            } else {
                defaultPreds.push(p);
            }
        }

        return {defaultPreds, groupPreds};
    }, [preds]);

    function predMenu(preds) {
        return preds.map(({name, callback, pending, status, available, enabled}, idx) => (
            <MenuItem key={name}
                      onClick={() => callback()}
                      disabled={predictionPending || pending || !available} >
                {name}
                { pending
                    ? <React.Fragment>&nbsp;<CircularProgress size={12} /></React.Fragment> 
                    : undefined }
                {status ? `[${status}]` : undefined}
            </MenuItem>
        ));
    }

    return (
        <React.Fragment>
            <Button
                sx={{...style, backgroundColor: 'primary.blue', color: 'white'}}
                disabled={defaultPreds.length === 0 && Object.keys(groupPreds || {}).length === 0}
                onClick={onShow}
            >
                Structure Prediction
                { anyPending 
                  ? <React.Fragment>&nbsp;<CircularProgress size={12} /></React.Fragment>
                  : undefined }
                <ArrowDropDown/>
            </Button>
            <Menu
                id='structure-prediction-menu'
                open={isOpen}
                anchorEl={anchor}
                onClose={onClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >

                { predMenu(defaultPreds) }

                { Object.keys(groupPreds).map((g) => (
                    <div key={g} 
                         onMouseEnter={(ev) => {setGroupMenuAnchor(ev.currentTarget); setGroupOpen(g)}}
                         onMouseLeave={() => {setGroupOpen(undefined)}}>
                        <MenuItem style={{display: 'flex', justifyContent: 'space-between'}}>
                            {g}
                            <ArrowRight />
                        </MenuItem>
                        <Menu style={{pointerEvents: 'none'}}
                              slotProps={{paper: {sx: {pointerEvents: 'auto'}}}}
                              hideBackdrop
                              anchorEl={groupOpen ? groupMenuAnchor : undefined}
                              open={groupOpen === g}
                              onClose={() => setGroupOpen(undefined)}
                              anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                              transformOrigin={{vertical: 'top', horizontal: 'left'}}>
                            { predMenu(groupPreds[g]) }
                        </Menu>
                    </div>

                )) }
            </Menu>
        </React.Fragment>
    )
}