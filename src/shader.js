// Liquid chrome wave background shader
// Renders a dark, glossy, undulating surface with chrome-like specular reflections

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_resolution;

  //
  // Simplex 3D noise — Stefan Gustavson (public domain)
  //
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Layered noise — dominant first octave for large, sweeping folds
  // Lower frequencies than V1 to match the real AICP thick liquid chrome waves
  float getHeight(vec2 p, float t) {
    float h = 0.0;
    // Primary: large slow waves (carries ~70% of the shape)
    h += 0.70 * snoise(vec3(p * 0.45, t * 0.08));
    // Secondary: medium detail
    h += 0.20 * snoise(vec3(p * 1.0 + 5.0, t * 0.12));
    // Tertiary: subtle fine detail for realism
    h += 0.10 * snoise(vec3(p * 2.2 + 10.0, t * 0.15));
    return h;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    // Larger coordinate space → fewer, bigger waves across the frame
    vec2 p = (uv - 0.5) * 2.8;

    float t = u_time;

    // Compute normal via finite differences — small epsilon for sharp highlights
    float eps = 0.004;
    float hR = getHeight(p + vec2(eps, 0.0), t);
    float hL = getHeight(p - vec2(eps, 0.0), t);
    float hU = getHeight(p + vec2(0.0, eps), t);
    float hD = getHeight(p - vec2(0.0, eps), t);

    vec3 normal = normalize(vec3(
      (hL - hR) / (2.0 * eps),
      (hD - hU) / (2.0 * eps),
      0.8  // Lower z-component = steeper perceived normals = more 3D
    ));

    // Slightly tilted view for perspective depth
    vec3 viewDir = normalize(vec3(0.0, -0.12, 1.0));

    // --- Triple-lobe specular for chrome look ---

    // Key light — upper left (matches reference highlight direction)
    vec3 light1 = normalize(vec3(-0.4, 0.6, 0.9));
    vec3 ref1 = reflect(-light1, normal);
    float rawSpec1 = max(dot(ref1, viewDir), 0.0);
    float sharpSpec1 = pow(rawSpec1, 200.0);  // Razor-sharp chrome highlight
    float medSpec1 = pow(rawSpec1, 40.0);      // Medium glow around highlight
    float broadSpec1 = pow(rawSpec1, 8.0);     // Broad ambient sheen

    // Fill light — upper right
    vec3 light2 = normalize(vec3(0.5, 0.5, 0.8));
    vec3 ref2 = reflect(-light2, normal);
    float rawSpec2 = max(dot(ref2, viewDir), 0.0);
    float sharpSpec2 = pow(rawSpec2, 180.0);
    float medSpec2 = pow(rawSpec2, 35.0);

    // Rim light — from below-right for edge definition
    vec3 light3 = normalize(vec3(0.3, -0.7, 0.4));
    vec3 ref3 = reflect(-light3, normal);
    float spec3 = pow(max(dot(ref3, viewDir), 0.0), 60.0);

    // Fresnel rim — brighter at glancing angles (wave crests)
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);

    // Base color — near pure black
    vec3 color = vec3(0.005, 0.005, 0.008);

    // Key light contributions — boosted for brighter, wider highlights
    color += sharpSpec1 * 1.2 * vec3(0.95, 0.95, 1.0);    // Bright chrome peak
    color += medSpec1 * 0.35 * vec3(0.8, 0.8, 0.85);       // Wider medium glow
    color += broadSpec1 * 0.08 * vec3(0.5, 0.5, 0.55);     // Ambient sheen

    // Fill light contributions — boosted
    color += sharpSpec2 * 0.9 * vec3(0.9, 0.9, 0.95);
    color += medSpec2 * 0.25 * vec3(0.6, 0.6, 0.65);

    // Rim — brighter
    color += spec3 * 0.35 * vec3(0.7, 0.7, 0.75);

    // Fresnel edge glow — more visible on wave crests
    color += fresnel * 0.12 * vec3(0.6, 0.6, 0.65);

    // Vignette — slightly softer than before
    float vig = 1.0 - 0.4 * pow(length(uv - 0.5) * 1.3, 2.0);
    color *= max(vig, 0.0);

    // Contrast curve — slightly less aggressive so highlights stay bright
    color = pow(color, vec3(1.5));

    // Clamp and output
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function initShader(canvas) {
  const gl = canvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    alpha: false,
    antialias: false,
  });

  if (!gl) {
    console.error('WebGL not supported');
    return null;
  }

  // Compile shaders
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vertexShaderSource);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
    return null;
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragmentShaderSource);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }

  gl.useProgram(program);

  // Fullscreen quad
  const positions = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Uniforms
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uResolution = gl.getUniformLocation(program, 'u_resolution');

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(uResolution, canvas.width, canvas.height);

  return {
    gl,
    render(time) {
      gl.uniform1f(uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  };
}
