import * as THREE from 'three'

export const SkyShader = {
  uniforms: {
    turbidity:        { value: 10 },
    rayleigh:         { value: 2 },
    mieCoefficient:   { value: 0.005 },
    mieDirectionalG:  { value: 0.8 },
    up:               { value: new THREE.Vector3(0, 1, 0) },
    cloudCoverage:    { value: 0.5 },
    cloudDensity:     { value: 1.0 },
    cloudElevation:   { value: 2 },
    showSunDisc:      { value: 1 },
    azimuth:          { value: 180 },
    elevation:        { value: 45 },
    exposure:         { value: 0.9 }
  },

  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    #include <common>
    varying vec3 vWorldPosition;
    uniform float turbidity;
    uniform float rayleigh;
    uniform float mieCoefficient;
    uniform float mieDirectionalG;
    uniform vec3 up;
    uniform float cloudCoverage;
    uniform float cloudDensity;
    uniform float cloudElevation;
    uniform float showSunDisc;
    uniform float azimuth;
    uniform float elevation;
    uniform float exposure;

    const float e = 2.71828182845904523536028747135266249025824687;
    const float pi = 3.141592653589793238462643383279502884197;

    float rayleighPhase(float cosTheta) {
      return (3.0 / (16.0 * pi)) * (1.0 + pow(cosTheta, 2.0));
    }

    float miePhase(float cosTheta) {
      float g = mieDirectionalG;
      float g2 = pow(g, 2.0);
      float numerator = 1.5 * ((1.0 - g2) * (1.0 + pow(cosTheta, 2.0)));
      float denominator = 2.0 + g2 - 2.0 * g * cosTheta;
      return (numerator / pow(denominator, 1.5)) / (4.0 * pi);
    }

    vec3 getSkyColor(vec3 rayDir) {
      rayDir = normalize(rayDir);
      
      float azimuthRad = radians(azimuth);
      float elevationRad = radians(elevation);
      
      vec3 sunDir = vec3(
        sin(azimuthRad) * cos(elevationRad),
        sin(elevationRad),
        cos(azimuthRad) * cos(elevationRad)
      );
      
      float cosAngle = dot(rayDir, sunDir);
      float sunE = pow(e, -0.00095 * turbidity);
      
      vec3 betaR = vec3(
        pow(664.4 / 350.0, 2.0) * 0.474,
        pow(664.4 / 590.0, 2.0) * 0.16,
        pow(664.4 / 1590.0, 2.0) * 0.02373
      ) * rayleigh * 0.002;
      
      vec3 betaM    = vec3(1.0) * mieCoefficient * turbidity * 0.434 / 20.0;
      vec3 betaMSca = betaM * 0.67;
      vec3 betaMEx  = betaM * 1.11;
      
      float zenithAngle = acos(max(0.0, dot(up, rayDir)));
      float sR = 8.5e3 / cos(zenithAngle);
      float sM = 1.25e3 / cos(zenithAngle);
      
      vec3 Fex = exp(-(betaR * sR + betaMEx * sM));
      float cosTheta = dot(rayDir, sunDir);
      vec3 betaRTheta = betaR    * rayleighPhase(cosTheta * 0.5 + 0.5);
      vec3 betaMTheta = betaMSca * miePhase(cosTheta);
      
      vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaMEx)) * (vec3(1.0) - Fex), vec3(0.4));
      Lin += vec3(0.3) * pow(sunE * Fex, vec3(0.4));
      
      if (showSunDisc > 0.5 && cosAngle > 0.99) {
        Lin += sunE * Fex * vec3(1.0);
      }
      
      return Lin;
    }

    void main() {
      vec3 direction = normalize(vWorldPosition);
      vec3 skyColor  = getSkyColor(direction);
      
      if (cloudCoverage > 0.0) {
        float cloudNoise = sin(vWorldPosition.x * 0.001 + cloudElevation) * cos(vWorldPosition.z * 0.001);
        cloudNoise = cloudNoise * 0.5 + 0.5;
        float cloudFactor = smoothstep(0.3, 0.7, cloudNoise);
        vec3 cloudColor = mix(skyColor, vec3(0.95), cloudFactor * cloudCoverage * cloudDensity);
        skyColor = mix(skyColor, cloudColor, cloudCoverage);
      }
      
      gl_FragColor = vec4(skyColor * exposure, 1.0);
    }
  `
}
