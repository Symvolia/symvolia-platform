precision highp float;

uniform float uTime;
uniform float uDilate;      // 0..1 natural dilation
uniform float uFill;        // 0..1 pupil fills screen
uniform float uGold;        // 0..1 black → gold pupil core
uniform float uSigilAlpha;  // sigil visibility inside pupil
uniform float uEyeFade;     // 1 = full eye structure, 0 = dissolved
uniform float uCorneaWet;   // specular strength
uniform float uLidOpen;     // eyelid aperture 0..1
uniform sampler2D uSigil;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.y *= 1.12;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);

  float pupilR = mix(0.10, 0.36, uDilate);
  pupilR = mix(pupilR, 2.6, uFill * uFill);

  float inIris = smoothstep(1.02, 0.88, r);
  float inPupil = 1.0 - smoothstep(pupilR * 0.94, pupilR * 1.06, r);

  vec3 sclera = vec3(0.09, 0.06, 0.045);
  sclera += vec3(0.04, 0.01, 0.01) * noise(uv * 8.0);

  float fibers = 0.55 + 0.45 * sin(ang * 52.0 + noise(uv * 7.0) * 5.0);
  float rings = 0.5 + 0.5 * sin(r * 32.0 - uTime * 0.55);
  vec3 iris = mix(vec3(0.015, 0.04, 0.12), vec3(0.05, 0.14, 0.38), fibers);
  iris = mix(iris, vec3(0.18, 0.05, 0.32), rings * (1.0 - r));
  iris *= 0.5 + 0.5 * noise(uv * 18.0 + uTime * 0.08);
  float limbal = smoothstep(0.72, 0.96, r) * smoothstep(1.05, 0.92, r);
  iris = mix(iris, vec3(0.01, 0.01, 0.02), limbal * 0.9);

  vec3 gold = vec3(0.831, 0.686, 0.216);
  vec3 pupilCol = mix(vec3(0.0), gold * 0.5, uGold);
  float depthGlow = (1.0 - smoothstep(0.0, pupilR * 0.8, r)) * uGold;
  pupilCol += gold * depthGlow * 0.75;

  vec2 sigUv = uv / max(pupilR * 1.45, 0.001) * 0.5 + 0.5;
  vec4 sig = texture2D(uSigil, clamp(sigUv, 0.0, 1.0));
  float sigMask = inPupil * uSigilAlpha * smoothstep(0.015, 0.18, pupilR);
  float sigLum = max(sig.r, max(sig.g, sig.b)) * (sig.a);
  pupilCol = mix(pupilCol, gold * (0.9 + sigLum), sigMask * sigLum);

  vec3 col = mix(sclera, iris, inIris * uEyeFade);
  col = mix(col, pupilCol, inPupil);

  float ball = smoothstep(1.45, 0.95, r);
  col = mix(vec3(0.004, 0.003, 0.006), col, max(ball, inPupil * smoothstep(0.05, 0.35, uFill)));

  vec2 hl1 = uv - vec2(-0.26, -0.28);
  vec2 hl2 = uv - vec2(0.2, -0.36);
  float spec = exp(-dot(hl1, hl1) * 22.0) * 0.65 + exp(-dot(hl2, hl2) * 110.0) * 1.0;
  col += vec3(1.0) * spec * uCorneaWet * uEyeFade * (1.0 - uFill * 0.9);

  float lidGap = mix(0.02, 1.35, uLidOpen);
  float upper = smoothstep(lidGap, lidGap - 0.08, uv.y);
  float lower = smoothstep(-lidGap, -lidGap + 0.08, uv.y);
  float lids = max(upper, lower) * (1.0 - uFill * 0.95);
  col = mix(col, vec3(0.08, 0.04, 0.03), lids * uEyeFade);

  gl_FragColor = vec4(col, 1.0);
}
