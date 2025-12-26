import React from 'react';

export {SlivkaServiceContext, WithSlivkaService, useSlivka, useSlivkaService} from './SlivkaService';

import {ServiceLauncher as RawServiceLauncher} from './App';
import {JobView as RawJobView} from './App';
export {configMapToFormData} from './App';
export {RawServiceLauncher, RawJobView};

import Styled from './Styled';

export function ServiceLauncher(props) {
    return (
        <Styled>
            <RawServiceLauncher {...props} />
        </Styled>
    );
}

export function JobView(props) {
    return (
        <Styled>
            <RawJobView {...props} />
        </Styled>
    );
}