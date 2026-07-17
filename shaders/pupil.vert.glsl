varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
