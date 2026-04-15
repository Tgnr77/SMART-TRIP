import React, { useRef, useState, useEffect } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { TextureLoader, Raycaster, Vector2 } from "three";
import * as THREE from "three";
import { DESTINATIONS } from "../utils/destinations";

const DestinationMarker = ({ position, isSelected }) => {
  const ringRef = useRef();

  useFrame(({ clock }) => {
    if (isSelected && ringRef.current) {
      const t = clock.getElapsedTime();
      const scale = 1 + Math.sin(t * 3) * 0.2;
      const opacity = 0.8 - Math.sin(t * 3) * 0.2;
      ringRef.current.scale.set(scale, scale, 1);
      ringRef.current.material.opacity = opacity;
    }
  });

  if (!isSelected) return null;

  const normal = position.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal
  );

  return (
    <group position={position} quaternion={quaternion}>
      {/* Anneau pulsant sur la surface */}
      <mesh ref={ringRef} position={[0, 0, 0.02]}>
        <ringGeometry args={[0.03, 0.08, 32]} />
        <meshBasicMaterial
          color="#ec4899"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Point central blanc */}
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.02, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Tige fine */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.24, 8]} />
        <meshBasicMaterial color="#ec4899" transparent opacity={0.8} />
      </mesh>

      {/* Tête de l'épingle */}
      <mesh position={[0, 0, 0.24]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial
          color="#ec4899"
          emissive="#ec4899"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

// ─── Marqueur de destination suggérée (résultats inspiration) ────────────────
const HighlightMarker = ({ position, isTopResult = false }) => {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      ref.current.material.opacity = isTopResult
        ? 0.7 + Math.sin(t * 3) * 0.25
        : 0.5 + Math.sin(t * 2 + 1) * 0.2;
    }
  });
  const normal = position.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), normal
  );
  const color = isTopResult ? "#f59e0b" : "#22d3ee";
  const size = isTopResult ? 0.07 : 0.05;
  return (
    <group position={position} quaternion={quaternion}>
      {/* Halo */}
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[size, size * 1.7, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Point central */}
      <mesh ref={ref} position={[0, 0, 0.02]}>
        <circleGeometry args={[size, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const Globe3D = ({
  onCountryClick,
  inspirationMode = false,
  zoomToDestination = null,
  onZoomComplete,
  highlightedDestinations = [],   // [{ city, isTop }]
}) => {
  const globeGroupRef = useRef(); // Groupe qui contient le globe ET les marqueurs
  const meshRef = useRef();
  const cloudsRef = useRef();
  const markersRef = useRef([]);
  const { camera, gl } = useThree();
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomAnimation, setZoomAnimation] = useState(null);
  const lastZoomedDestinationRef = useRef(null);

  // Charger la texture de la Terre
  const earthTexture = useLoader(
    TextureLoader,
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
  );
  const bumpTexture = useLoader(
    TextureLoader,
    "https://unpkg.com/three-globe/example/img/earth-topology.png"
  );

  // Convertir lat/lon en position 3D
  const latLonToVector3 = (lat, lon, radius = 2.55) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  };

  // Gérer les clics sur les marqueurs
  const handlePointerMove = (event) => {
    const raycaster = new Raycaster();
    const mouse = new Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markersRef.current);

    if (intersects.length > 0) {
      document.body.style.cursor = "pointer";
      setHoveredMarker(intersects[0].object.userData.name);
    } else {
      document.body.style.cursor = "grab";
      setHoveredMarker(null);
    }
  };

  const handleClick = (event) => {
    const raycaster = new Raycaster();
    const mouse = new Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markersRef.current);

    if (intersects.length > 0 && onCountryClick) {
      onCountryClick(intersects[0].object.userData.city);
    }
  };

  // Démarrer l'animation de zoom quand une destination est sélectionnée
  React.useEffect(() => {
    // Si la destination change ou si on annule la recherche
    if (zoomToDestination !== lastZoomedDestinationRef.current) {
      if (zoomToDestination && globeGroupRef.current) {
        const destination = DESTINATIONS.find(
          (d) => d.city.toLowerCase() === zoomToDestination.toLowerCase()
        );

        if (destination) {
          setIsZooming(true);
          lastZoomedDestinationRef.current = zoomToDestination;

          // Trouver le marqueur correspondant à cette destination
          const markerIndex = DESTINATIONS.findIndex(
            (d) => d.city.toLowerCase() === zoomToDestination.toLowerCase()
          );

          const targetMarker = markersRef.current[markerIndex];

          if (targetMarker) {
            // Position initiale de la caméra
            const startCameraPos = camera.position.clone();

            // Obtenir la position mondiale du marqueur (en tenant compte de la rotation du globe)
            const markerWorldPos = new THREE.Vector3();
            targetMarker.getWorldPosition(markerWorldPos);

            // Calculer la direction depuis le centre du globe vers le marqueur
            const direction = markerWorldPos.clone().normalize();

            // Position cible de la caméra : en face du marqueur à distance de zoom
            const zoomDistance = 4.5;
            const targetCameraPos = direction
              .clone()
              .multiplyScalar(zoomDistance);

            setZoomAnimation({
              startTime: Date.now(),
              duration: 2500,
              startCameraPos,
              targetCameraPos,
              startGlobeRotation: null,
              targetGlobeRotation: null,
            });
          }
        }
      } else if (!zoomToDestination) {
        // Réinitialisation si aucune destination
        setIsZooming(false);
        setZoomAnimation(null);
        lastZoomedDestinationRef.current = null;
      }
    }
  }, [zoomToDestination, camera]);

  // Animation de rotation automatique et zoom
  useFrame((state, delta) => {
    // Mode inspiration : rotation plus rapide
    if (inspirationMode && globeGroupRef.current && !isZooming) {
      globeGroupRef.current.rotation.y += delta * 0.3;
    } else if (globeGroupRef.current && !isZooming) {
      // Rotation normale
      globeGroupRef.current.rotation.y += delta * 0.15;
    }

    // Animation de zoom en cours
    if (zoomAnimation && globeGroupRef.current) {
      const elapsed = Date.now() - zoomAnimation.startTime;
      const progress = Math.min(elapsed / zoomAnimation.duration, 1);

      // Easing function (ease-in-out)
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Animer le zoom de la caméra vers le marqueur
      camera.position.lerpVectors(
        zoomAnimation.startCameraPos,
        zoomAnimation.targetCameraPos,
        eased
      );
      camera.lookAt(0, 0, 0);

      // Fin de l'animation
      if (progress >= 1) {
        setZoomAnimation(null);
        if (onZoomComplete) {
          setTimeout(() => onZoomComplete(), 500);
        }
      }
    }
  });

  return (
    <>
      {/* Étoiles de fond */}
      <Stars
        radius={300}
        depth={60}
        count={30000}
        factor={8}
        saturation={0}
        fade
        speed={2}
      />

      {/* Lumière ambiante augmentée pour éclaircir le globe */}
      <ambientLight intensity={0.9} />

      {/* Lumière directionnelle (soleil) plus intense */}
      <directionalLight position={[5, 3, 5]} intensity={2.5} />

      {/* Point de lumière supplémentaire */}
      <pointLight position={[-10, 0, -10]} intensity={1.2} color="#4080ff" />

      {/* Groupe contenant le globe et les marqueurs - tourne ensemble */}
      <group ref={globeGroupRef}>
        {/* Globe terrestre avec texture satellite */}
        <mesh
          ref={meshRef}
          onPointerMove={handlePointerMove}
          onClick={handleClick}
        >
          <sphereGeometry args={[2.5, 64, 64]} />
          <meshStandardMaterial
            map={earthTexture}
            bumpMap={bumpTexture}
            bumpScale={0.05}
          />
        </mesh>

        {/* Marqueurs pour les destinations */}
        {DESTINATIONS.map((dest, index) => {
          const position = latLonToVector3(dest.lat, dest.lon);
          const isSelected =
            zoomToDestination &&
            dest.city.toLowerCase() === zoomToDestination.toLowerCase();

          // Marqueur de surbrillance depuis l'inspiration
          const highlightInfo = highlightedDestinations.find(
            (h) => h.city.toLowerCase() === dest.city.toLowerCase()
          );
          const showHighlight = highlightInfo && !isSelected;

          return (
            <group key={index}>
              {/* Marqueur logique pour le raycasting et le zoom */}
              <mesh
                position={position}
                ref={(el) => (markersRef.current[index] = el)}
                userData={{ country: dest.country, city: dest.city }}
              >
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial
                  transparent
                  opacity={0}
                  visible={false}
                />
              </mesh>

              {/* Marqueur visuel sélectionné (pin rose) */}
              <DestinationMarker position={position} isSelected={isSelected} />

              {/* Marqueur visuel inspiration (halo cyan/amber) */}
              {showHighlight && (
                <HighlightMarker
                  position={position}
                  isTopResult={highlightInfo.isTop === true}
                />
              )}
            </group>
          );
        })}

        {/* Couche de nuages - attachée au globe */}
        <mesh ref={cloudsRef} scale={[1.008, 1.008, 1.008]}>
          <sphereGeometry args={[2.5, 64, 64]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.2}
            roughness={1}
          />
        </mesh>
      </group>

      {/* Contrôles de caméra - INTERACTIFS */}
      <OrbitControls
        enableZoom={!isZooming}
        enablePan={!isZooming}
        enableRotate={!isZooming}
        minDistance={4}
        maxDistance={20}
        autoRotate={false}
        autoRotateSpeed={0.5}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
        makeDefault
      />
    </>
  );
};

export default Globe3D;
