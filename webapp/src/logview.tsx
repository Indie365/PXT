/// <reference path="../../built/pxtsim.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as core from "./core";


export class LogView extends React.Component<{}, {}> {
    private view : pxsim.logs.LogViewElement;
    
    constructor(props: any) {
        super(props);
        this.view = new pxsim.logs.LogViewElement({
            maxEntries: 80,
            maxAccValues: 500,
            onClick: (es) => pxt.commands.browserDownloadAsync(pxsim.logs.entriesToCSV(es), "data.csv", "text/csv"),
            onTrendChartClick: (e) => pxt.commands.browserDownloadAsync(pxsim.logs.entryToCSV(e), "data.csv", 'text/csv')
        })
    }
    
    componentDidMount() {
        let node = ReactDOM.findDOMNode(this);
        node.appendChild(this.view.element);
    }

    clear() {
        this.view.clear();
    }

    render() {
        return <div/>
    }
}