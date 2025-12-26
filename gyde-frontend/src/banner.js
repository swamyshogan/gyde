import React from "react";
import {Link} from 'react-router';
import { useResizeDetector } from 'react-resize-detector';
import {Box, Tabs, Tab, Divider} from '@mui/material';
import { PowerSettingsNew } from "@mui/icons-material";

import logo from '../public/GYDE_logo.png';
import TabLabel from './TabLabel'

import {useUserData} from './UserData';
import {useEnvironment} from './Environment';
import packageInfo from '../package.json';

const Banner = (props) => {
    const { 
        tabs, savingErrors, savingTab,
        tabLastTransition, tabLastSave, selectedTab, goHome
    } = props;

    const environment = useEnvironment();
    const envType = environment?.type || '';
    const userData = useUserData();

    const {ref: resizerRef, width} = useResizeDetector({
        refreshMode: 'throttle',
        refreshRate: 40
    });

    return ( 
        <header ref={resizerRef}>
            <Box 
                sx={{
                    color: '#ffffff',
                    bgcolor: 'primary.darkBlue',
                    display:"flex" ,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px',
                    paddingLeft: '15px',
                    paddingRight: '15px'
                }}
                height={40} 
                >
                <div 
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '1rem',
                        color: '#ffffff',
                    }}
                >
                    <Link
                        to="/"
                        style={{cursor: 'pointer', display: 'flex', flexDirection: 'row', color: 'white', textDecoration: 'none'}}
                    >
                        <img 
                            alt=""
                            src={logo}
                            style={{
                                width: '90px',
                                height: '24px',
                                transition: 'height 0.4s ease-out, width 0.4s ease-out'
                            }}
                        />
                        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', fontSize: '80%', paddingLeft: '0.5rem'}}>
                            <div style={{color: envType !== 'prod' ? 'red' : undefined}}>
                                {envType === 'prod' ? '' : envType}
                            </div>
                            <div>
                                v{packageInfo.version}
                            </div>
                        </div>
                    </Link>
                    <Divider 
                        orientation='vertical'
                        variant='middle'
                        sx={{pt: '18px', pb: '18px'}}
                        color='#bbbbbb'
                    />
                    <Tabs
                        value={tabs.some((tab) => tab.id === selectedTab) ? selectedTab : false }
                        variant='scrollable'
                        sx={{maxWidth: width - 330}}
                        TabIndicatorProps={{
                            sx: {
                                height: '4px',
                                backgroundColor: 'primary.green',
                            }
                        }}
                        aria-label="dataset tabs"
                    >
                        { tabs.map((tab) => (
                            <Tab 
                                key={tab.id}
                                value={tab.id}
                                sx={{background: 'primary.darkBlue'}}
                                label={
                                    <TabLabel
                                        tab={tab}
                                        savingErrors={savingErrors}
                                        savingTab={savingTab}
                                        tabLastTransition={tabLastTransition}
                                        tabLastSave={tabLastSave}
                                    />
                                } 
                            />
                        )) }
                    </Tabs>
                </div>
                { userData?.name 
                    ? 
                    <div 
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '12px'
                        }}
                    >
                        <p>Hello, {userData.name}</p>
                        <a style={{color: 'white'}} href="/logout">
                            <PowerSettingsNew/>
                        </a>
                    </div>
                    : null
                }
            </Box>
        </header>
    );
};

export default Banner;
