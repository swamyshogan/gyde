import React, { useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { useResizeDetector } from 'react-resize-detector';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';
import { setupProgram, COLORMAP_SHADER, COLORMAPS } from "./glUtils";
import { RESIDUES } from './HeatmapUtils';
import { cleanNumberForDisplay } from "../utils/utils";

import { Stack, Typography } from "@mui/material";


class Legend {
    constructor(canvas) {
        this.ratio = 1;
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            throw new Error('WebGL does not seem to be available');
        }

        this.createProgram();
        this.createPositionBuffers();
    }

    createProgram() {
        this.legendBarProgram = setupProgram(
            this.gl,
            [
                {type: this.gl.VERTEX_SHADER,
                script: `
                    attribute vec2 a_position;
                    attribute vec2 viewport;
                    attribute vec2 ratio;
                    
                    void main() {
                        gl_Position = vec4(a_position, 0.0, 1.0);
                    }
                `},
                {type: this.gl.FRAGMENT_SHADER,
                script: `precision mediump float;` + COLORMAP_SHADER + `
                    uniform vec2 resolution;
                    uniform vec2 ratio;
                    uniform float colormap;
                    uniform float minScaled;
                    uniform float maxScaled;

                    void main() {
                        vec2 uv = gl_FragCoord.xy/resolution;
                        float sv  = (uv.x * (maxScaled - minScaled)) + minScaled ;
                        if (colormap < 0.1) {
                            gl_FragColor = vec4(magma_colormap(sv), 1.0);
                        }
                        else if (colormap < 1.1) {
                            gl_FragColor = vec4(viridis_colormap(sv), 1.0);
                        }
                        else if (colormap < 2.1) {
                            gl_FragColor = vec4(viola_colormap(sv), 1.0);
                        } else {
                            gl_FragColor = vec4(bky_colormap(sv), 1.0);
                        }
                    }
                `}
            ],
            ['a_position'],
            ['resolution', 'ratio', 'colormap', 'minScaled', 'maxScaled']
        );
        this.gl.useProgram(this.legendBarProgram);
    }

    // private
    createPositionBuffers() {
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            -1.0, 1.0,
            1.0, -1.0,
            1.0, 1.0,
        ]), this.gl.STATIC_DRAW);

        const positionAttributeLocation = this.legendBarProgram.a_position;
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, true, 0, 0);
    }

    setViewport(width, height, ratio) {
        this.width = width * ratio;
        this.height = height * ratio;
        this.ratio = ratio;

        this.gl.uniform2f(this.legendBarProgram.resolution, this.width, this.height);
        this.gl.uniform2f(this.legendBarProgram.ratio, this.ratio, this.ratio);
        this.gl.viewport(0, 0, this.width, this.height);
    }

    setColorPalette(colorPalette) {
        const colormapCode = COLORMAPS[colorPalette];
        this.gl.uniform1f(this.legendBarProgram.colormap, colormapCode);
    }

    setRange(minScaled, maxScaled) {
        this.gl.uniform1f(this.legendBarProgram.minScaled, minScaled);
        this.gl.uniform1f(this.legendBarProgram.maxScaled, maxScaled);
    }

    render() {
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
}

class HeatmapManager {
    constructor(canvas) {
        this.ratio = 1;
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            throw new Error('WebGL does not seem to be available');
        }
        this.ext = this.gl.getExtension('ANGLE_instanced_arrays');

        this.createPrograms();
        this.createPositionBuffers();
    }

    // private
    createPrograms() {
        this.heatmapProgram = setupProgram(
            this.gl,
            [
                {type: this.gl.VERTEX_SHADER,
                script: COLORMAP_SHADER + `
                    attribute vec2 a_position;
                    attribute vec2 a_viewport;
                    attribute vec2 a_instance_offset;
                    attribute vec2 ratio;
                    attribute vec2 global_offset;
                    attribute float a_instance_value;
                    attribute float colormap;
                    attribute float a_cell_width;
                    attribute float a_cell_highlight;

                    varying vec3 color;

                    void main() {
                        /// TODO: precompute?
                        vec2 CELL_DIMS = vec2(a_cell_width, a_viewport.y/(20.0 * ratio.y));
                        vec2 SCALE = 2.0/a_viewport;
                        vec2 local_scale = ratio * CELL_DIMS * SCALE;

                        vec2 scaled_global_offset = ratio * global_offset * SCALE / 2.0;

                        vec2 vertex_position = a_position * local_scale;
                        vec2 pixel_offset = scaled_global_offset + a_instance_offset * local_scale - vec2(1.0, 1.0);

                        gl_Position = vec4(vertex_position + pixel_offset, 0.0, 1.0);

                        if (colormap < 0.1) {
                            color = magma_colormap(a_instance_value);
                        }
                        else if (colormap < 1.1) {
                            color = viridis_colormap(a_instance_value);
                        }
                        else if (colormap < 2.1) {
                            color = viola_colormap(a_instance_value);
                        } else {
                            color = bky_colormap(a_instance_value);
                        }
                        
                        if (a_cell_highlight > 0.1) {
                            if (colormap < 0.1) {
                                color = vec3(0.4, 1.0, 0.6);
                            }
                            else if (colormap < 1.1) {
                                color = vec3(1.0, 0.4, 0.4);
                            }
                            else if (colormap < 2.1) {
                                color = vec3(0.2, 0.7, 0.2);
                            } else {
                                color = vec3(0.0, 0.0, 0.0);
                            }
                        }
                    }
                `},
                {type: this.gl.FRAGMENT_SHADER,
                script: `
                    precision mediump float;
                    varying vec3 color;

                    void main() {
                        gl_FragColor = vec4(color, 1.0);
                    }
                `}
            ],
            [
                'a_position', 'a_viewport', 'a_instance_offset', 'ratio', 'a_cell_width',
                'a_instance_value', 'global_offset', 'colormap', 'a_cell_highlight'
            ],
            []
        );

        this.frameProgram = setupProgram(
            this.gl,
            [
                {
                    type: this.gl.VERTEX_SHADER,
                    script: `
                        attribute vec2 a_point;
                        attribute vec2 a_offset;

                        void main() {
                            gl_Position = vec4(a_point*vec2(1., -1) + a_offset, 0., 1.);
                        }
                    `
                },
                {
                    type: this.gl.FRAGMENT_SHADER,
                    script: `
                        precision mediump float;

                        uniform vec4 u_colour;

                        void main() {
                            gl_FragColor = u_colour;
                        }
                    `
                },
            ],
            ['a_point', 'a_offset'],
            ['u_colour']
        );
    }

    // private
    createPositionBuffers() {
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            0, 0,
            1.0, 0,
            0, 1.0,
            0, 1.0,
            1.0, 0,
            1.0, 1.0,
        ]), this.gl.STATIC_DRAW);
    }
    
    // private
    setInstancedAttributeBuffers() {
        this.offsetBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.offsetBuffer);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER, 
            new Float32Array(
                this.data 
                    ? this.columnSwizzle ? this.data.getSwizzledOffsetArray(this.columnSwizzle) : this.data.offset_array
                    : []
            ),
            this.gl.STATIC_DRAW
        );

        this.valueBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.valueBuffer);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER, 
            new Float32Array(this.data ? this.data.value_array_gl : []), 
            this.gl.STATIC_DRAW
        );

        this.highlightBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.highlightBuffer);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            new Float32Array(this.data ? this.data.highlight_array_gl : []),
            this.gl.STATIC_DRAW
        );
    }

    // private
    setViewportAttributes() {
        this.gl.vertexAttrib2f(this.heatmapProgram.a_viewport, this.width, this.height);
        this.gl.vertexAttrib2f(this.heatmapProgram.ratio, this.ratio, this.ratio);
    }

    setColorPalette(colorPalette) {
        this.colormapCode = COLORMAPS[colorPalette];
    }

    setViewport(width, height, ratio, cellWidth) {
        this.width = width * ratio;
        this.height = height * ratio;
        this.ratio = ratio;
        this.cellWidth = cellWidth;
        
        this.setViewportAttributes();
        this.gl.viewport(0, 0, this.width, this.height);
    }

    renderCells(xOffset, yOffset) {
        this.gl.useProgram(this.heatmapProgram);
        

        const positionAttributeLocation = this.heatmapProgram.a_position;
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, true, 0, 0);

        this.gl.enableVertexAttribArray(this.heatmapProgram.a_instance_offset);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.offsetBuffer);
        this.gl.vertexAttribPointer(this.heatmapProgram.a_instance_offset, 2, this.gl.FLOAT, true, 0, 0);
        this.ext.vertexAttribDivisorANGLE(this.heatmapProgram.a_instance_offset, 1);

        this.gl.enableVertexAttribArray(this.heatmapProgram.a_instance_value);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.valueBuffer);
        this.gl.vertexAttribPointer(this.heatmapProgram.a_instance_value, 1, this.gl.FLOAT, true, 0, 0);
        this.ext.vertexAttribDivisorANGLE(this.heatmapProgram.a_instance_value, 1);

        this.gl.enableVertexAttribArray(this.heatmapProgram.a_cell_highlight);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.highlightBuffer);
        this.gl.vertexAttribPointer(this.heatmapProgram.a_cell_highlight, 1, this.gl.FLOAT, true, 0, 0);
        this.ext.vertexAttribDivisorANGLE(this.heatmapProgram.a_cell_highlight, 1);
        
        this.gl.vertexAttrib1f(this.heatmapProgram.colormap, this.colormapCode);
        this.gl.vertexAttrib2f(this.heatmapProgram.global_offset, xOffset/this.ratio*2, 0);
        this.gl.vertexAttrib2f(this.heatmapProgram.a_viewport, this.width, this.height);
        this.gl.vertexAttrib2f(this.heatmapProgram.ratio, this.ratio, this.ratio);
        this.setViewportAttributes();
        this.gl.vertexAttrib1f(this.heatmapProgram.a_cell_width, this.cellWidth);

        if (this.data?.num_points)
            this.ext.drawArraysInstancedANGLE(this.gl.TRIANGLES, 0, 6, this.data?.num_points);

        this.gl.disableVertexAttribArray(this.heatmapProgram.a_position);
        this.gl.disableVertexAttribArray(this.heatmapProgram.a_instance_offset);
        this.ext.vertexAttribDivisorANGLE(this.heatmapProgram.a_instance_offset, 0);
        this.gl.disableVertexAttribArray(this.heatmapProgram.a_instance_value);
        this.ext.vertexAttribDivisorANGLE(this.heatmapProgram.a_instance_value, 0);
        this.gl.disableVertexAttribArray(this.heatmapProgram.a_cell_highlight);
        this.ext.vertexAttribDivisorANGLE(this.heatmapProgram.a_cell_highlight, 0);
    }

    createFrameBuffers() {
        const px = 2.0/this.width,
              py = 2.0/this.height,
              cx = 2.0/this.width * this.cellWidth * this.ratio,  // FIXME
              cy = 2.0/20;

        const hFrameCoords = [];
        for (let i = 1; i < 20; ++i) {
            const y = i * cy;
            hFrameCoords.push(
                -1, y, 1, y, 1, y+0.5*py,
                1, y+0.5*py, -1, y+0.5*py, -1, y,
            );
        }
        this.numHFramePoints = hFrameCoords.length / 2;
        this.hFrameBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.hFrameBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(hFrameCoords), this.gl.STATIC_DRAW);

        const vFrameCoords = [];
        for (let i = 1; i < this.data.n_wide; ++i) {
            const x = i * cx;
            vFrameCoords.push(
                x, 0, x, 2, x+0.5*px, 2,
                x+0.5*px, 2, x+0.5*px, 0, x, 0
            );
        }
        this.numVFramePoints = vFrameCoords.length / 2;
        this.vFrameBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vFrameBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vFrameCoords), this.gl.STATIC_DRAW);

        const refFrameCoords = [];
        if (this.data.referenceSequenceIndices) {
            let rsi = this.data.referenceSequenceIndices;
            if (this.columnSwizzle) rsi = this.columnSwizzle.map((c) => rsi[c]);
            rsi.forEach((ri, i) => {
                const x = i * cx,
                      y = ri * cy;

                refFrameCoords.push(
                    x, y, x + cx, y, x + cx, y+2*py,
                    x + cx, y+2*py, x, y+2*py, x, y,

                    x, y+cy-1*py, x + cx, y+cy-1*py, x + cx, y+cy+1*py,
                    x + cx, y+cy+1*py, x, y+cy+1*py, x, y+cy-1*py,

                    x, y, x + 2*px, y, x + 2*px, y + cy,
                    x + 2*px, y + cy, x, y + cy, x, y,

                    x + cx - 1*px, y, x + cx + 1*px, y, x + cx + 1*px, y + cy,
                    x + cx + 1*px, y + cy, x + cx - 1 * px, y + cy, x + cx - 1*px, y
                );
            });
        }
        this.numRefFramePoints = refFrameCoords.length / 2;
        this.refFrameBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.refFrameBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(refFrameCoords), this.gl.STATIC_DRAW);
    }

    renderFrames(xOffset, yOffset) {
        this.gl.useProgram(this.frameProgram);
        this.gl.uniform4f(this.frameProgram.u_colour, 0.5, 0.5, 0.5, 1.);
        this.gl.enableVertexAttribArray(this.frameProgram.a_point);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vFrameBuffer);
        this.gl.vertexAttribPointer(this.frameProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttrib2f(this.frameProgram.a_offset, xOffset/this.width*2-1, 1);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numVFramePoints);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.hFrameBuffer);
        this.gl.vertexAttribPointer(this.frameProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttrib2f(this.frameProgram.a_offset, 0, 1);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numHFramePoints);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.refFrameBuffer);
        this.gl.vertexAttribPointer(this.frameProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttrib2f(this.frameProgram.a_offset, xOffset/this.width*2-1, 1);
        if (this.colormapCode === 3) { 
            this.gl.uniform4f(this.frameProgram.u_colour, 0.9, 0.1, 0.1, 1.);
        } else {
            this.gl.uniform4f(this.frameProgram.u_colour, 0., 0., 0., 1.);
        }
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numRefFramePoints);

        this.gl.disableVertexAttribArray(this.frameProgram.a_point);
    }

    render(xOffset, yOffset) {
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.renderCells(xOffset, yOffset);
        this.renderFrames(xOffset, yOffset);
    }

    scrollMax() {
        const seq_len = Math.round(this.data.num_points/20);
        return seq_len*this.cellWidth - this.width/this.ratio;
    }
}


export const HeatMap = (props) => {
    const {
        alignment, xOffset=0, heatmapDataScale, relativeToWT, colorPalette, colName, colName2,
        heatmapDataObject, residueNumbers, updateSelection, swizzle, columnSwizzle: explicitColumnSwizzle,
        paddingRight = 16, cellWidth = 12, stagedMutations, setStagedMutations, isVariantSelectionActive, updateOffset
    } = props;

    const heatmapHeight = 280;
    const legendHeight = 15;
    const canvasRef = useRef();
    const heatmapManagerRef = useRef();
    const legendCanvasRef = useRef();
    const legendRef = useRef();

    const dpr = useDevicePixelRatio({round: false}),
          isHighDPI = dpr > 1.0,
          dpiRatioRounded = isHighDPI ? 2 : 1;

    const {ref: resizerRef, width: totalWidth} = useResizeDetector({
        refreshMode: 'throttle',
        refreshRate: 40
    });
    const width = totalWidth - paddingRight

    const length = useMemo(() => {
        return (alignment || []).map(({seq}) => seq ? seq.length : 0).reduce((a, b) => Math.max(a, b), 0);
    }, [alignment])

    const columnSwizzle = useMemo(() => {
        if (explicitColumnSwizzle) return explicitColumnSwizzle;

        const columnSwizzle = [];
        for (let i = 0; i < length; ++i) columnSwizzle.push(i);
        return columnSwizzle
    }, [explicitColumnSwizzle, length]);

    useLayoutEffect(() => {
        if (canvasRef.current && !heatmapManagerRef.current) {
            heatmapManagerRef.current = new HeatmapManager(canvasRef.current);
            heatmapManagerRef.current.data = heatmapDataObject[colName];
        }
        if (canvasRef.current && !legendRef.current) {
            legendRef.current = new Legend(legendCanvasRef.current);
        }
    });

    const columnObject = heatmapDataObject && heatmapDataObject[colName];
    const minDataVal = columnObject?.minVal,
          maxDataVal = columnObject?.maxVal,
          minDataScaled = columnObject?.minScaled,
          maxDataScaled = columnObject?.maxScaled;

    useLayoutEffect(() => {
        const heatmapData = heatmapDataObject[colName];
        if (!heatmapData) return;        
        heatmapManagerRef.current.data = heatmapData;
        heatmapManagerRef.current.columnSwizzle = columnSwizzle;
        heatmapManagerRef.current.setInstancedAttributeBuffers();
    }, [heatmapDataObject, columnSwizzle, heatmapDataScale, relativeToWT]);

    useLayoutEffect(() => {
        heatmapManagerRef.current.setViewport(((width || 500)|0), heatmapHeight, dpiRatioRounded, cellWidth);
        legendRef.current.setViewport(((width || 500)|0), legendHeight, dpiRatioRounded);
    }, [width, dpiRatioRounded, cellWidth]);

    useLayoutEffect(() => {
        heatmapManagerRef.current.setColorPalette(colorPalette);
        legendRef.current.setColorPalette(colorPalette);
    }, [colorPalette])

    useLayoutEffect(() => {
        if (typeof(minDataScaled) === 'number' && typeof(maxDataScaled) === 'number') {
            legendRef.current.setRange(minDataScaled, maxDataScaled);
        }
    }, [minDataScaled, maxDataScaled]);

    useLayoutEffect(() => {
        heatmapManagerRef.current.createFrameBuffers();
    }, [heatmapDataObject, width, cellWidth, dpiRatioRounded, columnSwizzle]);

    useLayoutEffect(() => {
        heatmapManagerRef.current.render(xOffset * dpiRatioRounded, 0);
        legendRef.current.render();
    }, [
        dpiRatioRounded, xOffset, width, heatmapDataObject, heatmapDataScale,
        relativeToWT, colorPalette, columnSwizzle, stagedMutations
    ]);

    /// ========= HEATMAP MOUSEOVER DATA TAG =========
    const [cellData, setCellData] = useState('');
    const [isCellDataVisible, setIsCellDataVisible] = useState(false);
    const [labelX, setLabelX] = useState(0);
    const [labelY, setLabelY] = useState(0);

    const dragOriginRef = useRef();
    const [isDragging, setIsDragging] = useState(false);
    const onMouseMove = (ev) => {
        const rect = ev.target.getBoundingClientRect();
        const positionX = ev.clientX - rect.left - xOffset;
        const positionY = ev.clientY - rect.top;
        const xDiff = ev.clientX - rect.left 
        setLabelX((xDiff > width - 100) ? xDiff - 100 : xDiff);
        setLabelY(positionY);
        
        if (isDragging) {
            const dx = positionX - dragOriginRef.current.x_0;
            const xMax = heatmapManagerRef.current.scrollMax();
            updateOffset(dx, 0, xMax, 0);
        } else {
            const cellX = columnSwizzle[Math.floor(positionX/cellWidth)];
            const cellY = Math.floor(20*positionY/heatmapHeight);
    
            if (!alignment[0]) return;
            const referenceResidue = (alignment[0].germLine) ? alignment[0].germLine[cellX] : alignment[0].seq[cellX];
            const hoveredResidue = RESIDUES[cellY];
            let value = heatmapManagerRef.current.data.value_array[20*cellX + cellY];
            
            if (value == null) {
                setIsCellDataVisible(false);
                return;
            }
    
            let resNumber = cellX + 1;
            if (!!residueNumbers) resNumber = residueNumbers[cellX];
    
            setCellData(`${referenceResidue}(${resNumber})${hoveredResidue}: ${cleanNumberForDisplay(value, 4)}`);
            setIsCellDataVisible(true);
        }
    }

    const onMouseUp = useCallback((ev) => {
        const dt = (!!dragOriginRef.current?.t_0) ? Date.now() - dragOriginRef.current.t_0 : 0;
        
        if (dt < 200) {
            const rect = ev.target.getBoundingClientRect();
            const positionX = ev.clientX - rect.left - xOffset;
            const positionY = ev.clientY - rect.top;
    
            const cellX = columnSwizzle[Math.floor(positionX/cellWidth)];
            const cellY = Math.floor(20*positionY/heatmapHeight);

            const selection = heatmapDataObject[colName].findEntriesWithResidue(cellX, cellY);
            if (isVariantSelectionActive) {
                const referenceResidue = (alignment[0].germLine) ? alignment[0].germLine[cellX] : alignment[0].seq[cellX];
                const hoveredResidue = RESIDUES[cellY];
        
                let resNumber = cellX + 1;
                if (!!residueNumbers) resNumber = residueNumbers[cellX]
        
                const mutationInfo = {
                    name: `${referenceResidue}${resNumber}${hoveredResidue}`,
                    x: cellX,
                    y: cellY,
                    colName: colName,
                    chain: colName2,
                    from: referenceResidue,
                    to: hoveredResidue,
                    presentInItems: selection ? Array.from(selection) : undefined
                };

                const overlap = stagedMutations.filter(
                    (mut) => (mut.name === mutationInfo.name)
                );

                const newStagedMutations = stagedMutations.filter(
                    (mut) => !(mut.chain === mutationInfo.chain && mut.x === mutationInfo.x)
                );

                if (overlap.length === 0 && mutationInfo.from !== mutationInfo.to) newStagedMutations.push(mutationInfo);

                newStagedMutations.sort((a, b) => a.x - b.x);
                setStagedMutations(newStagedMutations);
            } else {
                if (updateSelection) {
                    updateSelection({
                        op: 'set',
                        item: selection.size > 0 ? selection : undefined,
                        scrollIntoView: true,
                        swizzle
                    });
                }
            }
        }

        setIsDragging(false);
        window.removeEventListener('mouseup', onMouseUp, false);
    }, [xOffset, updateSelection, heatmapDataObject, colName, swizzle, columnSwizzle, cellWidth, isVariantSelectionActive]);

    const onMouseDown = useCallback((ev) => {
        const rect = ev.target.getBoundingClientRect();
        const positionX = ev.clientX - rect.left - xOffset;
        const positionY = ev.clientY - rect.top;

        dragOriginRef.current = {x_0: positionX, y_0: positionY, t_0: Date.now()};

        setIsDragging(true);
        window.addEventListener('mouseup', onMouseUp, false);
    }, [onMouseUp, xOffset]);
    
    return (
        <div ref={resizerRef} style={{position: "relative"}}>
            <Typography
                display={(!isCellDataVisible) ? 'none' : 'inline-block'}
                sx={{
                    zIndex: '8000',
                    position: 'absolute',
                    top: `${labelY - 10}px`,
                    left: `${labelX + 5}px`,
                    fontSize: '1em',
                    backgroundColor: 'white',
                    userSelect: 'none',
                    border: "1px solid",
                    borderRadius: '5px',
                    paddingLeft: '5px',
                    paddingRight: '5px',
                }}
            >
                {cellData}
            </Typography>
            <Stack 
                direction='column'
                sx={{
                    position: 'absolute',
                    textAlign: 'center',
                    bottom: '0px',
                    right: '0px',
                    fontSize: '0.8em',
                    backgroundColor: 'dddddd',
                    userSelect: 'none',
                    fontStyle: ''
                }}
            >
                <b>{ RESIDUES.map((res) => (
                    <div key={res} 
                         style={{height: heatmapHeight / 20}}>
                        {res}
                    </div>
                ))} </b>
            </Stack>
            <div 
                style={{
                    display: 'flex', 
                    flexDirection: 'column', 
                }}
            >
                <canvas
                    id="LegendCanvas"
                    ref={legendCanvasRef}
                    width={((width || 500)|0) * dpiRatioRounded}
                    height={legendHeight * dpiRatioRounded}
                    style={{
                        width: width|0,
                        height: legendHeight,
                        border: '2.5px solid'
                    }}
                />
                <canvas
                    id="HeatmapCanvas"
                    ref={canvasRef}
                    width={((width || 500)|0) * dpiRatioRounded}
                    height={heatmapHeight * dpiRatioRounded}
                    style={{
                        width: width|0,
                        height: heatmapHeight,
                        marginTop: '5px'
                    }}
                    onMouseMove={onMouseMove}
                    onMouseEnter={() => setIsCellDataVisible(true)}
                    onMouseLeave={() => setIsCellDataVisible(false)}
                    onMouseDown={onMouseDown}
                />
                <Typography
                    sx={{
                        position: 'absolute',
                        textAlign: 'center',
                        top: '0px',
                        right: '0px',
                        fontSize: '0.7em',
                        backgroundColor: '#fcfdbf',
                        border: '2px solid',
                        userSelect: 'none',
                        paddingLeft: '5px',
                        paddingRight: '5px',
                    }}
                >
                    {(!!heatmapManagerRef.current) 
                        ? relativeToWT 
                          ? (cleanNumberForDisplay(Math.pow(2, maxDataVal)) || '') + 'x'
                          : cleanNumberForDisplay(maxDataVal, 3) || ''
                        : ''
                    }
                </Typography>


                { relativeToWT ?
                  <div
                        style={{
                            position: 'absolute',
                            textAlign: 'center',
                            top: legendHeight-3,
                            height: '5px',
                            width: '1px',
                            background: 'black',
                            left: (0.5 - minDataScaled) / (maxDataScaled-minDataScaled) * width,
                            userSelect: 'none',
                        }}
                    />
                   : null }

                { relativeToWT ?
                  <Typography
                        sx={{
                            position: 'absolute',
                            textAlign: 'center',
                            top: '0px',
                            left: (0.5 - minDataScaled) / (maxDataScaled-minDataScaled) * width - 15,
                            fontSize: '0.7em',
                            userSelect: 'none',
                            width: 30
                        }}
                    >
                        1x
                    </Typography>
                   : null }


                <Typography
                    sx={{
                        position: 'absolute',
                        textAlign: 'center',
                        top: '0px',
                        left: '0px',
                        fontSize: '0.7em',
                        backgroundColor: '#000004',
                        border: '2px solid',
                        color: '#fcfdbf',
                        userSelect: 'none',
                        paddingLeft: '5px',
                        paddingRight: '5px',
                    }}
                >
                    {(!!heatmapManagerRef.current) 
                        ? relativeToWT 
                          ? (cleanNumberForDisplay(Math.pow(2, minDataVal)) || '') + 'x'
                          : cleanNumberForDisplay(minDataVal, 3) || ''
                        : ''
                    }
                </Typography>
            </div>
        </div>
    )
}
