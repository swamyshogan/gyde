import React, {useState} from 'react';
import {Button, RadioGroup, FormLabel, FormControl, FormControlLabel, Radio, Checkbox, FormGroup,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from '@mui/material';

import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate.js';
import {csvFormatRows} from 'd3-dsv';

export function SequenceTableExportControls({show, onSubmit, onHide, hasColumnSelection, ...props}) {
	const [format, setFormat] = useState('excel');
	const [exportAll, setExportAll] = useState(false);
	const [exportAllColumns, setExportAllColumns] = useState(false);
	const [includeSelectedSeqColumns, setIncludeSelectedSeqColumns] = useState(false);
	const [includeMSA, setIncludeMSA] = useState(false);
	const [includeMSAGermlineDiff, setIncludeMSAGermlineDiff] = useState(false);

	return (
		<Dialog open={show} onClose={onHide} aria-labelledby="export-dialog-title">
			<DialogTitle id="export-dialog-title">
				Export data
			</DialogTitle>

			<DialogContent>
				<DialogContentText>
					Export either the currently-visible columns in the MSA table, 
					or the complete dataset.
				</DialogContentText>

				<FormControlLabel
				    control={<Checkbox checked={exportAll} onChange={(ev) => setExportAll(ev.target.checked)} />}
				    label="Export all rows (otherwise, just exports currently-filtered data)" />

				<FormControlLabel
				    control={<Checkbox checked={exportAllColumns} onChange={(ev) => setExportAllColumns(ev.target.checked)} />}
				    label="Export all fields (otherwise, just currently visible)" />

				<FormControlLabel
				    control={<Checkbox checked={includeSelectedSeqColumns} disabled={!hasColumnSelection} onChange={(ev) => setIncludeSelectedSeqColumns(ev.target.checked)} />}
				    label="Include selected sequence columns" />

				<FormControlLabel
				    control={<Checkbox checked={includeMSA} onChange={(ev) => setIncludeMSA(ev.target.checked)} />}
				    label="Include the multiple sequence alignment columns" />

				<FormControlLabel
				    control={<Checkbox checked={includeMSAGermlineDiff} onChange={(ev) => setIncludeMSAGermlineDiff(ev.target.checked)} />}
				    label="Include columns to show differences from the reference sequence" />

				<FormGroup row>
					<FormControl component="fieldset">
						<FormLabel component="legend">Format:</FormLabel>
						<RadioGroup value={format} onChange={(ev) => setFormat(ev.target.value)}>
							<FormControlLabel value="excel" label="Excel (XLSX)" control={<Radio />} />
							<FormControlLabel value="csv" label="CSV" control={<Radio />} />
						</RadioGroup>
					</FormControl>
				</FormGroup>
			</DialogContent>

			<DialogActions>
				<Button onClick={() => onSubmit({
					format,
					exportAll,
					exportAllColumns,
					includeSelectedSeqColumns: includeSelectedSeqColumns && hasColumnSelection,
					includeMSA,
					includeMSAGermlineDiff
				})} color="primary">
					Export
				</Button>
				<Button onClick={onHide} color="primary">
					Cancel
				</Button>
			</DialogActions>
		</Dialog> 
	);
} 

export async function exportSequenceTable(columns, data, alignments, references, swizzle) {
	if (!swizzle) throw Error('swizzle is now required');

	const ssColFuncs = [],
	      ssStyleFuncs = [];

	const workbook = await XlsxPopulate.fromBlankAsync();
	const sheet = workbook.sheet('Sheet1');

	let dataRowIndex = 2;

	{
		let colIndex = 1;
		for (const column of columns) {
			if (column.subcolumns) {
				let sci = colIndex;
				dataRowIndex = 3;
				for (const subcolumn of column.subcolumns) {
					sheet.cell(2, sci).value(subcolumn.name).style('bold', true);
					ssColFuncs[sci - 1] = subcolumn.accessor;
					ssStyleFuncs[sci - 1] = subcolumn.style;
					++sci;
				}
				if (sci > colIndex) {
					sheet.cell(1, colIndex).rangeTo(sheet.cell(1, sci - 1)).merged(true).value(column.name).style('bold', true);
				}
				colIndex = sci;
			} else {
				ssColFuncs[colIndex - 1] = column.accessor;
				ssStyleFuncs[colIndex - 1] = column.style;
				sheet.cell(1, colIndex).value(column.name).style('bold', true);
				++colIndex;
			}
		}
	}

	for (let outrow = 0; outrow < swizzle.length; ++outrow) {
		const row = swizzle[outrow];
		if (row < 0) continue;

		for (let ci = 0; ci < ssColFuncs.length; ++ci) {
			const cell = sheet.cell(outrow + dataRowIndex, ci + 1);
			const val = ssColFuncs[ci] ? ssColFuncs[ci](row, data, alignments, references) : null,
			      style = ssStyleFuncs[ci] ? ssStyleFuncs[ci](row, data, alignments, references) : null;
			if (val) cell.value(val);
			if (style) cell.style(style);
		}
	}

	return workbook.outputAsync('blob');
}

export async function exportSequenceTableCSV(columns, data, alignments, references, swizzle) {
	if (!swizzle) throw Error('swizzle is now required');

	const ssColFuncs = [],
	      headerRow = [],
	      subHeaderRow = [];

	{
		let colIndex = 0;
		for (const column of columns) {
			if (column.subcolumns) {
				let sci = colIndex;
				for (const subcolumn of column.subcolumns) {
					while (subHeaderRow.length < sci) subHeaderRow.push('');
					subHeaderRow.push(subcolumn.name);
					ssColFuncs[sci] = subcolumn.accessor;
					++sci;
				}
				if (sci > colIndex) {
					while (headerRow.length < colIndex) headerRow.push('');
					headerRow.push(column.name);
				}
				colIndex = sci;
			} else {
				ssColFuncs[colIndex] = column.accessor;
				while (headerRow.length < colIndex) headerRow.push('');
				headerRow.push(column.name);
				++colIndex;
			}
		}
	}

	const outRows = [headerRow];
	if (subHeaderRow.some((x) => x)) outRows.push(subHeaderRow);

	for (let outrow = 0; outrow < swizzle.length; ++outrow) {
		const row = swizzle[outrow];
		if (row < 0) continue;

		const rowData = [];
		for (let ci = 0; ci < ssColFuncs.length; ++ci) {
			const val = ssColFuncs[ci] ? ssColFuncs[ci](row, data, alignments, references) : null;
			rowData.push(val || '');
		}
		outRows.push(rowData);
	}

	return new Blob([csvFormatRows(outRows)], {type: 'text/csv'})
}