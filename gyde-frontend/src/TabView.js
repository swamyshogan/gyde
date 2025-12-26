import React, {useCallback} from "react";

import {
    Button
} from '@mui/material';

import Study from "./Study";
import Banner from "./banner";

import {useNavigate} from 'react-router';


class TabBoundaryWrapper extends React.Component {
    constructor(props) {
        super(props);

        this.state = {error: undefined};
    }

    static getDerivedStateFromError(err) {
        return {error: err};
    }

    componentDidCatch(err, info) {
        console.log(err, info);
    }

    render() {
        const {children} = this.props;
        const {error} = this.state;

        if (error) {
            return (
                <div>
                    Sorry, this GYDE dataset has crashed.

                    <pre>
                        { error.message || error.toString() }
                    </pre>

                    <Button onClick={(ev) => {this.setState({error: undefined}); this.props.closeTab()}}>
                        Close dataset
                    </Button>
                </div>
            )
        } else {
            return (
                <React.Fragment>
                    { children }
                </React.Fragment>
            )
        }
    }
}


const TabView = (props) => {
    const { 
        tabs, selectedTab, onTabChange, savingErrors, savingTab,
        tabLastTransition, tabLastSave, columnDefs, cdrPos,
        vernierPos, alignmentTargets, selectedTabState, makeCopy,
        onDataLoad
    } = props;

    const tid = selectedTabState.id;
    const navigate = useNavigate();

    const doMakeCopy = useCallback((ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const next = makeCopy(tid);
        navigate(next);
    }, [navigate, tid]);

    return (
        <React.Fragment>
            <Banner
                tabs={tabs}
                onTabChange={onTabChange}
                savingErrors={savingErrors}
                savingTab={savingTab}
                tabLastTransition={tabLastTransition}
                tabLastSave={tabLastSave}
                selectedTab={selectedTabState.id}
            />

            { selectedTabState &&
                <React.Fragment>
                    { selectedTabState._gyde_readonly
                        ? <div>
                            This is a view onto another user's dataset.  If you want to save your own changes,
                            you can <a href="#" onClick={doMakeCopy}>make a copy.</a>
                        </div>
                        : undefined 
                    }
                    <TabBoundaryWrapper closeTab={selectedTabState.closeTab}>
                        <Study 
                            key={selectedTab}
                            loadedSessions={tabs}
                            {...selectedTabState}
                            columnDefs={columnDefs }
                            cdrPos={ cdrPos }
                            vernierPos={ vernierPos }
                            alignmentTargets={ alignmentTargets }
                            onDataLoad={onDataLoad}
                        />
                    </TabBoundaryWrapper>
                </React.Fragment> 
            }
        </React.Fragment>
    )
}

export default TabView;
