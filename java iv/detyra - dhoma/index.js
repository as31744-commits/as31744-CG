import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// Dimensionet e dhomes (ne metra): gjeresia (x), thellesia (z), lartesia (y)
const ROOM_W = 7;
const ROOM_D = 5.6;
const ROOM_H = 3.3;

// Qendra e tavolines - te gjitha karriget vendosen relativisht ndaj saj
const TABLE_X = -1.0;
const TABLE_Z = 0.2;

// Dy dritare te medha ne murin e majte, nga te dyja anet e tavolines
const WINDOWS = [-1.0, 1.4];               // pozita z e qendres se cdo dritareje
const WIN = { width: 1.35, bottom: 0.95, top: 3.0 };

// Ngjyrat e dhomes
const WALL_GREEN = 0x2f4a3d;  // jeshile e erret per muret
const CREAM = 0xf0e9dc;       // lamperia, kornizat dhe listelat
const BRASS = 0xc9a45c;


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
camera.position.set(4.8, 4.0, 6.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('scene').appendChild(renderer.domElement);

// Ambient i bute (reflektime realiste per materialet PBR te modeleve)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.5, 1.0, -0.4);
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

function box(w, h, d, material, x, y, z, parent) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}


// ---------------------------------------------------------------------------
// Dhoma: dyshemeja (parket "kurriz peshku"), muret, tavani
// ---------------------------------------------------------------------------

const floorRepeat = [ROOM_W / 1.6, ROOM_D / 1.6];
const floorMaterial = new THREE.MeshStandardMaterial({
    map: loadTexture('textures/herringbone_parquet/herringbone_parquet_diff_1k.jpg', { srgb: true, repeat: floorRepeat }),
    normalMap: loadTexture('textures/herringbone_parquet/herringbone_parquet_nor_gl_1k.jpg', { repeat: floorRepeat }),
    roughnessMap: loadTexture('textures/herringbone_parquet/herringbone_parquet_rough_1k.jpg', { repeat: floorRepeat }),
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const creamMaterial = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.55 });

// Muret jane plane te njeanshme qe shikojne nga brenda dhomes: kur kamera eshte
// jashte, muri mes kameres dhe dhomes nuk vizatohet, keshtu qe dhoma shihet si "kukull".
const walls = [];

function makeWall({ width, position, rotY, holes = [] }) {
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

    const material = new THREE.MeshStandardMaterial({ color: WALL_GREEN, roughness: 0.85 });
    material.shadowSide = THREE.DoubleSide; // muri bllokon diellin nga te dy anet
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Dekorimet e murit (lamperia, listelat, dritaret, pikturat) fshihen kur muri nuk shihet
    const decor = new THREE.Group();
    group.add(decor);

    // Lamperia krem ne pjesen e poshtme te murit, me panele te kornizuara
    const wainscot = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.92), creamMaterial);
    wainscot.position.set(0, 0.46, 0.004);
    wainscot.receiveShadow = true;
    decor.add(wainscot);
    box(width, 0.14, 0.025, creamMaterial, 0, 0.07, 0.012, decor);          // pervazi i poshtem
    box(width, 0.05, 0.04, creamMaterial, 0, 0.93, 0.02, decor);            // listela e karrigeve
    box(width, 0.10, 0.06, creamMaterial, 0, ROOM_H - 0.05, 0.03, decor);   // korniza e tavanit
    box(width, 0.03, 0.04, creamMaterial, 0, ROOM_H - 0.13, 0.02, decor);

    const panels = Math.round(width / 0.9);
    const panelW = width / panels;
    for (let i = 0; i < panels; i++) {
        const cx = -width / 2 + panelW * (i + 0.5);
        const w = panelW - 0.18;
        const y0 = 0.24, y1 = 0.78, t = 0.022;
        box(w, t, t, creamMaterial, cx, y0, 0.014, decor);
        box(w, t, t, creamMaterial, cx, y1, 0.014, decor);
        box(t, y1 - y0, t, creamMaterial, cx - w / 2, (y0 + y1) / 2, 0.014, decor);
        box(t, y1 - y0, t, creamMaterial, cx + w / 2, (y0 + y1) / 2, 0.014, decor);
    }

    scene.add(group);
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    walls.push({ group, decor, normal });
    return { group, decor };
}

const backWall = makeWall({
    width: ROOM_W,
    position: new THREE.Vector3(0, 0, -ROOM_D / 2), rotY: 0,
});
// Per murin e majte (rotY = 90 grade) boshti lokal u perputhet me -z ne bote
const leftWall = makeWall({
    width: ROOM_D,
    position: new THREE.Vector3(-ROOM_W / 2, 0, 0), rotY: Math.PI / 2,
    holes: WINDOWS.map((z) => ({ u: -z, w: WIN.width, v0: WIN.bottom, v1: WIN.top })),
});
// Per murin e djathte (rotY = -90 grade) boshti lokal u perputhet me +z ne bote
makeWall({
    width: ROOM_D,
    position: new THREE.Vector3(ROOM_W / 2, 0, 0), rotY: -Math.PI / 2,
});
makeWall({
    width: ROOM_W,
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
// Dritaret e larta me perde kadifeje (primitive)
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
const daySky = skyTexture('#7fb0dc', '#eaf2f4');
const nightSky = skyTexture('#0b1326', '#27324a');
const glassMaterial = new THREE.MeshBasicMaterial({ map: daySky });

const brassMaterial = new THREE.MeshStandardMaterial({ color: BRASS, metalness: 1, roughness: 0.3 });
const curtainMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb8955a,         // kadife ngjyre ari
    roughness: 0.8,
    sheen: 1,
    sheenColor: new THREE.Color(0xffe2a8),
    sheenRoughness: 0.4,
    side: THREE.DoubleSide,
    normalMap: loadTexture('textures/caban/caban_nor_gl_1k.jpg', { repeat: [2, 8] }),
});

function curtain(parent, x) {
    const width = 0.42;
    const height = ROOM_H - 0.22;
    const geometry = new THREE.PlaneGeometry(width, height, 48, 1);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(pos.getX(i) * 45) * 0.03);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, curtainMaterial);
    mesh.position.set(x, height / 2 + 0.02, 0.12);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
}

function makeWindow(z) {
    const group = new THREE.Group();
    // Ne koordinatat lokale te murit te majte: u = -z, v = y
    group.position.set(-z, 0, 0);
    leftWall.decor.add(group);

    const h = WIN.top - WIN.bottom;
    const mid = (WIN.top + WIN.bottom) / 2;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.width, h), glassMaterial);
    glass.position.set(0, mid, -0.06);
    group.add(glass);

    const T = 0.07; // trashesia e kornizes
    box(WIN.width + 2 * T, T, 0.18, creamMaterial, 0, WIN.top + T / 2, -0.03, group);
    box(WIN.width + 2 * T, T, 0.18, creamMaterial, 0, WIN.bottom - T / 2, -0.03, group);
    box(T, h, 0.18, creamMaterial, -WIN.width / 2 - T / 2, mid, -0.03, group);
    box(T, h, 0.18, creamMaterial, WIN.width / 2 + T / 2, mid, -0.03, group);
    // Kryqi i dritares: nje vertikal dhe dy horizontale
    box(0.045, h, 0.05, creamMaterial, 0, mid, -0.06, group);
    box(WIN.width, 0.045, 0.05, creamMaterial, 0, WIN.bottom + h * 0.33, -0.06, group);
    box(WIN.width, 0.045, 0.05, creamMaterial, 0, WIN.bottom + h * 0.72, -0.06, group);
    // Parvazi
    box(WIN.width + 0.3, 0.04, 0.22, creamMaterial, 0, WIN.bottom - 0.09, 0.06, group);

    // Shufra prej bronzi me topa ne skaje
    const rodLength = WIN.width + 0.9;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, rodLength, 16), brassMaterial);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, ROOM_H - 0.22, 0.14);
    group.add(rod);
    for (const s of [-1, 1]) {
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), brassMaterial);
        finial.position.set(s * rodLength / 2, ROOM_H - 0.22, 0.14);
        group.add(finial);
    }

    curtain(group, -WIN.width / 2 - 0.12);
    curtain(group, WIN.width / 2 + 0.12);
}
WINDOWS.forEach(makeWindow);


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
        new THREE.BoxGeometry(width - 0.24, 0.012, depth - 0.24),
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

makeRug(TABLE_X, TABLE_Z, 3.6, 2.8, 0xd8cab0, 0x7a5a32); // nen tavoline
makeRug(2.35, -1.45, 2.6, 1.9, 0x6e2f33, 0xd8c7a6);      // ne kendin e ndenjes (bordo)


// ---------------------------------------------------------------------------
// Dritat
// ---------------------------------------------------------------------------

const hemiLight = new THREE.HemisphereLight(0xfff4e6, 0x3b3026, 0.6);
scene.add(hemiLight);

// Dielli hyn vetem neper dritare (muret dhe tavani i bejne hije)
const sun = new THREE.DirectionalLight(0xffeccc, 7.0);
// Kendi zgjidhet qe njollat e diellit te bien ne dysheme rreth tavolines
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
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(4, 5, 6);
scene.add(fillLight);

const lampLights = [];
const lampGlobes = [];
const flameMaterials = [];
const candleLights = [];


// ---------------------------------------------------------------------------
// Modelet nga Poly Haven
// ---------------------------------------------------------------------------

async function buildRoom() {
    const [
        table, chair, lamp, vase, plant, painting1, painting2,
        candles, sofa, coffeeTable, armchair, console_,
    ] = await Promise.all([
        loadModel('wooden_table_02'),
        loadModel('GreenChair_01'),
        loadModel('modern_ceiling_lamp_01'),
        loadModel('ceramic_vase_01'),
        loadModel('potted_plant_02'),
        loadModel('fancy_picture_frame_01'),
        loadModel('fancy_picture_frame_02'),
        loadModel('brass_candleholders'),
        loadModel('sofa_02'),
        loadModel('modern_coffee_table_01'),
        loadModel('mid_century_lounge_chair'),
        loadModel('ClassicConsole_01'),
    ]);

    // --- Tavolina ---
    // Modeli origjinal eshte 1.13 x 0.80 x 0.71 m (tavoline e vogel), e zgjasim
    // dhe e zgjerojme qe te behet tavoline ngrenieje per 6 persona (~2.15 x 0.92 m).
    // Ngjyren e druri e erresojme pak qe te duket si arre.
    table.traverse((child) => {
        if (child.isMesh) child.material.color.set(0x9c7a62);
    });
    const tableSize = place(table, { x: TABLE_X, z: TABLE_Z, scale: [1.9, 1.0, 1.3] });
    const halfLength = tableSize.x / 2;
    const halfDepth = tableSize.z / 2;

    // --- Karriget (kolltuqe klasike me dru te gdhendur) ---
    // I njejti model klonohet 6 here. Cdo karrige ka shkallen, pozicionin dhe
    // rrotullimin e vet: modeli shikon kah +z, prandaj rrotullohet qe te shikoje tavolinen.
    const chairs = [
        // ana e prapme e tavolines (shikojne kah +z, pa rrotullim)
        { x: TABLE_X - 0.52, z: TABLE_Z - halfDepth - 0.24, rotY: 0, scale: 0.95 },
        { x: TABLE_X + 0.52, z: TABLE_Z - halfDepth - 0.24, rotY: -0.04, scale: 0.95 },
        // ana e perparme (rrotullim 180 grade); njera eshte e terhequr pak jashte
        { x: TABLE_X - 0.52, z: TABLE_Z + halfDepth + 0.24, rotY: Math.PI, scale: 0.95 },
        { x: TABLE_X + 0.6, z: TABLE_Z + halfDepth + 0.5, rotY: Math.PI + 0.35, scale: 0.95 },
        // kokat e tavolines (rrotullim +/-90 grade), pak me te medha
        { x: TABLE_X - halfLength - 0.3, z: TABLE_Z, rotY: Math.PI / 2, scale: 1.05 },
        { x: TABLE_X + halfLength + 0.3, z: TABLE_Z, rotY: -Math.PI / 2, scale: 1.05 },
    ];
    for (const c of chairs) {
        place(chair.clone(), c);
    }

    // --- Shandanet prej bronzi ---
    // Modeli ka tre shandane; i ndajme dhe i vendosim vec e vec.
    candles.traverse((child) => {
        if (child.isMesh && child.material.name === 'brass_candleholders_flame') {
            child.castShadow = false;
            child.material.emissive = new THREE.Color(0xffb04a);
            child.material.emissiveIntensity = 1.5;
            flameMaterials.push(child.material);
        }
    });
    const bigCandelabra = candles.getObjectByName('brass_candleholder_03').clone();
    const smallCandelabra = candles.getObjectByName('brass_candleholder_02').clone();
    const singleCandle = candles.getObjectByName('brass_candleholder_01').clone();

    place(bigCandelabra, { x: TABLE_X, z: TABLE_Z, y: tableSize.y, scale: 0.8 });
    place(vase.clone(), { x: TABLE_X - 0.6, z: TABLE_Z + 0.05, y: tableSize.y, scale: 0.6 });
    place(vase.clone(), { x: TABLE_X + 0.6, z: TABLE_Z - 0.05, y: tableSize.y, scale: 0.6 });

    const candleLight = new THREE.PointLight(0xffa850, 0, 3, 2);
    candleLight.position.set(TABLE_X, tableSize.y + 0.75, TABLE_Z);
    scene.add(candleLight);
    candleLights.push(candleLight);

    // --- Llambat mbi tavoline, te varura nga tavani ---
    for (const offset of [-0.65, 0.65]) {
        const l = lamp.clone();
        l.scale.setScalar(1.0);
        // modeli fillon ne y = 0.221; e zgjasim kordonin qe te arrije tavanin e larte
        const lampTop = sizeOf(l).y + 0.221;
        const extraCord = 0.55;
        l.position.set(TABLE_X + offset, ROOM_H - lampTop - extraCord, TABLE_Z);
        scene.add(l);

        const cord = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, extraCord + 0.05, 8),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        cord.position.set(TABLE_X + offset, ROOM_H - extraCord / 2, TABLE_Z);
        scene.add(cord);

        l.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = false; // qe drita brenda globit te mos bllokohet
            // xhami i jashtem eshte opak, prandaj ndricojme edhe ate (jo vetem llamben brenda)
            const name = child.material.name;
            if (name === 'modern_ceiling_globe' || name === 'modern_ceiling_lamp_01_glass') {
                child.material = child.material.clone();
                lampGlobes.push(child.material);
            }
        });

        const globeBox = new THREE.Box3();
        l.updateMatrixWorld(true);
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

    // --- Konzola klasike prane murit te prapem (1.54 m -> ~1.8 m) ---
    const consoleSize = place(console_, { x: TABLE_X, z: -ROOM_D / 2 + 0.36, scale: 1.15 });
    const shelfZ = -ROOM_D / 2 + 0.3;
    place(smallCandelabra, { x: TABLE_X - 0.6, z: shelfZ, y: consoleSize.y, scale: 1.1 });
    place(singleCandle, { x: TABLE_X + 0.6, z: shelfZ, y: consoleSize.y, scale: 1.1 });
    place(vase.clone(), { x: TABLE_X + 0.25, z: shelfZ, y: consoleSize.y, scale: 0.75 });

    // --- Pikturat me korniza te arta ---
    // Piktura e madhe mbi konzole (modeli 0.6 x 0.46 m, e shkallezojme 3 here)
    const bigPainting = painting1.clone();
    bigPainting.scale.setScalar(3.0);
    bigPainting.position.set(TABLE_X, consoleSize.y + 0.9, 0.01);
    backWall.decor.add(bigPainting);

    // --- Kendi i ndenjes: divani dhe piktura sipri ---
    const SOFA_X = 2.35;
    const sofaSize = sizeOf(sofa);
    place(sofa, { x: SOFA_X, z: -ROOM_D / 2 + sofaSize.z / 2 + 0.08 });

    const sofaPainting = painting2.clone();
    sofaPainting.scale.setScalar(1.7);
    sofaPainting.position.set(SOFA_X, 1.85, 0.01);
    backWall.decor.add(sofaPainting);

    // Tavolina e kafes: modeli eshte i gjate sipas z, e rrotullojme 90 grade
    const coffeeSize = place(coffeeTable, { x: SOFA_X, z: -1.2, rotY: Math.PI / 2 });
    place(vase.clone(), { x: SOFA_X + 0.35, z: -1.2, y: coffeeSize.y, scale: 0.55 });

    // Kolltuku perballe divanit, i kthyer pak nga tavolina e kafes
    place(armchair, { x: 2.4, z: 0.3, rotY: Math.PI + 0.25, scale: 0.92 });

    // --- Bimet ---
    place(plant.clone(), { x: 0.75, z: -ROOM_D / 2 + 0.42, scale: 1.2, rotY: 0.6 });
    place(plant.clone(), { x: -ROOM_W / 2 + 0.45, z: -ROOM_D / 2 + 0.45, scale: 1.3, rotY: 2.1 });

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
    fillLight.intensity = day ? 0.5 : 0.08;
    hemiLight.intensity = day ? 0.6 : 0.08;
    scene.environmentIntensity = day ? 0.45 : 0.08;
    glassMaterial.map = day ? daySky : nightSky;
    for (const light of lampLights) light.intensity = day ? 0 : 10;
    for (const light of candleLights) light.intensity = day ? 0 : 1.5;
    for (const m of flameMaterials) m.emissiveIntensity = day ? 1.5 : 4;
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
