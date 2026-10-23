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

camera.position.set(7, 5, 9);

const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf5deb3 });
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb22222 });
const brickMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3317 });
const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x99ccff });
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4226 });
const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });

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

//Oxhaku - cilinder
const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.4, 32), brickMaterial);
chimney.position.set(1, 3.6, -0.8);
house.add(chimney);

//Dera
const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), doorMaterial);
door.position.set(0, 0.8, 2.05);
house.add(door);

//Doreza e deres
const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
doorKnob.position.set(0.3, 0.8, 2.12);
house.add(doorKnob);

//Dritaret
const windowGeometry = new THREE.BoxGeometry(0.8, 0.7, 0.1);
const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
leftWindow.position.set(-1.3, 1.5, 2.05);
house.add(leftWindow);

const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
rightWindow.position.set(1.3, 1.5, 2.05);
house.add(rightWindow);

//Kulla anesore - cilinder me kulm kon
const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 32), wallMaterial);
tower.position.set(-2.6, 1.75, 1.6);
house.add(tower);

const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 32), roofMaterial);
towerRoof.position.set(-2.6, 3.5 + 0.8, 1.6);
house.add(towerRoof);

const towerWindow = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32), windowMaterial);
towerWindow.rotation.x = Math.PI / 2;
towerWindow.position.set(-2.6, 2.5, 2.48);
house.add(towerWindow);

//Pemet - trungu cilinder, gjethet kon
function createTree(x, z) {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1, 16), trunkMaterial);
    trunk.position.y = 0.5;
    tree.add(trunk);

    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 32), leavesMaterial);
    leaves.position.y = 2;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    scene.add(tree);
}

createTree(4, 1);
createTree(4.5, -2);
createTree(-4, -2.5);

//Toka
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x7cba3d })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

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
