import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// Dimensionet e dhomes (ne metra): gjeresia (x), thellesia (z), lartesia (y)
const ROOM_W = 7;
const ROOM_D = 5.6;
const ROOM_H = 2.8;

// Qendra e tavolines - te gjitha karriget vendosen relativisht ndaj saj
const TABLE_X = -1.0;
const TABLE_Z = 0.2;

// Dritarja ne murin e majte
const WINDOW = { z: 0.6, bottom: 0.85, top: 2.35, width: 1.5 };


// ---------------------------------------------------------------------------
// Skena, kamera, renderer
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1a17);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(4.6, 3.6, 6.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('scene').appendChild(renderer.domElement);

// Ambient i bute (reflektime realiste per materialet PBR te modeleve)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.6, 0.8, -0.4);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 1.5;
controls.maxDistance = 14;
controls.update();


// ---------------------------------------------------------------------------
// Ngarkimi i modeleve dhe teksturave
// ---------------------------------------------------------------------------

const loadingEl = document.getElementById('loading');
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
    loadingEl.textContent = `Duke ngarkuar modelet... ${Math.round(loaded / total * 100)}%`;
};
manager.onLoad = () => {
    loadingEl.style.opacity = 0;
    setTimeout(() => loadingEl.remove(), 700);
};

const gltfLoader = new GLTFLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

function loadTexture(path, { srgb = false, repeat = [1, 1] } = {}) {
    const texture = textureLoader.load(path);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.anisotropy = maxAnisotropy;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// Ngarkon nje model glTF nga folderi models/<emri>/ dhe aktivizon hijet
function loadModel(name) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(`models/${name}/${name}.gltf`, (gltf) => {
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            resolve(gltf.scene);
        }, undefined, reject);
    });
}

// Shkallezon, rrotullon dhe zhvendos nje objekt.
// Pozita (x, z) eshte qendra e objektit ne dysheme; y eshte lartesia e bazes se tij.
function place(object, { x = 0, y = 0, z = 0, rotY = 0, scale = 1 }) {
    if (Array.isArray(scale)) object.scale.set(scale[0], scale[1], scale[2]);
    else object.scale.setScalar(scale);
    object.rotation.y = rotY;

    // Gjej kutine kufizuese pas shkallezimit dhe rrotullimit, pastaj zhvendose
    object.position.set(0, 0, 0);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.set(x - center.x, y - box.min.y, z - center.z);

    scene.add(object);
    return box.getSize(new THREE.Vector3());
}

function sizeOf(object) {
    object.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
}


// ---------------------------------------------------------------------------
// Dhoma: dyshemeja, muret, tavani
// ---------------------------------------------------------------------------

const floorRepeat = [ROOM_W / 2.2, ROOM_D / 2.2];
const floorMaterial = new THREE.MeshStandardMaterial({
    map: loadTexture('textures/laminate_floor_02/laminate_floor_02_diff_1k.jpg', { srgb: true, repeat: floorRepeat }),
    normalMap: loadTexture('textures/laminate_floor_02/laminate_floor_02_nor_gl_1k.jpg', { repeat: floorRepeat }),
    roughnessMap: loadTexture('textures/laminate_floor_02/laminate_floor_02_rough_1k.jpg', { repeat: floorRepeat }),
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Muret jane plane te njeanshme qe shikojne nga brenda dhomes: kur kamera eshte
// jashte, muri mes kameres dhe dhomes nuk vizatohet, keshtu qe dhoma shihet si "kukull".
const walls = [];

function makeWall({ width, color, position, rotY, holes = [] }) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, ROOM_H);
    shape.lineTo(-width / 2, ROOM_H);
    shape.closePath();
    for (const h of holes) {
        const hole = new THREE.Path();
        hole.moveTo(h.u - h.w / 2, h.v0);
        hole.lineTo(h.u + h.w / 2, h.v0);
        hole.lineTo(h.u + h.w / 2, h.v1);
        hole.lineTo(h.u - h.w / 2, h.v1);
        hole.closePath();
        shape.holes.push(hole);
    }

    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotY;

    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    material.shadowSide = THREE.DoubleSide; // muri bllokon diellin nga te dy anet
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Dekorimet e murit (pervazi, dritarja, pikturat) fshihen kur muri nuk shihet
    const decor = new THREE.Group();
    group.add(decor);

    const baseboard = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.1, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xf3efe7, roughness: 0.6 })
    );
    baseboard.position.set(0, 0.05, 0.01);
    baseboard.receiveShadow = true;
    decor.add(baseboard);

    scene.add(group);
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    walls.push({ group, decor, normal });
    return { group, decor };
}

const WARM_WHITE = 0xe9e2d6;
const SAGE_GREEN = 0x7f8f78;

const backWall = makeWall({
    width: ROOM_W, color: SAGE_GREEN,
    position: new THREE.Vector3(0, 0, -ROOM_D / 2), rotY: 0,
});
// Per murin e majte (rotY = 90 grade) boshti lokal u perputhet me -z ne bote
const leftWall = makeWall({
    width: ROOM_D, color: WARM_WHITE,
    position: new THREE.Vector3(-ROOM_W / 2, 0, 0), rotY: Math.PI / 2,
    holes: [{ u: -WINDOW.z, w: WINDOW.width, v0: WINDOW.bottom, v1: WINDOW.top }],
});
makeWall({
    width: ROOM_D, color: WARM_WHITE,
    position: new THREE.Vector3(ROOM_W / 2, 0, 0), rotY: -Math.PI / 2,
});
makeWall({
    width: ROOM_W, color: WARM_WHITE,
    position: new THREE.Vector3(0, 0, ROOM_D / 2), rotY: Math.PI,
});

// Tavani (shikon poshte), gjithashtu bllokon diellin
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f2ec, roughness: 0.95 });
ceilingMaterial.shadowSide = THREE.DoubleSide;
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 0.4, ROOM_D + 0.4), ceilingMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ROOM_H;
ceiling.castShadow = true;
scene.add(ceiling);


// ---------------------------------------------------------------------------
// Dritarja me perde (primitive)
// ---------------------------------------------------------------------------

function skyTexture(top, bottom) {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
const daySky = skyTexture('#8fb8de', '#e8f0f2');
const nightSky = skyTexture('#0b1326', '#27324a');

const windowGroup = new THREE.Group();
// Ne koordinatat lokale te murit te majte: u = -z, v = y
windowGroup.position.set(-WINDOW.z, 0, 0);
leftWall.decor.add(windowGroup);

const glassMaterial = new THREE.MeshBasicMaterial({ map: daySky });
const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WINDOW.width, WINDOW.top - WINDOW.bottom),
    glassMaterial
);
glass.position.set(0, (WINDOW.top + WINDOW.bottom) / 2, -0.06);
windowGroup.add(glass);

const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.5 });
function frameBar(w, h, d, x, y, z) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMaterial);
    bar.position.set(x, y, z);
    bar.castShadow = true;
    bar.receiveShadow = true;
    windowGroup.add(bar);
}
const winH = WINDOW.top - WINDOW.bottom;
const winMid = (WINDOW.top + WINDOW.bottom) / 2;
const T = 0.06; // trashesia e kornizes
frameBar(WINDOW.width + 2 * T, T, 0.16, 0, WINDOW.top + T / 2, -0.04);           // lart
frameBar(WINDOW.width + 2 * T, T, 0.16, 0, WINDOW.bottom - T / 2, -0.04);        // poshte
frameBar(T, winH, 0.16, -WINDOW.width / 2 - T / 2, winMid, -0.04);               // majtas
frameBar(T, winH, 0.16, WINDOW.width / 2 + T / 2, winMid, -0.04);                // djathtas
frameBar(0.04, winH, 0.05, 0, winMid, -0.06);                                    // vertikal
frameBar(WINDOW.width, 0.04, 0.05, 0, WINDOW.bottom + winH * 0.62, -0.06);       // horizontal
frameBar(WINDOW.width + 0.3, 0.035, 0.2, 0, WINDOW.bottom - 0.08, 0.06);         // parvazi

// Shufra e perdeve
const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, WINDOW.width + 1.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.8, roughness: 0.35 })
);
rod.rotation.z = Math.PI / 2;
rod.position.set(0, WINDOW.top + 0.18, 0.12);
windowGroup.add(rod);

// Perde me dele (plane e deformuar me sinus)
const curtainMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9cbb4,
    roughness: 0.95,
    side: THREE.DoubleSide,
    normalMap: loadTexture('textures/caban/caban_nor_gl_1k.jpg', { repeat: [2, 6] }),
});
function curtain(x) {
    const width = 0.55;
    const height = WINDOW.top + 0.16;
    const geometry = new THREE.PlaneGeometry(width, height, 48, 1);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(pos.getX(i) * 38) * 0.035);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, curtainMaterial);
    mesh.position.set(x, height / 2 + 0.02, 0.1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    windowGroup.add(mesh);
}
curtain(-WINDOW.width / 2 - 0.2);
curtain(WINDOW.width / 2 + 0.2);


// ---------------------------------------------------------------------------
// Qilimat (kuti te holla me bordure)
// ---------------------------------------------------------------------------

function makeRug(x, z, width, depth, color, borderColor) {
    const border = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.01, depth),
        new THREE.MeshStandardMaterial({ color: borderColor, roughness: 1 })
    );
    border.position.set(x, 0.005, z);
    border.receiveShadow = true;
    scene.add(border);

    const repeat = [width * 1.5, depth * 1.5];
    const rug = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.2, 0.012, depth - 0.2),
        new THREE.MeshStandardMaterial({
            color,
            roughness: 1,
            normalMap: loadTexture('textures/caban/caban_nor_gl_1k.jpg', { repeat }),
        })
    );
    rug.position.set(x, 0.006, z);
    rug.receiveShadow = true;
    scene.add(rug);
}

makeRug(TABLE_X, TABLE_Z, 3.4, 2.6, 0xc9bca6, 0x5b4636); // nen tavoline
makeRug(2.35, -1.45, 2.6, 1.9, 0x9a6b52, 0xd8cbb6);      // ne kendin e ndenjes


// ---------------------------------------------------------------------------
// Dritat
// ---------------------------------------------------------------------------

const hemiLight = new THREE.HemisphereLight(0xfff4e6, 0x3b3026, 0.5);
scene.add(hemiLight);

// Dielli hyn vetem neper dritare (muret dhe tavani i bejne hije)
const sun = new THREE.DirectionalLight(0xffeccc, 7.0);
// Kendi zgjidhet qe njolla e diellit te bjere ne dysheme para tavolines
sun.position.set(-9.5, 6, -2.8);
sun.target.position.set(-1.5, 0, 1.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -7;
sun.shadow.camera.right = 7;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -7;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 25;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// Drite e bute mbushese nga ana e dhomes
const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(4, 5, 6);
scene.add(fillLight);

const lampLights = [];
const lampGlobes = [];


// ---------------------------------------------------------------------------
// Modelet nga Poly Haven
// ---------------------------------------------------------------------------

async function buildRoom() {
    const [
        table, chair, lamp, cabinet, vase, plant, frame, sofa, shelves, coffeeTable, armchair,
    ] = await Promise.all([
        loadModel('wooden_table_02'),
        loadModel('dining_chair_02'),
        loadModel('modern_ceiling_lamp_01'),
        loadModel('modern_wooden_cabinet'),
        loadModel('ceramic_vase_01'),
        loadModel('potted_plant_02'),
        loadModel('hanging_picture_frame_02'),
        loadModel('sofa_02'),
        loadModel('wooden_display_shelves_01'),
        loadModel('modern_coffee_table_01'),
        loadModel('mid_century_lounge_chair'),
    ]);

    // --- Tavolina ---
    // Modeli origjinal eshte 1.13 x 0.80 x 0.71 m (tavoline e vogel), e zgjasim
    // dhe e zgjerojme qe te behet tavoline ngrenieje per 6 persona (~2.15 x 0.92 m).
    const tableSize = place(table, { x: TABLE_X, z: TABLE_Z, scale: [1.9, 1.0, 1.3] });
    const halfLength = tableSize.x / 2;
    const halfDepth = tableSize.z / 2;

    // --- Karriget ---
    // I njejti model klonohet 6 here. Cdo karrige ka shkallen, pozicionin dhe
    // rrotullimin e vet: modeli shikon kah +z, prandaj rrotullohet qe te shikoje tavolinen.
    const chairs = [
        // ana e prapme e tavolines (shikojne kah +z, pa rrotullim)
        { x: TABLE_X - 0.5, z: TABLE_Z - halfDepth - 0.2, rotY: 0, scale: 1.05 },
        { x: TABLE_X + 0.5, z: TABLE_Z - halfDepth - 0.2, rotY: -0.05, scale: 1.05 },
        // ana e perparme (rrotullim 180 grade); njera eshte e terhequr pak jashte
        { x: TABLE_X - 0.5, z: TABLE_Z + halfDepth + 0.2, rotY: Math.PI, scale: 1.05 },
        { x: TABLE_X + 0.58, z: TABLE_Z + halfDepth + 0.48, rotY: Math.PI + 0.38, scale: 1.05 },
        // kokat e tavolines (rrotullim +/-90 grade), pak me te medha
        { x: TABLE_X - halfLength - 0.18, z: TABLE_Z, rotY: Math.PI / 2, scale: 1.12 },
        { x: TABLE_X + halfLength + 0.18, z: TABLE_Z, rotY: -Math.PI / 2, scale: 1.12 },
    ];
    for (const c of chairs) {
        place(chair.clone(), c);
    }

    // --- Vazo ne mes te tavolines ---
    place(vase.clone(), { x: TABLE_X, z: TABLE_Z, y: tableSize.y, scale: 0.85 });

    // --- Llambat mbi tavoline, te varura nga tavani ---
    for (const offset of [-0.55, 0.55]) {
        const l = lamp.clone();
        l.scale.setScalar(0.95);
        const lampTop = sizeOf(l).y + 0.221 * 0.95; // modeli fillon ne y = 0.221
        l.position.set(TABLE_X + offset, ROOM_H - lampTop, TABLE_Z);
        scene.add(l);

        l.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = false; // qe drita brenda globit te mos bllokohet
            if (child.material.name === 'modern_ceiling_globe') {
                child.material = child.material.clone();
                lampGlobes.push(child.material);
            }
        });

        const globeBox = new THREE.Box3();
        l.traverse((child) => {
            if (child.isMesh && child.material.name === 'modern_ceiling_globe') globeBox.expandByObject(child);
        });
        const globeCenter = globeBox.isEmpty()
            ? new THREE.Vector3(l.position.x, l.position.y + 0.4, l.position.z)
            : globeBox.getCenter(new THREE.Vector3());

        const light = new THREE.PointLight(0xffc98a, 0, 0, 2);
        light.position.copy(globeCenter);
        light.castShadow = true;
        light.shadow.mapSize.set(512, 512);
        light.shadow.bias = -0.002;
        scene.add(light);
        lampLights.push(light);
    }

    // --- Bufeja prane murit te prapem ---
    const cabinetSize = sizeOf(cabinet);
    const cabinetScale = 2.0 / cabinetSize.x; // e pershtasim ne 2 m gjeresi
    const cabinetPlaced = place(cabinet, {
        x: TABLE_X,
        z: -ROOM_D / 2 + (cabinetSize.z * cabinetScale) / 2 + 0.03,
        scale: cabinetScale,
    });
    place(vase.clone(), { x: TABLE_X - 0.65, z: -ROOM_D / 2 + 0.25, y: cabinetPlaced.y, scale: 0.7 });
    place(vase.clone(), { x: TABLE_X - 0.42, z: -ROOM_D / 2 + 0.27, y: cabinetPlaced.y, scale: 0.5 });

    // --- Pikturat ne murin e prapem ---
    // Xhami i kornizes vjen shume i erret, e bejme pothuajse te tejdukshem
    frame.traverse((child) => {
        if (child.isMesh && child.material.name.endsWith('_glass')) {
            child.material.map = null;
            child.material.color.set(0xffffff);
            child.material.transparent = true;
            child.material.opacity = 0.08;
            child.material.roughness = 0.05;
            child.castShadow = false;
        }
    });
    const bigFrame = frame.clone();
    bigFrame.scale.setScalar(1.9);
    bigFrame.position.set(TABLE_X, 1.95, 0.005);
    backWall.decor.add(bigFrame);

    // --- Kendi i ndenjes: divani dhe pikturat sipri ---
    const SOFA_X = 2.35;
    const sofaSize = sizeOf(sofa);
    place(sofa, { x: SOFA_X, z: -ROOM_D / 2 + sofaSize.z / 2 + 0.05 });

    for (const dx of [-0.4, 0.4]) {
        const small = frame.clone();
        small.scale.setScalar(0.85);
        small.position.set(SOFA_X + dx, 1.75, 0.005);
        backWall.decor.add(small);
    }

    // Tavolina e kafes: modeli eshte i gjate sipas z, e rrotullojme 90 grade
    const coffeeSize = place(coffeeTable, { x: SOFA_X, z: -1.2, rotY: Math.PI / 2 });
    place(vase.clone(), { x: SOFA_X + 0.35, z: -1.2, y: coffeeSize.y, scale: 0.55 });

    // Kolltuku perballe divanit, i kthyer pak nga tavolina e kafes
    place(armchair, { x: 2.85, z: 0.15, rotY: Math.PI + 0.3, scale: 0.92 });

    // --- Rafti prane murit te majte ---
    const shelvesSize = sizeOf(shelves);
    // modeli shikon kah -x, e rrotullojme 180 grade qe sirtaret te shohin dhomen
    place(shelves, { x: -ROOM_W / 2 + shelvesSize.x / 2 + 0.03, z: -1.85, rotY: Math.PI });

    // --- Bimet ne kende ---
    place(plant.clone(), { x: 0.75, z: -ROOM_D / 2 + 0.4, scale: 1.15, rotY: 0.6 });
    place(plant.clone(), { x: -ROOM_W / 2 + 0.45, z: ROOM_D / 2 - 0.45, scale: 1.35, rotY: 2.1 });

    // Hapet direkt ne modalitetin e nates me ?nate ne URL
    setDayMode(!new URLSearchParams(location.search).has('nate'));
}

buildRoom().catch((err) => {
    console.error(err);
    loadingEl.textContent = 'Gabim gjate ngarkimit te modeleve (shih konsolen).';
});


// ---------------------------------------------------------------------------
// Dite / nate
// ---------------------------------------------------------------------------

let isDay = true;
function setDayMode(day) {
    isDay = day;
    sun.visible = day;
    fillLight.intensity = day ? 0.35 : 0.08;
    hemiLight.intensity = day ? 0.5 : 0.08;
    scene.environmentIntensity = day ? 0.35 : 0.08;
    glassMaterial.map = day ? daySky : nightSky;
    for (const light of lampLights) light.intensity = day ? 0 : 6;
    for (const m of lampGlobes) {
        m.emissive.set(0xffd6a0);
        m.emissiveIntensity = day ? 0 : 3;
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'n' || e.key === 'N') setDayMode(!isDay);
});


// ---------------------------------------------------------------------------
// Animimi
// ---------------------------------------------------------------------------

const toCamera = new THREE.Vector3();
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Fshih dekorimet e mureve qe jane nga ana e kameres (muri vete eshte i njeanshem)
    for (const w of walls) {
        toCamera.subVectors(camera.position, w.group.position);
        w.decor.visible = toCamera.dot(w.normal) > 0;
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
