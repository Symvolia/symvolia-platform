precision highp float;

/* Standalone iris procedural reference — used by pupil.frag composition. */

uniform float uTime;
varying vec2 vUv;

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
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float fibers = 0.55 + 0.45 * sin(ang * 48.0 + noise(uv * 6.0) * 4.0);
  float rings = 0.5 + 0.5 * sin(r * 28.0 - uTime * 0.4);
  vec3 col = mix(vec3(0.02, 0.06, 0.16), vec3(0.04, 0.12, 0.32), fibers);
  col = mix(col, vec3(0.14, 0.05, 0.28), rings * (1.0 - r));
  float mask = smoothstep(1.0, 0.9, r);
  gl_FragColor = vec4(col * mask, mask);
}
