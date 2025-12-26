import React, { useLayoutEffect, useRef, useMemo } from "react";
import { useResizeDetector } from 'react-resize-detector';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';
import { setupProgram, systemFontToScaledTexture, useFontsLoaded } from "./glUtils"
import { getResidueHeights, getSortedResidueHeights, getSequenceLogoBufferArrays } from './sequenceLogoUtils';

class SequenceLogoGlData {
    sequenceLogoProgram;
    positionBuffer;
    canvas;
    gl;
    logo_data;

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

        this.createProgram();
        this.createPositionBuffers();
    }

    parseAlignment(alignment, columnSwizzle, filter) {
        let filtered_alignment = alignment;
        if (filter) {
            filtered_alignment = alignment.filter((_, index) => filter.has(index));
        }

        let arrays;
        if (filtered_alignment.length > 0) {
            const allHeights = getResidueHeights(filtered_alignment);
            const heights = columnSwizzle.map((s) => allHeights[s]);
            const sorted_residues = getSortedResidueHeights(heights);
            arrays = getSequenceLogoBufferArrays(sorted_residues);
        } else {
            arrays = {heights: [], offsets: [], charCodes: []}
        }
        
        this.sl_height_array = arrays.heights;
        this.sl_offset_array = arrays.offsets;
        this.charCodesToTexPoints(arrays.charCodes);

        this.num_points = this.sl_height_array.length;

        this.setNoninstancedAttributes();
        this.setInstancedAttributeBuffers();
    }

    createProgram() {
        this.sequenceLogoProgram = setupProgram(
            this.gl,
            [
                {type: this.gl.VERTEX_SHADER,
                script: `
                    attribute vec2 a_position;
                    attribute vec2 a_viewport;
                    attribute vec2 a_instance_offset;
                    attribute float a_instance_height;
                    attribute vec2 a_tex_point;
                    attribute vec2 a_char_mesh_point;
                    attribute vec2 a_font_size;
                    attribute vec2 a_tex_size;
                    attribute vec2 ratio;
                    attribute vec2 global_offset;

                    varying highp vec2 v_tex_point;

                    attribute vec2 cell_dims;
                    
                    void main() {
                        vec2 local_scale = ratio * cell_dims / a_viewport;
                        vec2 scaled_global_offset = 2. * global_offset / a_viewport;
                        vec2 center_correction = vec2(local_scale.x, 0.0);

                        vec2 vertex_position = vec2(1.0, -a_instance_height) * a_position * local_scale;
                        vec2 pixel_offset = scaled_global_offset + a_instance_offset * local_scale - vec2(1.0, 1.0);

                        v_tex_point = a_tex_point + a_char_mesh_point * a_font_size / a_tex_size;

                        gl_Position = vec4(vertex_position + pixel_offset, 0.0, 1.0);
                    }
                `},
                {type: this.gl.FRAGMENT_SHADER,
                script: `
                    precision mediump float;

                    varying highp vec2 v_tex_point;
                    uniform sampler2D u_sampler;

                    void main() {
                        vec4 s = texture2D(u_sampler, v_tex_point);
                        gl_FragColor = vec4(s.r, s.r, s.r, 1.0);
                    }
                `}
            ],
            ['a_position', 'a_viewport', 'a_instance_height', 'a_instance_offset', 'a_font_size', 'a_tex_size', 
            'a_tex_point', 'a_char_mesh_point', 'ratio', 'global_offset', 'cell_dims'],
            ['u_sampler']
        );
        this.gl.useProgram(this.sequenceLogoProgram);
    }

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

        const positionAttributeLocation = this.sequenceLogoProgram.a_position;
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, true, 0, 0);

        this.charMesh = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.charMesh);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            new Float32Array([
                0.0, 0.0,
                1.0, 0.0,
                0.0, 1.0,

                0.0, 1.0,
                1.0, 0.0,
                1.0, 1.0
            ]),
            this.gl.STATIC_DRAW
        );

        const texPositionAttributeLocation = this.sequenceLogoProgram.a_char_mesh_point;
        this.gl.enableVertexAttribArray(texPositionAttributeLocation);
        this.gl.vertexAttribPointer(texPositionAttributeLocation, 2, this.gl.FLOAT, true, 0, 0);
    }

    setFont(systemFont, systemFontScale) {
        this.font = systemFontToScaledTexture(this.gl, systemFont, 128, 128, systemFontScale, 128);
    }

    createFontTexture() {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.font.texture);
        this.gl.uniform1i(this.sequenceLogoProgram.u_sampler, 0);
    }

    charCodesToTexPoints(charCodes) {
        this.sl_text_array = [];
        const cw = this.font.charWidth;
        const ch = this.font.charHeight;
        const textureSize = this.font.textureSize;

        for (let i = 0; i < charCodes.length; i++) {
            const charCode = charCodes[i];
            const cx = charCode % this.font.charsPerRow;
            const cy = (charCode / this.font.charsPerRow)|0;

            this.sl_text_array.push(cx*cw/textureSize, cy*ch/textureSize);
        }
    }
    
    setInstancedAttributeBuffers() {
        this.heightBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.heightBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.sl_height_array), this.gl.STATIC_DRAW);
        
        this.gl.enableVertexAttribArray(this.sequenceLogoProgram.a_instance_height);
        this.gl.vertexAttribPointer(this.sequenceLogoProgram.a_instance_height, 1, this.gl.FLOAT, true, 0, 0);
        this.ext.vertexAttribDivisorANGLE(this.sequenceLogoProgram.a_instance_height, 1);
        
        this.offsetBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.offsetBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.sl_offset_array), this.gl.STATIC_DRAW);

        this.gl.enableVertexAttribArray(this.sequenceLogoProgram.a_instance_offset);
        this.gl.vertexAttribPointer(this.sequenceLogoProgram.a_instance_offset, 2, this.gl.FLOAT, true, 0, 0);
        this.ext.vertexAttribDivisorANGLE(this.sequenceLogoProgram.a_instance_offset, 1);

        this.texBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.sl_text_array), this.gl.STATIC_DRAW);

        this.gl.enableVertexAttribArray(this.sequenceLogoProgram.a_tex_point);
        this.gl.vertexAttribPointer(this.sequenceLogoProgram.a_tex_point, 2, this.gl.FLOAT, false, 0, 0);
        this.ext.vertexAttribDivisorANGLE(this.sequenceLogoProgram.a_tex_point, 1);
    }

    setNoninstancedAttributes() {
        this.gl.vertexAttrib2f(this.sequenceLogoProgram.a_viewport, this.width, this.height);
        this.gl.vertexAttrib2f(this.sequenceLogoProgram.a_font_size, this.font.charWidth, this.font.charHeight);
        this.gl.vertexAttrib2f(this.sequenceLogoProgram.a_tex_size, this.font.textureSize, this.font.textureSize);
        this.gl.vertexAttrib2f(this.sequenceLogoProgram.ratio, this.ratio, this.ratio);
        this.gl.vertexAttrib2f(this.sequenceLogoProgram.cell_dims, this.cellWidth * 2, 140);
    }
    
    setViewport(width, height, ratio) {
        this.width = width * ratio;
        this.height = height * ratio;
        this.ratio = ratio;
        
        this.gl.vertexAttrib2f(this.sequenceLogoProgram.ratio, this.ratio, this.ratio);
        this.gl.vertexAttrib2f(this.sequenceLogoProgram.a_viewport, this.width, this.height);
        this.gl.viewport(0, 0, this.width, this.height);
    }

    render(xOffset, yOffset) {
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.vertexAttrib2f(this.sequenceLogoProgram.global_offset, xOffset, 0);
        
        this.ext.drawArraysInstancedANGLE(this.gl.TRIANGLES, 0, 6, this.num_points);
    }
}

export const SequenceLogo = ({
    alignment, 
    xOffset=0,
    yOffset=0,
    systemFont="Inconsolata",
    filter,
    columnSwizzle: explicitColumnSwizzle,
    cellWidth=12
}) => {
    const fontsLoaded = useFontsLoaded();
    const sequenceLogoCanvasRef = useRef();
    const sequenceLogoDataRef = useRef();

    const dpr = useDevicePixelRatio({round: false}),
          isHighDPI = dpr > 1.0,
          dpiRatioRounded = isHighDPI ? 2 : 1;

    const {ref: resizerRef, width} = useResizeDetector({
        refreshMode: 'throttle',
        refreshRate: 40
    });


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
        if (sequenceLogoCanvasRef.current) {
            sequenceLogoDataRef.current = new SequenceLogoGlData(sequenceLogoCanvasRef.current);
        }

        // cleanup for when this component is unmounted
        return () => {
            sequenceLogoDataRef.current = null;
            sequenceLogoCanvasRef.current = null;
        }
    }, []);

    useLayoutEffect(() => {
        sequenceLogoDataRef.current.setFont(systemFont, 1.0);
        sequenceLogoDataRef.current.createFontTexture();
    }, [systemFont, fontsLoaded]);

    useLayoutEffect(() => {
        sequenceLogoDataRef.current.cellWidth = cellWidth;
    }, [cellWidth]);

    useLayoutEffect(() => {
        sequenceLogoDataRef.current.parseAlignment(alignment, columnSwizzle, filter);
    }, [alignment, columnSwizzle, systemFont, filter, fontsLoaded, cellWidth]);

    useLayoutEffect(() => {
        sequenceLogoDataRef.current.setViewport(((width || 500)|0), 70, dpiRatioRounded);
    }, [width, dpiRatioRounded]);

    useLayoutEffect(() => {
        sequenceLogoDataRef.current.render(xOffset * dpiRatioRounded, 0);
    }, [alignment, columnSwizzle, dpiRatioRounded, xOffset, width, systemFont, filter, fontsLoaded]);
    
    return (
        <div style={{width:'100%'}} ref={resizerRef}>
            <canvas
                id="SequenceLogoCanvas"
                ref={sequenceLogoCanvasRef}
                width={((width || 500)|0) * dpiRatioRounded}
                height={70 * dpiRatioRounded}
                style={{
                    width: width|0,
                    height: 70
                }}
            />
        </div>
    )
}
