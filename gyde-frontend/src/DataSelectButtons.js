import React from 'react';
import { Button, Divider } from '@mui/material';
import {
    PostAddOutlined, FileUploadOutlined, WbIncandescentOutlined, KeyboardDoubleArrowRight, ArrowDropUp,
    ArrowDownward
} from '@mui/icons-material';
import {useNavigate} from 'react-router';

import UseCaseHelp from './UseCaseHelp';
import {useFeatureFlag} from './Environment';

const getStyles = (isCollapsed) => {
    const baseButtonStyle = {
        pt: '1rem',
        pb: '1rem',
        borderRadius: '0.75rem',
        backgroundColor: "primary.light",
        fontSize: '0.8rem',
        width: '15rem',
        gap: '0.5rem',

        transition: `
            padding-top 0.4s ease-out,
            padding-bottom 0.4s ease-out,
            border-radius 0.4s ease-out
        `
    }

    if (isCollapsed) {
        baseButtonStyle['pt'] = '0.2rem';
        baseButtonStyle['pb'] = '0.2rem';
        baseButtonStyle['borderRadius'] = '0.4rem';
    }

    const blueButtonStyle = {...baseButtonStyle};
    blueButtonStyle['backgroundColor'] = "primary.blue";
    blueButtonStyle[':hover'] = { backgroundColor: 'primary.lightBlue' };
    
    const blueButtonStyleHighlighted = {...blueButtonStyle};
    blueButtonStyleHighlighted['backgroundColor'] = "primary.lightBlue";
    
    const greenButtonStyle = {...baseButtonStyle};
    greenButtonStyle['backgroundColor'] = "primary.green";
    greenButtonStyle[':hover'] = { backgroundColor: 'primary.lightGreen' };
    
    const greenButtonStyleHighlighted = {...greenButtonStyle};
    greenButtonStyleHighlighted['backgroundColor'] = "primary.lightGreen";

    const whiteButtonStyle = {...baseButtonStyle};
    whiteButtonStyle['color'] = 'black';
    whiteButtonStyle[':hover'] = { backgroundColor: 'white' };
    
    const whiteButtonStyleHighlighted = {...whiteButtonStyle}
    whiteButtonStyleHighlighted['backgroundColor'] = 'white';

    return {
        blueButtonStyle, blueButtonStyleHighlighted,
        greenButtonStyle, greenButtonStyleHighlighted,
        whiteButtonStyle, whiteButtonStyleHighlighted
    };
}

const DataSelectButtons = (props) => {
    const {
        selected, isCollapsed, tabs, goToTabs, availableComponents=[]
    } = props;
    
    const {
        blueButtonStyle, blueButtonStyleHighlighted,
        greenButtonStyle, greenButtonStyleHighlighted,
        whiteButtonStyle
    } = getStyles(isCollapsed);

    const useCaseHelp = useFeatureFlag('useCaseHelp');

    const openButtonSet = selected == 'session' ? 'old' : selected === '/' ? 'none' : 'new';

    const navigate = useNavigate();

    return (
        <div
            style={ (isCollapsed)
                ?{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    justifyContent: 'center',
                    transition: 'gap 0.4s ease-out'

                } : {
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    justifyContent: 'center',
                    transition: 'gap 0.4s ease-out'
                }
            }
        >
            <div 
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1rem',
                    justifyContent: 'center',
                }}
            >
                <Button
                    variant='contained'
                    sx={
                        (openButtonSet === 'new')
                        ? blueButtonStyleHighlighted
                        : blueButtonStyle
                    }
                    onClick={(ev) => {
                        navigate('/new');
                    }}
                >
                    New dataset
                </Button>
                <Button
                    variant='contained'
                    sx={
                        (openButtonSet === 'old')
                        ? greenButtonStyleHighlighted 
                        : greenButtonStyle
                    }
                    onClick={() => {
                        navigate('/datasets');
                    }}
                >
                    Existing dataset
                </Button>
                { (false && (tabs.length > 0))
                    ? <Button
                        variant='contained'
                        sx={whiteButtonStyle}
                        onClick={goToTabs}
                    >
                        Resume
                        <KeyboardDoubleArrowRight/>
                    </Button>
                    : null
                }
            </div>
            { useCaseHelp ? <UseCaseHelp /> : undefined }
            <div 
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '5rem',
                    justifyContent: 'center',
                }}
            >
                <div style={{
                    display: (selected !== '/' && selected !== 'session') ? 'flex' : 'none',
                    gap: '1rem'
                }}>
                    { availableComponents.map(({key, label, subtitle, Icon=PostAddOutlined}) => (
                        <Button
                            key={key}
                            variant='contained'
                            sx={
                                {... ((selected === key)
                                ? blueButtonStyleHighlighted 
                                : blueButtonStyle),
                                flexDirection: 'column'}

                            }
                            onClick={() => {
                                navigate(`/new/${key}`)
                            }}
                            value={key}
                        >
                            <div><Icon sx={{verticalAlign: 'bottom'}} />{label}</div>
                            <div style={{fontSize: '65%'}}>{subtitle}</div>
                        </Button> 
                    )) }
                </div>
            </div>
        </div>
    )
}

export default DataSelectButtons;
