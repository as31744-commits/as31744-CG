import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(6, 4, 7);

const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf5deb3 });
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb22222 });

const house = new THREE.Group();
scene.add(house);

//Muret e shtepise
const walls = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 4), wallMaterial);
walls.position.y = 1.25;
house.add(walls);

//Kulmi - kon me 4 segmente (piramide), i rrotulluar 45 grade qe te puthitet me muret
const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2, 4), roofMaterial);
roof.position.y = 2.5 + 1;
roof.rotation.y = Math.PI / 4;
house.add(roof);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('scene').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
controls.update();

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
