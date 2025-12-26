import React, {useState, useRef, useContext, useEffect, createContext, useReducer, useCallback, useMemo} from 'react';
import { Button, Divider, Accordion, AccordionSummary, AccordionDetails, Typography,
    Box, Tab, Tabs, Grid } from '@mui/material';
import {
    ArrowDownward
} from '@mui/icons-material';
import {Link} from 'react-router';


const TabContext = createContext({registerTab: () => {}, deregisterTab: () => {}});

function useTab(label) {
    const keyRef = useRef();
    if (!keyRef.current) keyRef.current = Symbol(label);

    const {registerTab, unregisterTab, currentTab} = useContext(TabContext);

    useEffect(() => {
        const key = keyRef.current;
        registerTab(key, label);
        return () => {unregisterTab(key)};
    }, []);

    return keyRef.current === currentTab;
}

function SelectableHelp({children}) {
    const [registeredTabs, updateRegisteredTabs] = useReducer(
        (registeredTabs, {action, key, label}) => {
            if (action === 'unregister') {
                return registeredTabs.filter((t) => t.key !== key);
            } else {
                return [...registeredTabs, {key, label}]
            }
        },
        []
    );

    const registerTab = useCallback((key, label) => {
        updateRegisteredTabs({action: 'register', key, label})
    }, []);

    const unregisterTab = useCallback((key) => {
        updateRegisteredTabs({action: 'unregister', key})
    }, []);

    const [currentTab, setCurrentTab] = useState();

    useEffect(() => {
        if (!registeredTabs.find((t) => t.key === currentTab) && registeredTabs.length) {
            setCurrentTab(registeredTabs[0].key);
        }
    }, [registeredTabs, currentTab]);

    const actions = useMemo(() => {
        return {registerTab, unregisterTab, currentTab}
    }, [currentTab]);

    return (
        <TabContext.Provider value={actions}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', color: 'white', maxWidth: 1000 }}>
                <Tabs value={Math.max(0, registeredTabs.findIndex((t) => t.key === currentTab))} 
                      onChange={(_, idx) => { setCurrentTab(registeredTabs[idx].key)}}
                      textColor="primary"
                      TabIndicatorProps={{ sx: { display: 'none' } }}
                      sx={{
                        '& .MuiTabs-flexContainer': {
                             flexWrap: 'wrap',
                         },

                         '& .MuiTab-root': {
                            color: '#aaaaaa',
                            border: '1px solid'
                         },

                         '&  .Mui-selected': {
                            color: 'black',
                            background: '#a7b9c4'
                         },

                         'paddingBottom': '0.5rem'

                    }}>
                    { registeredTabs.map((t, i) => (
                        <Tab key={i} label={t.label} /> )) }
                </Tabs>
                { children }
            </Box>
        </TabContext.Provider>
    )
}

function HelpTab({label, children}) {
    const displayed = useTab(label);

    if (displayed) {
        return (
            <Typography component="div"
                        sx={{
                background: '#a7b9c4', 
                borderRadius: '0.5rem',
                color: 'black',
                paddingLeft: '1rem',
                paddingRight: '1rem',
                paddingBottom: '1rem',
                paddingTop: '0.5rem'
            }}>
                { children }
            </Typography>
        )
    } else {
        return (<React.Fragment />);
    }
}

export default function UseCaseHelp() {
    return (
        <Accordion elevation={8}
                   sx={{
                       backgroundColor: '#153452',
                       color: 'white'}
                   }>
            <AccordionSummary expandIcon={<ArrowDownward sx={{color: 'white'}} />}
                              aria-controls="wants-content"
                              id="wants-header">
                <Typography variant="h5" component="span">I want to...</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <SelectableHelp>
                    <HelpTab label="Predict protein structures">                        
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                     <h3>Input Needed:</h3>
                                        <ul><li><Link to="/new/enter-seq">Sequence</Link></li></ul>
                                    <h3>Input options:</h3>
                                    <ul>
                                        <li>Paste Sequence</li>
                                        <li>Retrieve sequence using IDs (ex: UniProt IDs)</li>
                                        <li>Upload CSV or FASTA file with sequence(s)</li>
                                    </ul>
                            </Grid>
                            <Divider orientation="vertical" 
                                     flexItem 
                                     sx={{ borderRight: '1px solid #666666', marginTop: '1rem', marginRight: "-1px" }} />
                            <Grid item xs={6}>
                                    <h3>Use cases:</h3>
                                    Predict monomer or multimer of protein-protein, antigen-antibody or protein-ligand co-folding
                            </Grid>  
                        </Grid>
                    </HelpTab>

                    <HelpTab label="Perform protein design/engineering">
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                    <h3>Input Needed:</h3>
                                        <ul><li><Link to="/new/upload">Structure</Link></li></ul>
                                    <h3>Input options:</h3>
                                    <ul>
                                        <li>Upload Structure in PDB or mmCIF format</li>
                                        <li>Retrieve structure using IDs (ex: PDB IDs)</li>
                                        <li>Predicted Structure</li> 
                                    </ul>
                            </Grid>
                            <Divider orientation="vertical" 
                                     flexItem 
                                     sx={{ borderRight: '1px solid #666666', marginTop: '1rem', marginRight: "-1px" }} />
                            <Grid item xs={6}>
                                    <h3>Use cases:</h3>
                                    Generate designs using ProteinMPNN, ThermoMPNN, RaSP or LigandMPNN and combine them to select top mutants for validation
                            </Grid>  
                        </Grid>
                    </HelpTab>

                    <HelpTab label="Design or compare with existing antibody constructs">
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                    <h3>Input Needed:</h3>
                                        <ul><li><Link to="/new/enter-seq">Sequence</Link></li></ul>
                                    <h3>Input options:</h3>
                                    <ul>
                                        <li>Paste sequence</li>
                                        <li>Upload CSV or FASTA file with sequence(s)</li>
                                    </ul>
                            </Grid>
                            <Divider orientation="vertical" 
                                     flexItem 
                                     sx={{ borderRight: '1px solid #666666', marginTop: '1rem', marginRight: "-1px" }} />
                            <Grid item xs={6}>
                                    <h3>Use cases:</h3>
                                    Retrieve similar constructs from TaPIR along with their associated data to visualize in GYST
                            </Grid>  
                        </Grid>
                    </HelpTab>

                    <HelpTab label="Analyze antibodies">
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                    <h3>Input Needed (one of the following):</h3>
                                        <ul><li><Link to="/new/enter-seq">Antibody Sequence</Link></li></ul>
                                        <ul><li><Link to="/new/upload">Antibody Structure</Link></li></ul>
                                    <h3>Input options:</h3>
                                    <ul>
                                        <li>Paste Heavy and Light chain sequences</li>
                                        <li>Upload Structure in PDB or mmCIF format</li>
                                    </ul>
                            </Grid>
                            <Divider orientation="vertical" 
                                     flexItem 
                                     sx={{ borderRight: '1px solid #666666', marginTop: '1rem', marginRight: "-1px" }} />
                            <Grid item xs={6}>
                                    <h3>Use cases:</h3>
                                    Predict antibody structure from antibody property prediction
                            </Grid>  
                        </Grid>
                    </HelpTab>
                </SelectableHelp>
            </AccordionDetails>
        </Accordion>
    );
}