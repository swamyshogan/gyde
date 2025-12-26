import {useReducer, useLayoutEffect} from 'react';


export const COLORMAPS = {
    'magma': 0,
    'viridis': 1,
    'viola': 2,
    'bky': 3
}

export const COLORMAP_SHADER = `
vec3 viridis_colormap(float s) {
    vec3 color_1 = vec3(0.27, 0.0, 0.33);
    vec3 color_2 = vec3(0.27, 0.2, 0.49);
    vec3 color_3 = vec3(0.1, 0.36, 0.55);
    vec3 color_4 = vec3(0.15, 0.49, 0.55);
    vec3 color_5 = vec3(0.12, 0.63, 0.53);
    vec3 color_6 = vec3(0.29, 0.76, 0.43);
    vec3 color_7 = vec3(0.63, 0.85, 0.22);
    vec3 color_8 = vec3(0.99, 0.9, 0.15);
  
    vec3 color;
  
    // negative values are mapped to grey
    if (s < 0.0) {
        color = vec3(0.8, 0.8, 0.8);
    }
    else if (s < 0.143) {
      float x = 7.0 * s;
      color = (1.0 - x) * color_1 + x * color_2;
    }
    else if (s < 0.286) {
      float x = 7.0 * (s - 0.143);
      color = (1.0 - x) * color_2 + x * color_3;
    }
    else if (s < 0.423) {
      float x = 7.0 * (s - 0.286);
      color = (1.0 - x) * color_3 + x * color_4;
    }
    else if (s < 0.571) {
      float x = 7.0 * (s - 0.423);
      color = (1.0 - x) * color_4 + x * color_5;
    }
    else if (s < 0.714) {
      float x = 7.0 * (s - 0.571);
      color = (1.0 - x) * color_5 + x * color_6;
    }
    else if (s < 0.857) {
      float x = 7.0 * (s - 0.714);
      color = (1.0 - x) * color_6 + x * color_7;
    }
    else {
      float x = 7.0 * (s - 0.857);
      color = (1.0 - x) * color_7 + x * color_8;
    }
  
    return color;
}

vec3 magma_colormap(float s) {
    vec3 color_1 = vec3(0.0, 0.0, 0.01);
    vec3 color_2 = vec3(0.13, 0.07, 0.31);
    vec3 color_3 = vec3(0.37, 0.09, 0.5);
    vec3 color_4 = vec3(0.6, 0.18, 0.5);
    vec3 color_5 = vec3(0.83, 0.26, 0.43);
    vec3 color_6 = vec3(0.97, 0.46, 0.36);
    vec3 color_7 = vec3(0.99, 0.73, 0.51);
    vec3 color_8 = vec3(0.99, 0.99, 0.74);
  
    vec3 color;
  
    // negative values are mapped to grey
    if (s < 0.0) {
        color = vec3(0.8, 0.8, 0.8);
    }
    else if (s < 0.143) {
      float x = 7.0 * s;
      color = (1.0 - x) * color_1 + x * color_2;
    }
    else if (s < 0.286) {
      float x = 7.0 * (s - 0.143);
      color = (1.0 - x) * color_2 + x * color_3;
    }
    else if (s < 0.423) {
      float x = 7.0 * (s - 0.286);
      color = (1.0 - x) * color_3 + x * color_4;
    }
    else if (s < 0.571) {
      float x = 7.0 * (s - 0.423);
      color = (1.0 - x) * color_4 + x * color_5;
    }
    else if (s < 0.714) {
      float x = 7.0 * (s - 0.571);
      color = (1.0 - x) * color_5 + x * color_6;
    }
    else if (s < 0.857) {
      float x = 7.0 * (s - 0.714);
      color = (1.0 - x) * color_6 + x * color_7;
    }
    else {
      float x = 7.0 * (s - 0.857);
      color = (1.0 - x) * color_7 + x * color_8;
    }
  
    return color;
}

vec3 viola_colormap(float s) {
    vec3 color_1 = vec3(0.33, 0.2, 0.58);
    vec3 color_2 = vec3(0.33, 0.43, 0.71);
    vec3 color_3 = vec3(0.35, 0.65, 0.8);
    vec3 color_4 = vec3(0.65, 0.83, 0.85);
    vec3 color_5 = vec3(1.0, 1.0, 1.0);
    vec3 color_6 = vec3(0.86, 0.75, 0.86);
    vec3 color_7 = vec3(0.78, 0.48, 0.76);
    vec3 color_8 = vec3(0.71, 0.18, 0.55);
    vec3 color_9 = vec3(0.51, 0.04, 0.23);
  
    vec3 color;
  
    // negative values are mapped to grey
    if (s < 0.0) {
        color = vec3(0.8, 0.8, 0.8);
    }
    else if (s < 0.125) {
      float x = 8.0 * s;
      color = (1.0 - x) * color_1 + x * color_2;
    }
    else if (s < 0.25) {
      float x = 8.0 * (s - 0.125);
      color = (1.0 - x) * color_2 + x * color_3;
    }
    else if (s < 0.375) {
      float x = 8.0 * (s - 0.25);
      color = (1.0 - x) * color_3 + x * color_4;
    }
    else if (s < 0.5) {
      float x = 8.0 * (s - 0.375);
      color = (1.0 - x) * color_4 + x * color_5;
    }
    else if (s < 0.625) {
      float x = 8.0 * (s - 0.5);
      color = (1.0 - x) * color_5 + x * color_6;
    }
    else if (s < 0.75) {
      float x = 8.0 * (s - 0.625);
      color = (1.0 - x) * color_6 + x * color_7;
    }
    else if (s < 0.875) {
      float x = 8.0 * (s - 0.75);
      color = (1.0 - x) * color_7 + x * color_8;
    }
    else {
      float x = 8.0 * (s - 0.875);
      color = (1.0 - x) * color_8 + x * color_9;
    }
  
    return color;
}

vec3 bky_colormap(float s) {
    // *Loosely* based on CET-D6 "bky"
    vec3 color_1 = vec3(0.0567, 0.580, 0.981);
    vec3 color_2 = vec3(0.128, 0.127, 0.129);
    vec3 color_3 = vec3(0.702, 0.545, 0.102);

    vec3 color;

    if (s < 0.0) {
        color = vec3(0.8, 0.8, 0.8);
    } else if (s < 0.5) {
        float x = s*2.0;
        color = (1.0 - x) * color_1 + x * color_2;
    } else {
        float x = (s-0.5)*2.0;
        color = (1.0 - x) * color_2 + x * color_3;
    }

    return color;
}
`

export function setupProgram(glContext, shaderDefs, attribs=[], uniforms=[]) {
    const shaders = shaderDefs.map(({type, script}) => {
        const shader = glContext.createShader(type);
        glContext.shaderSource(shader, script);
        glContext.compileShader(shader);
        if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) 
            throw Error(`Failed shader compilation: ${glContext.getShaderInfoLog(shader)}`);
        return shader;
    });

    const program = glContext.createProgram();
    for (const shader of shaders)
        glContext.attachShader(program, shader);
    glContext.linkProgram(program);
    if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
        const errMsg = glContext.getProgramInfoLog(program);
        glContext.deleteProgram(program);
        throw Error(`Failed linking: ${errMsg}`);
    }

    for (const attrib of attribs) 
        program[attrib] = glContext.getAttribLocation(program, attrib);
    for (const uniform of uniforms)
        program[uniform] = glContext.getUniformLocation(program, uniform);

    return program;
}

export function systemFontToTexture(glContext, name, cw, ch, fontScale, textureSize) {
    const maxChar = 255;

    const font = {
        charWidth: cw,
        charHeight: ch
    }

    while (true) {
        const charsPerRow = (textureSize/cw)|0;
        if (((maxChar / charsPerRow)|0) < ((textureSize/ch)|0)) {
            break;
        } else {
            textureSize *= 2;
        }
    }

    font.textureSize = textureSize;
    const charsPerRow = font.charsPerRow =(textureSize/cw)|0;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = textureSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white'
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, textureSize, textureSize);

    ctx.fillStyle = 'black';
    ctx.globalAlpha = 1;
    ctx.font = `500 ${(ch*fontScale)|0}px ${name}, monospace`;
    for (let cp = 32; cp <= maxChar; ++cp) {
        const cox = (cp%charsPerRow)*cw,
              coy = ((cp/charsPerRow)|0)*ch;

        ctx.fillText(String.fromCharCode(cp), cox+1, coy + ch*0.7);
    }

    const texture = glContext.createTexture();
    glContext.bindTexture(glContext.TEXTURE_2D, texture);
    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, canvas);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
    glContext.generateMipmap(glContext.TEXTURE_2D);

    font.texture = texture;
    return font;
}


export function systemFontToScaledTexture(glContext, name, cw, ch, fontScale, textureSize) {
    const maxChar = 128;

    const font = {
        charWidth: cw,
        charHeight: ch
    }

    while (true) {
        const charsPerRow = (textureSize/cw)|0;
        if (((maxChar / charsPerRow)|0) < ((textureSize/ch)|0)) {
            break;
        } else {
            textureSize *= 2;
        }
    }

    font.textureSize = textureSize;
    const charsPerRow = font.charsPerRow =(textureSize/cw)|0;

    // "Main" canvas that will become our font texture
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = textureSize;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';

    // Separate canvas that is used for test renderings to find character bounding boxes
    const testCanvas = document.createElement('canvas');
    const testWidth = 200, testHeight = 200, testRenderPosX = 20, testRenderPosY = 20;
    const testCtx = testCanvas.getContext('2d');

    ctx.fillStyle = 'white'
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, textureSize, textureSize);
    ctx.fillStyle = 'black';
    ctx.globalAlpha = 1;
    ctx.font = `100pt ${name}, monospace`;

    for (let cp = 32; cp <= maxChar; ++cp) {
        const cox = (cp%charsPerRow)*cw,
              coy = ((cp/charsPerRow)|0)*ch;

        // reset test canvas 
        testCanvas.width = testWidth; testCanvas.height = testHeight;
        testCtx.textBaseline = 'top';
        testCtx.font = `100pt ${name}, monospace`;
        testCtx.fillStyle = 'black';

        testCtx.fillText(String.fromCharCode(cp), testRenderPosX, testRenderPosY);
        const id = testCtx.getImageData(0, 0, testWidth, testHeight);

        let minX = testWidth, maxX = 0, minY = testHeight, maxY = 0;
        for (let y = 0; y < testHeight; ++y) {
            for (let x = 0; x < testWidth; ++x) {
                if (id.data[((y*testWidth) + x)*4+3] > 0) {
                    minX = Math.min(x, minX);
                    maxX = Math.max(x, maxX);
                    minY = Math.min(y, minY);
                    maxY = Math.max(y, maxY);
                }
            }
        }

        // Invert bounding box from above to render characters such that they fix the cw*cx unit cell.
        ctx.save();
        ctx.translate(cox, coy);    
        ctx.scale(cw/(maxX-minX+1), ch/(maxY-minY+1));
        ctx.translate(testRenderPosX-minX, testRenderPosY-minY);
        ctx.fillText(String.fromCharCode(cp), 0, 0);
        ctx.restore();
    }


    const texture = glContext.createTexture();
    glContext.bindTexture(glContext.TEXTURE_2D, texture);
    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, canvas);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
    glContext.generateMipmap(glContext.TEXTURE_2D);

    font.texture = texture;
    return font;


}


export function useFontsLoaded() {
    const [fontsLoaded, setFontsLoaded] = useReducer((a, b) => a+b, 0);
    useLayoutEffect(() => {
        const cb = (ev) => {
            setFontsLoaded(1);
        }

        document.fonts.addEventListener('loadingdone', cb);
        return () => {
            document.fonts.removeEventListener('loadingdone', cb);
        }
    }, [setFontsLoaded]);
    return fontsLoaded;
}
