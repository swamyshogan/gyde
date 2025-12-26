import React, {useRef, useLayoutEffect, useCallback, useReducer, useMemo} from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';
import * as namedColours from 'color-name';
import { setupProgram, systemFontToTexture, useFontsLoaded } from './glUtils';

/*
import raw from 'raw.macro';

const fontLo = raw('./fonts/spleen-8x16.bdf'),
      fontHi = raw('./fonts/spleen-16x32.bdf');
*/

class MSVGraphics {
    constructor(canvas) {
        this.canvas = canvas;
        const gl = this.gl = this.canvas.getContext('webgl');
        if (!gl) {
            throw new Error('WebGL does not seem to be available');
        }
        this.ext_instanced = gl.getExtension('ANGLE_instanced_arrays');

        this.polyProgram = setupProgram(
            this.gl,
            [
                {
                    type: gl.VERTEX_SHADER,
                    script: `
                        attribute vec2 a_point;
                        attribute vec2 a_offset;

                        void main() {
                            gl_Position = vec4(a_point*vec2(1., -1) + a_offset, 0., 1.);
                        }
                    `
                },
                {
                    type: gl.FRAGMENT_SHADER,
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
        this.polyBuffer = gl.createBuffer();
        this.numFramePoints = 0;
        this.polyBufferColumns = gl.createBuffer();
        this.numColumnFramePoints = 0;
        this.markerBuffer = gl.createBuffer();
        this.numMarkerPoints = 0;
        this.hiddenColumnMarkerBuffer = gl.createBuffer();
        this.numHiddenColumnPoints = 0;

        this.cellBackgroundProgram = setupProgram(
            this.gl,
            [
                {
                    type: gl.VERTEX_SHADER,
                    script: `
                        attribute vec2 a_point;
                        attribute vec2 a_mesh_point;
                        attribute vec4 a_background;
                        attribute vec2 a_viewport;
                        attribute vec2 a_offset;
                        attribute vec2 a_cell_size;
                        attribute vec2 a_padding;

                        varying highp vec4 v_background;

                        void main() {
                            vec2 padded_cell_size = a_cell_size + 2. * a_padding;
                            vec2 wgl_point = a_point * padded_cell_size * vec2(1., -1.) * 2. / a_viewport;
                            gl_Position = vec4(wgl_point + (padded_cell_size * 2. / a_viewport * a_mesh_point) + a_offset - vec2(1., -1.), 0.0, 1.0);
                            v_background = a_background;
                        }
                    `
                },
                {
                    type: gl.FRAGMENT_SHADER,
                    script: `
                        precision mediump float;

                        varying highp vec4 v_background;

                        void main() {
                            gl_FragColor = v_background;
                        }
                    `
                }
            ],
            ['a_point', 'a_mesh_point', 'a_background', 'a_offset', 'a_viewport', 'a_cell_size', 'a_padding'],
            ['u_sampler']
        )

        this.cellProgram = setupProgram(
            this.gl,
            [
                {
                    type: gl.VERTEX_SHADER,
                    script: `
                        attribute vec2 a_point;
                        attribute vec2 a_mesh_point;
                        attribute vec2 a_tex_point;
                        attribute vec2 a_tex_mesh_point;
                        attribute vec4 a_foreground;
                        attribute vec2 a_viewport;
                        attribute vec2 a_offset;
                        attribute vec2 a_cell_size;
                        attribute vec2 a_font_size;
                        attribute vec2 a_tex_size;
                        attribute vec2 a_padding;

                        varying highp vec2 v_tex_point;
                        varying highp vec4 v_foreground;

                        void main() {
                            vec2 wgl_point = (a_point * (a_cell_size + 2.* a_padding) + a_padding) * vec2(1., -1.) * 2. / a_viewport; 
                            gl_Position = vec4(wgl_point + (a_cell_size * 2. / a_viewport * a_mesh_point) + a_offset - vec2(1., -1.), 0.0, 1.0);
                            v_tex_point = a_tex_point + a_tex_mesh_point * a_font_size / a_tex_size;
                            v_foreground = a_foreground;
                        }
                    `
                },
                {
                    type: gl.FRAGMENT_SHADER,
                    script: `
                        precision mediump float;

                        varying highp vec2 v_tex_point;
                        varying highp vec4 v_foreground;
                        uniform sampler2D u_sampler;

                        void main() {
                            vec4 s = texture2D(u_sampler, v_tex_point);
                            gl_FragColor = v_foreground * (1.0 - s.r);
                        }
                    `
                }
            ],
            ['a_point', 'a_mesh_point', 'a_tex_point', 'a_tex_mesh_point', 'a_foreground',
             'a_offset', 'a_viewport', 'a_cell_size', 'a_font_size', 'a_tex_size', 'a_padding'],
            ['u_sampler']
        )

        this.pointBuffer = gl.createBuffer();
        this.texBuffer = gl.createBuffer();
        this.bgBuffer = gl.createBuffer();
        this.fgBuffer = gl.createBuffer();

        /*
        this.fontLo = this.fontToTexture(this.parseFont(fontLo));
        this.fontHi = this.fontToTexture(this.parseFont(fontHi));

        // this.fontLo = this.fontHi = this.systemFontToTexture('34px courier');
        // this.fontLo = this.fontHi = this.systemFontToTexture('36px Inconsolata');

        this.font = this.fontLo;
        */

        this.mesh = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                0., 0., 1., 0., 1., -1.,
                1., -1., 0., -1., 0., 0.
            ]),
            gl.STATIC_DRAW
        );

        this.charMesh = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.charMesh);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                0., 0.,
                1., 0.,
                1., 1.,

                1., 1.,
                0., 1.,
                0., 0.
            ]),
            gl.STATIC_DRAW
        );

        this.colourCache = {};
        this.xPadding = 0;
        this.yPadding = 0;
    }

    takeColour(array, fn, alignment, index) {
        let c = fn(alignment, index);

        try {
            if (! (c instanceof Array)) {
                if (this.colourCache[c]) {
                    c = this.colourCache[c]
                } else {
                    const cn = c;
                    if (namedColours[c]) {  
                        c = namedColours[c];
                    } else if (c.length === 7 && c[0] === '#') {
                        c = [parseInt(c.substring(1, 3), 16), parseInt(c.substring(3, 5), 16), parseInt(c.substring(5, 7), 16)]
                    } else if (c.length === 4 && c[0] === '#') {
                        c = [
                            parseInt(c.substring(1, 2), 16),
                            parseInt(c.substring(2, 3), 16),
                            parseInt(c.substring(3, 4), 16)
                        ].map((x) => x*0x11);
                    } else {
                        throw Error('Colour function must return an array, or a colour name, got ' + c.toString());
                    }
                    this.colourCache[cn] = c;
                }
            } 

            if (c.length === 3) {
                array.push(...c, 255);
            } else if (c.length === 4) {
                array.push(...c);
            } else {
                throw Error(`Colour function must return arrays of length 3 or 4, got ${c.length}`);
            }
        } catch (err) {
            if (!this.colourErr) {
                console.log('Bad colour function: ' + err.message)
                this.colourErr = true;
            }

            array.push(0, 0, 0, 255);
        }

    }

    prepData(alignment, columnSwizzle, fgColourFN, bgColourFN, minIndex, maxIndex) {
        const points = [],
              charPoints = [],
              colours = [],
              fgColours = [],
              cw = this.font.charWidth,
              ch = this.font.charHeight,
              textureSize = this.font.textureSize;
        let maxX = 0;

        minIndex = Math.max(0, minIndex ?? 0); maxIndex = Math.min(alignment.length - 1, maxIndex ?? alignment.length);

        for (let y = minIndex; y <= maxIndex; ++y) {
            const am = alignment[y],
                  seq = am.seq || '';
            for (let xx = 0; xx < (columnSwizzle ? columnSwizzle.length : seq.length); ++xx) {
                const x = columnSwizzle ? columnSwizzle[xx] : xx;
                if (x > seq.length) continue;

                points.push(xx, y);
                const cc = seq.charCodeAt(x),
                      cx = cc % this.font.charsPerRow,
                      cy = (cc / this.font.charsPerRow)|0;
                charPoints.push(cx*cw/textureSize, cy*ch/textureSize);
                this.takeColour(colours, bgColourFN, am, x);
                this.takeColour(fgColours, fgColourFN, am, x);

                maxX = Math.max(xx, maxX)
            }
        }

        return {
            points: new Float32Array(points),
            charPoints: new Float32Array(charPoints),
            colours: new Uint8Array(colours),
            fgColours: new Uint8Array(fgColours),
            maxX: maxX,
            maxY: alignment.length
        };
    }

    updateAlignment(alignment, columnSwizzle, fgColourFN, bgColourFN, minIndex, maxIndex) {
        const {points, charPoints, colours, fgColours, maxX, maxY} = this.prepData(alignment, columnSwizzle, fgColourFN, bgColourFN, minIndex, maxIndex);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, points, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, charPoints, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bgBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colours, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.fgBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, fgColours, this.gl.STATIC_DRAW);

        this.numPoints = points.length / 2;
        this.maxX = maxX;
        this.maxY = maxY;
    }

    renderCells(xOffset, yOffset) {
        this.gl.useProgram(this.cellBackgroundProgram);

        this.gl.enableVertexAttribArray(this.cellBackgroundProgram.a_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointBuffer);
        this.gl.vertexAttribPointer(this.cellBackgroundProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellBackgroundProgram.a_point, 1);

        this.gl.enableVertexAttribArray(this.cellBackgroundProgram.a_background);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bgBuffer);
        this.gl.vertexAttribPointer(this.cellBackgroundProgram.a_background, 4, this.gl.UNSIGNED_BYTE, true, 0, 0);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellBackgroundProgram.a_background, 1);

        this.gl.enableVertexAttribArray(this.cellBackgroundProgram.a_mesh_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mesh);
        this.gl.vertexAttribPointer(this.cellBackgroundProgram.a_mesh_point, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.vertexAttrib2f(this.cellBackgroundProgram.a_offset, xOffset/this.width*2, -yOffset/this.height*2);
        this.gl.vertexAttrib2f(this.cellBackgroundProgram.a_viewport, this.width, this.height);
        this.gl.vertexAttrib2f(this.cellBackgroundProgram.a_cell_size, (this.cellWidth - this.xPadding*2)*this.ratio, (this.cellHeight - this.yPadding*2)*this.ratio);
        this.gl.vertexAttrib2f(this.cellBackgroundProgram.a_padding, this.xPadding * this.ratio, this.yPadding * this.ratio);

        this.ext_instanced.drawArraysInstancedANGLE(this.gl.TRIANGLES, 0, 6, this.numPoints);

        this.gl.disableVertexAttribArray(this.cellBackgroundProgram.a_point);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellBackgroundProgram.a_point, 0);
        this.gl.disableVertexAttribArray(this.cellBackgroundProgram.a_background);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellBackgroundProgram.a_background, 0);
        this.gl.disableVertexAttribArray(this.cellBackgroundProgram.a_mesh_point);
 
        this.gl.useProgram(this.cellProgram);
        
        this.gl.enableVertexAttribArray(this.cellProgram.a_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointBuffer);
        this.gl.vertexAttribPointer(this.cellProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellProgram.a_point, 1);

        this.gl.enableVertexAttribArray(this.cellProgram.a_tex_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texBuffer);
        this.gl.vertexAttribPointer(this.cellProgram.a_tex_point, 2, this.gl.FLOAT, false, 0, 0);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellProgram.a_tex_point, 1);

        this.gl.enableVertexAttribArray(this.cellProgram.a_foreground);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.fgBuffer);
        this.gl.vertexAttribPointer(this.cellProgram.a_foreground, 4, this.gl.UNSIGNED_BYTE, true, 0, 0);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellProgram.a_foreground, 1);

        this.gl.enableVertexAttribArray(this.cellProgram.a_mesh_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mesh);
        this.gl.vertexAttribPointer(this.cellProgram.a_mesh_point, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.enableVertexAttribArray(this.cellProgram.a_tex_mesh_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.charMesh);
        this.gl.vertexAttribPointer(this.cellProgram.a_tex_mesh_point, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.vertexAttrib2f(this.cellProgram.a_offset, xOffset/this.width*2, -yOffset/this.height*2);
        this.gl.vertexAttrib2f(this.cellProgram.a_viewport, this.width, this.height);
        this.gl.vertexAttrib2f(this.cellProgram.a_cell_size, (this.cellWidth - this.xPadding*2)*this.ratio, (this.cellHeight - this.yPadding*2)*this.ratio);
        this.gl.vertexAttrib2f(this.cellProgram.a_font_size, this.font.charWidth, this.font.charHeight);
        this.gl.vertexAttrib2f(this.cellProgram.a_tex_size, this.font.textureSize, this.font.textureSize);
        this.gl.vertexAttrib2f(this.cellProgram.a_padding, this.xPadding * this.ratio, this.yPadding * this.ratio);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.font.texture);
        this.gl.uniform1i(this.cellProgram.u_sampler, 0);

        this.ext_instanced.drawArraysInstancedANGLE(this.gl.TRIANGLES, 0, 6, this.numPoints);

        this.gl.disableVertexAttribArray(this.cellProgram.a_point);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellProgram.a_point, 0);
        this.gl.disableVertexAttribArray(this.cellProgram.a_tex_point);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellProgram.a_tex_point, 0);
        this.gl.disableVertexAttribArray(this.cellProgram.a_foreground);
        this.ext_instanced.vertexAttribDivisorANGLE(this.cellProgram.a_foreground, 0);
        this.gl.disableVertexAttribArray(this.cellProgram.a_mesh_point);
        this.gl.disableVertexAttribArray(this.cellProgram.a_tex_mesh_point);
    }

    updateFrames(indices) {
        const points = [];

        {
            const ranges = [];
            {
                const sortedIndices = [...indices, 1e31];
                sortedIndices.sort((a, b) => a-b);

                let rangeStart = -1e20, rangeEnd = -1e20;
                for (const j of sortedIndices) {
                    if (j === (rangeEnd + 1)) {
                        rangeEnd = j;
                    } else {
                        if (rangeStart >= 0) ranges.push([rangeStart, rangeEnd]);
                        rangeStart = rangeEnd = j;
                    }
                }
            }

            
            for (const [start, end] of ranges) {
                const rowHeight = this.cellHeight * this.ratio / this.height * 2,
                      y = start * rowHeight,
                      h = (end-start+1) * rowHeight,
                      dx = 2 * 2 / this.width * this.ratio,
                      dy = 2 * 2 / this.height * this.ratio;

                points.push(
                    -1, y, 1, y, 1, y+dy,
                    1, y+dy, -1, y+dy, -1, y,

                    -1, y, -1, y + h, dx-1, y + h,
                    dx-1, y+h, dx-1, y, -1, y,

                    1-dx, y, 1-dx, y+h, 1, y+h,
                    1, y+h, 1, y, 1-dx, y,

                    -1, y+h-dy, 1, y+h-dy, 1, y+h,
                    1, y+h, -1, y+h, -1, y+h-dy
                );

            }
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.polyBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(points), this.gl.STATIC_DRAW);
        this.numFramePoints = points.length / 2;
    }

    updateColumnFrames(columnIndices, invertSwizzle) {
        const points = [];

        if (columnIndices) {
            const ranges = [];
            {
                const sortedIndices = [1e31];
                for (const ci of columnIndices) {
                    const isci = invertSwizzle[ci];
                    if (typeof(isci) === 'number') sortedIndices.push(isci);
                }
                sortedIndices.sort((a, b) => a-b);

                let rangeStart = -1e20, rangeEnd = -1e20;
                for (const j of sortedIndices) {
                    if (j === (rangeEnd + 1)) {
                        rangeEnd = j;
                    } else {
                        if (rangeStart >= 0) ranges.push([rangeStart, rangeEnd]);
                        rangeStart = rangeEnd = j;
                    }
                }
            }

            for (const [start, end] of ranges) {
                const rowWidth = this.cellWidth * this.ratio / this.width * 2,
                      x = start * rowWidth,
                      w = (end-start+1) * rowWidth,
                      dx = 2 * 2 / this.width * this.ratio,
                      dy = 2 * 2 / this.height * this.ratio;

                points.push(
                    x, -1, x, 1, x+dx, 1,
                    x+dx, 1, x+dx, -1, x, -1,

                    x, -1, x+w, -1, x+w, dy-1,
                    x+w, dy-1, x, dy-1, x, -1,

                    x, 1-dy, x+w, 1-dy, x+w, 1,
                    x, 1-dy, x+w, 1, x, 1, 

                    x+w-dx, -1, x+w-dx, 1, x+w, 1,
                    x+w, 1, x+w, -1, x+w-dx, -1
                );

            }

        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.polyBufferColumns);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(points), this.gl.STATIC_DRAW);
        this.numColumnFramePoints = points.length / 2;
    }

    updateHiddenColumnMarkers(hiddenColumnMarkers) {
        const points = [];

        if (hiddenColumnMarkers) {
            for (const {position} of hiddenColumnMarkers) {
                const rowWidth = this.cellWidth * this.ratio / this.width * 2,
                      x = position * rowWidth,
                      dx = 2 * 2 / this.width * this.ratio,
                      dy = 2 * 2 / this.height * this.ratio;

                points.push(
                    x, -1, x, 1, x+dx, 1,
                    x+dx, -1, x+dx, 1, x, -1
                );
            }
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.hiddenColumnMarkerBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(points), this.gl.STATIC_DRAW);
        this.numHiddenColumnPoints = points.length / 2;
    }

    renderFrames(xOffset, yOffset) {
        if (!this.numFramePoints) return;

        this.gl.useProgram(this.polyProgram);

        this.gl.enableVertexAttribArray(this.polyProgram.a_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.polyBuffer);
        this.gl.vertexAttribPointer(this.polyProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.vertexAttrib2f(this.polyProgram.a_offset, 0, 1-yOffset/this.height*2)

        this.gl.uniform4f(this.polyProgram.u_colour, 1., 0., 0., .8);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numFramePoints);

        this.gl.disableVertexAttribArray(this.polyProgram.a_point);
    }

    renderColumnFrames(xOffset, yOffset) {
        if (!this.numColumnFramePoints) return;

        this.gl.useProgram(this.polyProgram);

        this.gl.enableVertexAttribArray(this.polyProgram.a_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.polyBufferColumns);
        this.gl.vertexAttribPointer(this.polyProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.vertexAttrib2f(this.polyProgram.a_offset, xOffset/this.width*2-1, 0)

        this.gl.uniform4f(this.polyProgram.u_colour, 1., 0., 0., .8);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numColumnFramePoints);

        this.gl.disableVertexAttribArray(this.polyProgram.a_point);
    }

    renderHiddenColumnMarkers(xOffset, yOffset) {
        if (!this.numHiddenColumnPoints) return;

        this.gl.useProgram(this.polyProgram);

        this.gl.enableVertexAttribArray(this.polyProgram.a_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.hiddenColumnMarkerBuffer);
        this.gl.vertexAttribPointer(this.polyProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.vertexAttrib2f(this.polyProgram.a_offset, xOffset/this.width*2-1, 0)

        this.gl.uniform4f(this.polyProgram.u_colour, 0., 0., 0., .5);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numHiddenColumnPoints);

        this.gl.disableVertexAttribArray(this.polyProgram.a_point);
    }

    updateMarkers(markers) {
        const points = [];
        for (const {row, column} of markers) {
            const pad = this.yPadding * this.ratio * 2,
                  rowHeight = this.cellHeight * this.ratio / this.height * 2,
                  colWidth = (this.cellWidth) * this.ratio / this.width * 2,
                  y = (row+1) * rowHeight,
                  x = column * colWidth,
                  dx = 2 * 2 / this.width * this.ratio,
                  dy = 2 * 2 / this.height * this.ratio;

            points.push(
                x, y-2*dy, x+colWidth, y-2*dy, x+colWidth/2, y+0*dy
            );
        }

        if (points.length > 0) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.markerBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(points), this.gl.STATIC_DRAW);
        }
        this.numMarkerPoints = points.length/2;
    }

    renderMarkers(xOffset, yOffset) {
        if (!this.numMarkerPoints) return;

        this.gl.useProgram(this.polyProgram);

        this.gl.enableVertexAttribArray(this.polyProgram.a_point);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.markerBuffer);
        this.gl.vertexAttribPointer(this.polyProgram.a_point, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.vertexAttrib2f(this.polyProgram.a_offset, xOffset/this.width*2-1, 1-yOffset/this.height*2)

        this.gl.uniform4f(this.polyProgram.u_colour, 1., 0., 0., .8);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numMarkerPoints);

        this.gl.disableVertexAttribArray(this.polyProgram.a_point);
    }

    render(xOffset, yOffset) {
        this.gl.clearColor(0.95, 0.95, 0.95, 1.);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        this.renderCells(xOffset, yOffset);
        this.renderHiddenColumnMarkers(xOffset, yOffset);
        this.renderMarkers(xOffset, yOffset);
        this.renderFrames(xOffset, yOffset);
        this.renderColumnFrames(xOffset, yOffset);
    }

    parseFont(bdfData) {
        const chars = {};
        let char;

        for (const line of bdfData.split('\n')) {
            const tokens = line.split(' ');
            if (char?.bitmap) {
                if (line === 'ENDCHAR') {
                    chars[char.codePoint] = char;
                    char = null;
                } else {
                    const b = parseInt(line, 16),
                          bl = 4 * line.length;
                    const bm = [];
                    for (let i = 0; i < char.width; ++i) {
                        bm.push(!!(b & (1<<(bl-i-1))) ? 1 : 0);
                    }
                    char.bitmap.push(bm);
                }
            } else if (tokens[0] === 'STARTCHAR') {
                char = {
                    name: tokens[1]
                };
            } else if (tokens[0] === 'ENCODING') {
                char.codePoint = parseInt(tokens[1])
            } else if (tokens[0] === 'BBX') {
                char.width = parseInt(tokens[1]);
                char.height = parseInt(tokens[2]);
            } else if (tokens[0] === 'BITMAP') {
                char.bitmap = [];
            }
        }

        return chars;
    }

    setViewport(width, height, ratio) {
        width *= ratio;
        height *= ratio;

        this.width = width;
        this.height = height;
        this.gl.viewport(0, 0, width, height);

        this.ratio = ratio;
    }

    setCellSize(cellWidth, cellHeight, cellPaddingX, cellPaddingY) {
        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight
        this.xPadding = cellPaddingX;
        this.yPadding = cellPaddingY;
    }

    setFont(systemFont, systemFontScale) {
        if (this.systemFont) {
            this.gl.deleteTexture(this.systemFont.texture);
            this.systemFont = null;
        }

        if (!systemFont) {
            this.font = this.ratio > 1 ? this.fontHi : this.fontLo;
        } else {
            const cw = (this.cellWidth - this.xPadding*2)*this.ratio,
                  ch = (this.cellHeight - this.yPadding*2)*this.ratio;
            this.font = this.systemFont =
                systemFontToTexture(this.gl, systemFont, cw, ch, systemFontScale, 128);
        }
    }

    scrollMax() {
        return [(this.maxX+1)*this.cellWidth - this.width/this.ratio, this.maxY*this.cellHeight - this.height/this.ratio];
    }
}

function defaultFG() {
    return [0, 0, 0, 255];
}

function defaultBG() {
    return [255, 255, 255, 255];
}

export default function MSView({
    alignment,
    markers=[],
    xOffset=0,
    yOffset=0,
    fgColour=defaultFG,
    bgColour=defaultBG,
    updateOffset,
    selection,
    selectedColumns,
    onClick,
    cellWidth=8,
    cellHeight=14,
    cellPaddingX=2,
    cellPaddingY=2,
    systemFont,
    systemFontScale=0.9,
    swizzle=null,
    columnSwizzle: explicitColumnSwizzle,
    hiddenColumnMarkers,
    height=500
}) 
{

    
    const visMin = (-yOffset / cellHeight)|0,
          visMax = 1 + ((height - yOffset) / cellHeight)|0,
          blockMin = Math.max(0, 50*Math.floor((visMin-20) / 50)),
          blockMax = blockMin + 50*Math.ceil((visMax-blockMin + 20)/50);

    const fontsLoaded = useFontsLoaded();
    const [restoredCount, bumpRestoredCount] = useReducer((a, b) => a+b, 0);

    const canvasRef = useRef(),
        gfxRef = useRef(),
        dragOriginRef = useRef(),
        offsetRef = useRef(),
        offsetXRef = useRef(),
        swizzleRef = useRef(),
        columnSwizzleRef = useRef();

    const length = useMemo(() => {
        return (alignment || []).map(({seq}) => seq ? seq.length : 0).reduce((a, b) => Math.max(a, b), 0);
    }, [alignment])

    const columnSwizzle = useMemo(() => {
        if (explicitColumnSwizzle) return explicitColumnSwizzle;

        const columnSwizzle = [];
        for (let i = 0; i < length; ++i) columnSwizzle.push(i);
        return columnSwizzle
    }, [explicitColumnSwizzle, length]);

    const invertSwizzle = useMemo(() => {
        const invertSwizzle = new Array(length);
        columnSwizzle.forEach((s, i) => {invertSwizzle[s] = i});
        return invertSwizzle;
    }, [columnSwizzle, length]);

    offsetRef.current = yOffset;
    offsetXRef.current = xOffset;
    swizzleRef.current = swizzle;
    columnSwizzleRef.current = columnSwizzle;

    const {ref: resizerRef, width /*, height*/} = useResizeDetector({
        refreshMode: 'throttle',
        refreshRate: 40
    });

    const dpr = useDevicePixelRatio({round: false}),
          isHighDPI = dpr > 1.0,
          dpiRatioRounded = isHighDPI ? 2 : 1;

    let onMouseMove, onMouseUp;

    onMouseMove = useCallback(
        (ev) => {
            const bbox = canvasRef.current.getBoundingClientRect(),
                  canX = ev.clientX - bbox.x, canY = ev.clientY - bbox.y;
            const {lastX, lastY} = dragOriginRef.current,
                  dX = canX - lastX, 
                  dY = canY - lastY;
            if (dX || dY) {
                updateOffset(dX, dY, ...gfxRef.current.scrollMax());
            }

            dragOriginRef.current = {...dragOriginRef.current, lastX: canX, lastY: canY};
        },
        [canvasRef, dragOriginRef, updateOffset, gfxRef]
    );

    onMouseUp = useCallback(
        (ev) => {
            const bbox = canvasRef.current.getBoundingClientRect(),
                  canX = ev.clientX - bbox.x, canY = ev.clientY - bbox.y;
            const {lastX, lastY, oriX, oriY} = dragOriginRef.current,
                  dX = canX - lastX, 
                  dY = canY - lastY;
            if (dX || dY) {
                dragOriginRef.current = null;
                updateOffset(dX, dY, ...gfxRef.current.scrollMax());
            }
            window.removeEventListener('mousemove', onMouseMove, false);
            window.removeEventListener('mouseup', onMouseUp, false);

            const moved = Math.sqrt(Math.pow(canX-oriX, 2) + Math.pow(canY-oriY, 2))

            if (moved < 3 && onClick) {
                const scaledY = (canY - offsetRef.current)*gfxRef.current.ratio;
                const scaledX = (canX - offsetXRef.current)*gfxRef.current.ratio;
                const cellHeight = gfxRef.current.cellHeight * gfxRef.current.ratio;
                const cellWidth = gfxRef.current.cellWidth * gfxRef.current.ratio;
                const item = (scaledY/cellHeight)|0;
                onClick({
                    item: swizzleRef.current ? swizzleRef.current[item] : item,
                    column: columnSwizzleRef.current[(scaledX/cellWidth)|0],
                    shiftKey: ev.shiftKey,
                    altKey: ev.altKey,
                    ctrlKey: ev.ctrlKey,
                    metaKey: ev.metaKey,
                    swizzle: swizzleRef.current
                });
            }
        },
        [onMouseMove, canvasRef, dragOriginRef, updateOffset, onClick, offsetRef, offsetXRef, gfxRef, swizzleRef]
    );

    const onMouseDown = useCallback(
        (ev) => {
            const bbox = canvasRef.current.getBoundingClientRect(),
                  canX = ev.clientX - bbox.x, canY = ev.clientY - bbox.y;

            dragOriginRef.current = {oriX: canX, lastX: canX, oriY: canY, lastY: canY};

            window.addEventListener('mousemove', onMouseMove, false);
            window.addEventListener('mouseup', onMouseUp, false);
        },
        [onMouseMove, onMouseUp, canvasRef, dragOriginRef]
    );


    // Currently everyting that interacts with the GL context runs as
    // a layout effect.  This seems excessive, but if we draw in a
    // "plain" effect there is visible flicker when resizing the 
    // canvas.
    //
    // A possible (not yet tested) alternative would be to defer the
    // changes to the canvas size (set the explicitly in an effect, rather
    // than using react props).

    useLayoutEffect(() => {
        if (!gfxRef.current) {
            gfxRef.current = new MSVGraphics(canvasRef.current);
            canvasRef.current.addEventListener('webglcontextlost', (ev) => {
                ev.preventDefault();
            });
            canvasRef.current.addEventListener('webglcontextrestored', (ev) => {
                ev.preventDefault();
                gfxRef.current = new MSVGraphics(canvasRef.current);
                bumpRestoredCount(1);
            });
        }
    });

    useLayoutEffect(() => {
        gfxRef.current.setViewport((width || 500)|0, (height || 500)|0, dpiRatioRounded);
    }, [width, height, dpiRatioRounded, restoredCount]);

    useLayoutEffect(() => {
        gfxRef.current.setCellSize(cellWidth, cellHeight, cellPaddingX, cellPaddingY);
    }, [cellWidth, cellHeight, cellPaddingX, cellPaddingY, restoredCount]);

    useLayoutEffect(() => {
        gfxRef.current.setFont(systemFont, systemFontScale);
    }, [cellWidth, cellHeight, cellPaddingX, cellPaddingY, dpiRatioRounded, systemFont, systemFontScale, fontsLoaded, restoredCount]);

    useLayoutEffect(() => {
        if (swizzle) {
            const swizzledSelection = selection.flatMap((s) => {
                const i = swizzle.indexOf(s);
                if (i >= 0) return [i]; 
            });
            gfxRef.current.updateFrames(swizzledSelection);
        } else {
            gfxRef.current.updateFrames(selection);
        }
    }, [width, height, cellWidth, cellHeight, cellPaddingX, cellPaddingY, selection, swizzle, dpiRatioRounded, restoredCount]);

    useLayoutEffect(() => {
        gfxRef.current.updateColumnFrames(selectedColumns, invertSwizzle);
    }, [width, height, selectedColumns, invertSwizzle, dpiRatioRounded, restoredCount]);

    useLayoutEffect(() => {
        let useMarkers = markers;
        if (swizzle) {
            const swizzledMarkers = markers.flatMap((marker) => {
                const i = swizzle.indexOf(marker.row);
                if (i >= 0) {
                    return {...marker, row: i};
                } else {
                    return []
                }
            });
            useMarkers = swizzledMarkers;
        } else {
            gfxRef.current.updateMarkers(markers);
        }

        useMarkers = useMarkers.flatMap((marker) => {
            const si = invertSwizzle[marker.column];
            if (typeof(si) === 'number') {
                return [{...marker, column: si}];
            } else {
                return [];
            }
        });

        gfxRef.current.updateMarkers(useMarkers);
    }, [markers, swizzle, dpiRatioRounded, width, restoredCount, invertSwizzle]);

    useLayoutEffect(() => {
        const swizzledAlignment = swizzle
            ? swizzle.map((i) => alignment[i] || {})
            : alignment;
        gfxRef.current.updateAlignment(swizzledAlignment, columnSwizzle, fgColour, bgColour, blockMin, blockMax);
    }, [alignment, swizzle, columnSwizzle, fgColour, bgColour, dpiRatioRounded, restoredCount,
        blockMin, blockMax, cellWidth, cellHeight]);  /* NB this currently depends on resolution,
                                                         since locations of glyphs may have changed. */

    useLayoutEffect(() => {
        gfxRef.current.updateHiddenColumnMarkers(hiddenColumnMarkers)
    }, [alignment, hiddenColumnMarkers, width, restoredCount]);

    useLayoutEffect(() => {
        gfxRef.current.render(xOffset * dpiRatioRounded, yOffset * dpiRatioRounded);
    }, [xOffset, yOffset, alignment, swizzle, fgColour, bgColour, width, height, selection, selectedColumns,
        dpiRatioRounded, cellWidth, cellHeight, fontsLoaded, markers, restoredCount, systemFont, systemFontScale,
        columnSwizzle, hiddenColumnMarkers]);

    return (
        <div style={{width: '100%'}} ref={resizerRef}>
            <canvas 
                width={((width || 500)|0) * dpiRatioRounded}
                height={((height || 500)|0) * dpiRatioRounded}
                ref={canvasRef}
                onMouseDown={onMouseDown}
                style={{
                    width: width|0,
                    height: height|0
                }}
            />
        </div>
    )
}
