import React, {useState} from "react";
import { 
    Button, Checkbox, Menu, MenuItem, Stack, Radio, ListItemText, Tooltip, Dialog, DialogTitle, 
    DialogContent, DialogActions, IconButton, ButtonGroup, Divider
} from "@mui/material";
import { ArrowDropDown, Download, Close } from "@mui/icons-material";

import { navbarButtonCSS } from "./NavBar";
import { exportHeatmapCSV, exportHeatmapXLSL } from "./gmsa/HeatmapUtils";
import GMenu, { GMenuItem, GDropDown, GSubMenu } from './utils/GMenu';

function getButtonStyle(isSelected) {
    return {
        color: isSelected ? 'white' : '#777777',
        backgroundColor: isSelected ? 'primary.blue' : 'white',
        ':hover': {backgroundColor: isSelected ? 'primary.blue' : 'white'}
    }
}

const HeatmapNavBar = (props) => {
    const [scaleMenuAnchor, setScaleMenuAnchor] = useState(null);

    const scaleMenuOnClick = (event) => {
        setScaleMenuAnchor(event.currentTarget);
    }

    const scaleMenuOnClose = () => {
        setScaleMenuAnchor(null);
    }

    const [colormapMenuAnchor, setColormapMenuAnchor] = useState(null);

    const colormapMenuOnClick = (event) => {
        setColormapMenuAnchor(event.currentTarget);
    }

    const colormapMenuOnClose = () => {
        setColormapMenuAnchor(null);
    }

    const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
    const [columnsMenuIsOpen, setColumnsMenuIsOpen] = useState(false);

    const showColumnsMenu = (event) => {
        setColumnsMenuAnchor(event.currentTarget);
        setColumnsMenuIsOpen(true);
    }
    
    const hideColumnsMenu = () => {
        setColumnsMenuIsOpen(false);
    }

    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

    const buttonStyle = {
        ...navbarButtonCSS, 
        fontSize: props.compact ? '10px' : '14px',
        padding: props.compact ? '1px' : null,
        borderRadius: props.compact ? '5px' : '10px'
    }

    const ColormapMenu_ = props.heatmapRelativeToWT ? DivergentColormapMenu : ColormapMenu,
          colorPalette_ = props.heatmapRelativeToWT ? props.divergentColorPalette : props.colorPalette,
          setColorPalette_  = props.heatmapRelativeToWT ? props.setDivergentColorPalette : props.setColorPalette;

    return (
        <Stack gap='4px'>
            <Divider textAlign='left' sx={{fontSize: '10px', color: '#555'}}>
                Heatmap Options
            </Divider>

            <Stack direction='row' 
                sx={{
                    alignItems: 'stretch',
                    gap: props.compact ? '0px' : '5px',
                    mb: '5px'
                }}
            >
                <Button
                    sx={buttonStyle}
                    onClick={props.toggleHeatmapRelativeToWT}
                >
                    <Checkbox
                        sx={{padding: '0px'}}
                        checked={props.heatmapRelativeToWT}
                    />
                    Normalize to wildtype
                </Button>
                <Button
                    sx={buttonStyle}
                    onClick={props.toggleHeatmapHideFiltered}
                >
                    <Checkbox
                        sx={{padding: '0px'}}
                        checked={!!props.heatmapHideFiltered}
                    />
                    Hide filtered items
                </Button>
                <ScaleMenu
                    anchor={scaleMenuAnchor}
                    onClose={scaleMenuOnClose}
                    showMenu={scaleMenuOnClick}
                    style={buttonStyle}
                    
                    onChange={props.setDataScale}
                    dataScale={props.dataScale}
                    dataScales={props.dataScales}
                />
                <ColormapMenu_
                    anchor={colormapMenuAnchor}
                    onClose={colormapMenuOnClose}
                    showMenu={colormapMenuOnClick}
                    style={buttonStyle}
                    
                    disabled={props.heatmapRelativeToWT_}
                    setColorPalette={setColorPalette_}
                    colormap={colorPalette_}
                />
                <HeatmapColumnsMenu
                    anchor={columnsMenuAnchor}
                    isOpen={columnsMenuIsOpen}
                    onHide={hideColumnsMenu}
                    onShow={showColumnsMenu}
                    style={buttonStyle}

                    heatmapSelectedColumn={props.selectedColumn}
                    setHeatmapSelectedColumn={props.setSelectedColumn}
                    columns={props.columns}
                    columnDisplayNames={props.columnDisplayNames}
                    matrixDataObject={props.matrixDataObject}
                />

                { (props.heatmapData &&  Object.keys(props.heatmapData).length > 0) ?
                    <React.Fragment>
                        <Tooltip 
                            title="Download heatmap data to .csv"
                            placement='bottom'
                        >
                            <Button
                                onClick={() => setIsExportDialogOpen(true)}
                                sx={buttonStyle}
                            >
                                
                                Download heatmap data
                                <Download/>
                            </Button>
                        </Tooltip>
                        <HeatmapExportDialog
                            open={isExportDialogOpen}
                            onClose={() => setIsExportDialogOpen(false)}

                            heatmapData={props.heatmapData}
                            selectedColumn={props.selectedColumn}
                            alignments={props.alignments}
                            seqColumns={props.seqColumns}
                            seqColumnNames={props.seqColumnNames}
                        />
                    </React.Fragment>
                    : null
                }
                <div style={{flexGrow: 1}} />
                {props.variantSelectionComponent}
            </Stack>
        </Stack>
    )
}

const ScaleMenu = (props) => {
    const { 
        anchor,
        onClose,
        showMenu,
        onChange,
        dataScale,
        dataScales=[],
        disabled,
        style,
        displayNames={
            '-fold change': 'Inv. fold change'
        }
    } = props;
    const isOpen = !!anchor;

    return (
        <React.Fragment>
            <Button
                sx={style}
                disabled={disabled}
                onClick={showMenu}>
                Data scale: {displayNames[dataScale] ?? dataScale}
                <ArrowDropDown/>
            </Button>
            <Menu
                id="heatmap-data-scale-menu"
                anchorEl={anchor}
                open={isOpen}
                onClose={onClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}>
                { dataScales.map((ds, index) => (
                    <MenuItem 
                        key={index}
                        value={ds}
                        onClick={() => {onChange(ds); onClose()}}
                    >
                        {displayNames[ds] ?? ds}
                    </MenuItem>
                )) }
            </Menu>
        </React.Fragment>
    )
}

const ColormapMenu = (props) => {
    const { anchor, onClose, showMenu, setColorPalette, colormap, style} = props;
    const isOpen = !!anchor;

    return (
        <React.Fragment>
            <Button
                sx={style}
                onClick={showMenu}>
                colormap: {colormap}
                <ArrowDropDown/>
            </Button>
            <Menu
                id="heatmap-colormap-menu"
                anchorEl={anchor}
                open={isOpen}
                onClose={onClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}>
                <MenuItem
                    value='magma'
                    onClick={() => {setColorPalette('magma'); onClose()}}>
                    magma
                </MenuItem>
                <MenuItem
                    value='viridis'
                    onClick={() => {setColorPalette('viridis'); onClose()}}>
                    viridis
                </MenuItem>
            </Menu>
        </React.Fragment>
    )
}

const DivergentColormapMenu = (props) => {
    const { anchor, onClose, showMenu, setColorPalette, colormap = 'viola', style} = props;
    const isOpen = !!anchor;

    return (
        <React.Fragment>
            <Button
                sx={style}
                onClick={showMenu}>
                colormap: {colormap}
                <ArrowDropDown/>
            </Button>
            <Menu
                id="heatmap-colormap-menu"
                anchorEl={anchor}
                open={isOpen}
                onClose={onClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}>
                <MenuItem
                    value='viola'
                    onClick={() => {setColorPalette('viola'); onClose()}}>
                    viola
                </MenuItem>
                <MenuItem
                    value='bky'
                    onClick={() => {setColorPalette('bky'); onClose()}}>
                    bky
                </MenuItem>
            </Menu>
        </React.Fragment>
    )
}

const HeatmapColumnsMenu = (props) => {
    const {
        anchor, isOpen, onShow, onHide, columns, heatmapSelectedColumn, 
        setHeatmapSelectedColumn, style, matrixDataObject, columnDisplayNames={}
    } = props;

    const filteredColumns = columns.filter((column) => !column.hiddenByColumnsButton);

    return (
        <React.Fragment>
            <Button
                sx={style}
                onClick={onShow}
            >
                Data: {
                    heatmapSelectedColumn === '__gyde_frequencies__'
                      ? 'Frequencies'
                      : (columnDisplayNames[heatmapSelectedColumn] ?? heatmapSelectedColumn) }
                <ArrowDropDown/>
            </Button>
            <Menu
                id="column-menu"
                anchorEl={anchor}
                open={isOpen}
                onClose={onHide}
                anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                <MenuItem divider
                          onClick={() => setHeatmapSelectedColumn('__gyde_frequencies__')}>
                    <Radio checked={(heatmapSelectedColumn === '__gyde_frequencies__')}/>
                    <ListItemText>Frequencies</ListItemText>
                </MenuItem>
                { filteredColumns.map((column, index) => (
                    <MenuItem
                        key={column.field}
                        divider={index===filteredColumns.length-1}
                        onClick={() => setHeatmapSelectedColumn(column.field)}
                    >
                        <Radio checked={(column.field === heatmapSelectedColumn)}/>
                        <ListItemText>{column.title}</ListItemText>
                    </MenuItem>
                )) }
                { Object.keys(matrixDataObject || {}).map((key) => (
                    <MenuItem
                        key={key}
                        onClick={() => setHeatmapSelectedColumn(key)}
                    >
                        <Radio checked={(key === heatmapSelectedColumn)}/>
                        <ListItemText>{key}</ListItemText>
                    </MenuItem>
                )) }
            </Menu>
        </React.Fragment>
    )
}

const HeatmapExportDialog = (props) => {
    const {open, onClose, heatmapData, selectedColumn, alignments=[], seqColumns, seqColumnNames = []} = props;

    const chains = seqColumns.map((col) => col.column);

    const numbering = {};
    chains.forEach((chain, index) => {
        numbering[chain] = alignments[index]?.residueNumbers;
    })

    // general export options
    const [exportAllCols, setExportAllCols] = useState(false);
    const [isTransposed, setIsTransposed] = useState(false);
    
    // CSV and XLSL exporting
    const [exportAs, setExportAs] = useState('csv');

    const exportFunc = () => {
        if (exportAs === 'csv') {
            exportHeatmapCSV(
                heatmapData, selectedColumn, numbering, chains.filter((_, i) => selectedChains[i]), exportAllCols, isTransposed
            )
        } else {
            exportHeatmapXLSL(
                heatmapData, selectedColumn, numbering, chains.filter((_, i) => selectedChains[i]), exportAllCols, isTransposed
            )
        }
    }

    // chain selection
    const [selectedChains, setSelectedChains] = useState(chains.map((_) => true));

    const toggleSelectedChain = (index) => {
        const newSelectedChains = [...selectedChains];

        newSelectedChains[index] = !selectedChains[index];

        setSelectedChains(newSelectedChains);
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
        >
            <DialogTitle>
                Heatmap export options
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                    }}
                >
                    <Close/>
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    width: '40vw',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                }}
            >
                <Stack direction='row' alignItems='center' gap='8px'>
                    <div
                        style={{userSelect: 'none', fontWeight: '700'}}
                    >
                        Select chains
                    </div>
                    { seqColumns.map((_, i) => seqColumnNames[i] || `Sequence ${i + 1}`).map((chain, index) => (
                        <Button
                            key={index}
                            onClick={() => toggleSelectedChain(index)}
                            sx={{
                                fontSize: '12px',
                                color: selectedChains[index] ? 'white' : '#333333',
                                backgroundColor: selectedChains[index] ? 'primary.green' : 'white',
                                ':hover': {backgroundColor: selectedChains[index] ? 'primary.green' : '#dddddd'}
                            }}
                        >
                            {chain}
                        </Button>
                    ))}
                </Stack>

                <ButtonGroup>
                    <Button
                        onClick={() => setExportAllCols(true)}
                        sx={getButtonStyle(exportAllCols)}
                    >
                        All positions
                    </Button>
                    <Button
                        onClick={() => setExportAllCols(false)}
                        sx={getButtonStyle(!exportAllCols)}
                    >
                        Positions with data
                    </Button>
                </ButtonGroup>

                <ButtonGroup>
                    <Button
                        onClick={() => setIsTransposed(false)}
                        sx={getButtonStyle(!isTransposed)}
                    >
                        Sequence positions as columns
                    </Button>
                    <Button
                        onClick={() => setIsTransposed(true)}
                        sx={getButtonStyle(isTransposed)}
                    >
                        Sequence positions as rows
                    </Button>
                </ButtonGroup>

                <ButtonGroup>
                    <Button
                        onClick={() => setExportAs('csv')}
                        sx={getButtonStyle((exportAs === 'csv'))}
                    >
                        .csv
                    </Button>
                    <Button
                        onClick={() => setExportAs('xlsl')}
                        sx={getButtonStyle((exportAs === 'xlsl'))}
                    >
                        .xlsl
                    </Button>
                </ButtonGroup>
            </DialogContent>

            <DialogActions>
                <Button
                    onClick={exportFunc}
                    sx={{
                        backgroundColor: 'primary.blue',
                        color: 'white',
                        borderRadius: '10px',
                        ':hover' : {backgroundColor: 'primary.lightBlue'}
                    }}
                >
                    Export
                </Button>
                <Button onClick={onClose}>
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default HeatmapNavBar;