precision highp float;

uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uStrength;   // 0..1 vortex amount
uniform float uFlash;      // golden flash peak
uniform vec2 uResolution;
uniform vec2 uCenter;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 c = uCenter;
  vec2 d = uv - c;
  // Correct for aspect so the vortex is circular
  d.x *= uResolution.x / max(uResolution.y, 1.0);
  float r = length(d);
  float ang = atan(d.y, d.x);

  // Inward spiral distortion — energy converging on the seal
  float twist = uStrength * (1.2 - r) * 2.8;
  float pull = uStrength * 0.22 * (1.0 - smoothstep(0.0, 1.1, r));
  ang += twist;
  r = max(0.0, r - pull);

  vec2 warped = vec2(cos(ang), sin(ang)) * r;
  warped.x /= uResolution.x / max(uResolution.y, 1.0);
  warped += c;

  vec4 color = texture2D(tDiffuse, clamp(warped, 0.0, 1.0));

  // Radial energy streaks
  float streaks = pow(max(0.0, 1.0 - r), 2.0) * abs(sin(ang * 18.0 + uTime * 6.0));
  color.rgb += vec3(0.83, 0.69, 0.22) * streaks * uStrength * 0.45;
  color.rgb += vec3(0.45, 0.2, 0.7) * streaks * uStrength * 0.2;

  // Epic golden flash
  color.rgb += vec3(1.0, 0.92, 0.65) * uFlash;
  color.rgb = mix(color.rgb, vec3(1.0, 0.95, 0.8), uFlash * 0.55);

  gl_FragColor = color;
}
