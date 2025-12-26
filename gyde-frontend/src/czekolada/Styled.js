import root from 'react-shadow';

import React from 'react';

const BOOTSTRAP = preval`module.exports = require('fs').readFileSync('node_modules/bootstrap/dist/css/bootstrap.min.css', 'utf8')`;

export default function Styled({children}) {
    return (
        <root.div>
            <style>
                {/* Turns out bootstrap does not like being used exclusively inside a ShadowRoot... 
                    but there must be a better way...? */ `

                :host {
                    --bs-border-width: 1px;
                    --bs-border-color: #6c757d;
                    --bs-form-invalid-border-color: red;
                    --bs-border-radius: 6px;
                    --bs-secondary-bg: #e9ecef;
                    
                }
                `}

                { BOOTSTRAP }
            </style>
            <body>
            <div className="container-fluid">
                { children }
            </div>
            </body>
        </root.div>
    );
};