import React, {useState} from 'react';
import { ThemeProvider, Link } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';

import packageInfo from '../package.json';
import gtheme from './theme';
import logo from '../public/GYDE_logo.png';

import DataSelectButtons from './DataSelectButtons';
import {useEnvironment} from './Environment';


export const LogoPage = ({isCollapsed=false, children}) => {
    const environment = useEnvironment();
    const envType = environment?.type || '';

    return (
        <ThemeProvider theme={gtheme}>
            <div className={(
                isCollapsed
                ? 'landing collapsed'
                : 'landing'
            )}>
                <div 
                    className={(
                        isCollapsed 
                        ? 'logoWithVersion collapsed'
                        : 'logoWithVersion'
                    )}
                >
                    <div style={{display: 'flex', flexDirection: 'row'}}>
                        <img 
                            alt=""
                            src={logo}
                            style={(isCollapsed) ? {
                                width: '136px',
                                height: '36px',
                                transition: 'height 0.4s ease-out, width 0.4s ease-out'
                            } : {
                                width: '225px',
                                height: '60px',
                                transition: 'height 0.4s ease-out, width 0.4s ease-out'
                            }}
                        />
                        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', fontSize: '80%', paddingLeft: '1rem'}}>
                            <div style={{color: envType !== 'prod' ? 'red' : undefined}}>
                                {envType === 'prod' ? '' : envType}
                            </div>
                            <div>
                                v{packageInfo.version}
                            </div>
                        </div>
                    </div>
                </div>
                { children }
            </div>
        </ThemeProvider>
    );
}

const Landingpage = (props) => {
    const {
        selectedOption, isCollapsed, tabs, goToTabs, availableComponents, addendum
    } = props;


    return (
        <LogoPage isCollapsed={isCollapsed}>
                <DataSelectButtons
                    availableComponents={availableComponents}
                    isCollapsed={isCollapsed}
                    selected={selectedOption}
                    tabs={tabs}
                    goToTabs={goToTabs}
                />

                { addendum
                    ? <div style={{display: isCollapsed ? 'none' : 'flex', marginTop: '3rem', alignItems: 'center', flexDirection: 'column'}}>
                        { addendum }
                      </div>
                    : undefined }
        </LogoPage>
    );
}

export default Landingpage;