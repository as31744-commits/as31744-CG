import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);


const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(8, 6, 12);
camera.lookAt(0, 3, 0);


const armMaterial = new THREE.MeshStandardMaterial({color: 0x3399ff});
const jointMaterial = new THREE.MeshStandardMaterial({color: 0x555555});
const handMaterial = new THREE.MeshStandardMaterial({color: 0xffaa55});
const fingerMaterial = new THREE.MeshStandardMaterial({color: 0xffcc88});


const baseGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 32);
const base = new THREE.Mesh(baseGeometry, jointMaterial);

scene.add(base);


const shoulder = new THREE.Group();
shoulder.position.y = 0.5;
base.add(shoulder);


const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), jointMaterial);

shoulder.add(shoulderJoint);


const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3, 0.7), armMaterial);

upperArm.position.y = 1.5;

shoulder.add(upperArm);

const elbow = new THREE.Group();
elbow.position.y = 3;
shoulder.add(elbow);

const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 32), jointMaterial);

elbow.add(elbowJoint);

const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.5, 0.6), armMaterial);

forearm.position.y = 1.25;

elbow.add(forearm);


const wrist = new THREE.Group();
wrist.position.y = 2.5;
elbow.add(wrist);


const wristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 32), jointMaterial);

wrist.add(wristJoint);

const palm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 0.4), handMaterial);
palm.position.y = 0.9;

wrist.add(palm);


//Krijon nje gisht me disa segmente (falanga). Cdo segment ka nyjen e vet (Group)
//qe te mund te perkulet ne menyre te pavarur. Kthen nyjet qe te i rrotullojme me vone.
function createFinger(parent, segmentLengths, width) {

    const joints = [];
    let current = parent;

    for (let i = 0; i < segmentLengths.length; i++) {

        const length = segmentLengths[i];

        const joint = new THREE.Group();
        if (i > 0) {
            joint.position.y = segmentLengths[i - 1];
        }
        current.add(joint);

        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(width * 0.6, 16, 16), jointMaterial);
        joint.add(knuckle);

        const segment = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), fingerMaterial);
        segment.position.y = length / 2;
        joint.add(segment);

        joints.push(joint);
        current = joint;
    }

    return joints;
}


//Gishtat kane madhesi te ndryshme: [gjatesite e segmenteve], gjeresia
const fingerData = [
    { x: -0.6, segments: [0.5, 0.4], width: 0.26 },   //treguesi
    { x: -0.2, segments: [0.6, 0.5], width: 0.28 },   //i mesmi (me i gjati)
    { x: 0.2, segments: [0.55, 0.45], width: 0.26 },  //unaza
    { x: 0.6, segments: [0.4, 0.3], width: 0.22 }     //i vogli (me i shkurti)
];

const fingers = [];

//Gishti i madh - ne anen e majte te shputes, i pjerret nga jashte
const thumbBase = new THREE.Group();
thumbBase.position.set(-0.9, -0.2, 0);
thumbBase.rotation.z = THREE.MathUtils.degToRad(50);
palm.add(thumbBase);

fingers.push({
    joints: createFinger(thumbBase, [0.45, 0.35], 0.3),
    maxBend: THREE.MathUtils.degToRad(60),
    isThumb: true,
    bend: 0,
    target: 0
});

for (let i = 0; i < fingerData.length; i++) {

    const fingerJoint = new THREE.Group();

    fingerJoint.position.x = fingerData[i].x;
    fingerJoint.position.y = 0.75;

    palm.add(fingerJoint);

    fingers.push({
        joints: createFinger(fingerJoint, fingerData[i].segments, fingerData[i].width),
        maxBend: THREE.MathUtils.degToRad(85),
        isThumb: false,
        bend: 0,
        target: 0
    });
}


const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff,2);

directionalLight.position.set(5, 10, 5);

scene.add(directionalLight);


const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({
        color: 0xcccccc
    })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.25;

scene.add(ground);

const grid = new THREE.GridHelper(
    20,
    20
);

scene.add(grid);


const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.getElementById('scene').appendChild(renderer.domElement);


const controls = new OrbitControls(
    camera,
    renderer.domElement
);

controls.target.set(0, 3, 0);

controls.enableDamping = true;

controls.update();


shoulder.rotation.z = THREE.MathUtils.degToRad(-20);
elbow.rotation.z = THREE.MathUtils.degToRad(40);
wrist.rotation.z = THREE.MathUtils.degToRad(-20);

const rotationStep = THREE.MathUtils.degToRad(5);

window.addEventListener('keydown', function(event) {

    const key = event.key.toLowerCase();

    if (key === 'q') {
        shoulder.rotation.z += rotationStep;
    }

    if (key === 'a') {
        shoulder.rotation.z -= rotationStep;
    }

    if (key === 'w') {
        elbow.rotation.z += rotationStep;
    }

    if (key === 's') {
        elbow.rotation.z -= rotationStep;
    }

    if (key === 'e') {
        wrist.rotation.z += rotationStep;
    }

    if (key === 'd') {
        wrist.rotation.z -= rotationStep;
    }

    //1-5: hap/mbyll gishtin perkates
    if (key >= '1' && key <= '5') {
        const finger = fingers[Number(key) - 1];
        finger.target = finger.target === 0 ? 1 : 0;
    }

    if (key === 'r') {
        fingers.forEach(finger => finger.target = 1);
    }

    if (key === 'f') {
        fingers.forEach(finger => finger.target = 0);
    }

});


function updateFingers() {

    fingers.forEach(finger => {

        //Levizje e bute drejt pozites se deshiruar
        finger.bend += (finger.target - finger.bend) * 0.1;

        //Cdo segment perkulet perpara (drejt pjeses se perparme te shputes)
        finger.joints.forEach(joint => {
            joint.rotation.x = finger.bend * finger.maxBend;
        });

        //Gishti i madh kthehet edhe drejt qendres se shputes kur mbyllet
        if (finger.isThumb) {
            thumbBase.rotation.z = THREE.MathUtils.degToRad(50 - 45 * finger.bend);
            thumbBase.position.z = 0.2 * finger.bend;
        }
    });
}

function animate() {

    requestAnimationFrame(animate);

    updateFingers();

    controls.update();

    renderer.render(
        scene,
        camera
    );
}

animate();
