
    import * as THREE from 'three';
    import GUI from 'https://esm.sh/lil-gui';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { TransformControls } from 'three/addons/controls/TransformControls.js';

    // -----------------------------------------------------------------
    // ENGINE HOOKUP — reuses the project's own scene/ground/lighting
    // when the modules are reachable at these paths. If they aren't
    // (e.g. this file is opened standalone, or the paths differ in your
    // project), we fall back to a minimal built-in scene so the tool
    // still works for tuning character/camera feel in isolation.
    // Swap the paths below if your engine modules live elsewhere.
    // -----------------------------------------------------------------
    let scene, camera, renderer;
    let usingFallbackScene = false;
    // Everything the character can collide with lives here. In the real
    // engine path this is exactly the group returned by buildWorld(), so
    // collision automatically covers whatever obstacles world.js defines
    // (crates, walls, rocks, ...) without this file needing to know their
    // shapes — we only ever read their bounding boxes, generically.
    let environmentGroup = null;
    let worldCollider = null;
    let worldBvhHelper = null;

    const _tempBox = new THREE.Box3();
    const _tempMat = new THREE.Matrix4();
    const _tempSegment = new THREE.Line3();
    const _tempVector = new THREE.Vector3();
    const _tempVector2 = new THREE.Vector3();
    const _deltaVector = new THREE.Vector3();

    async function setupScene() {
        const canvas = document.createElement('canvas');
        document.body.insertBefore(canvas, document.body.firstChild);

        try {
            const core = await import('./src/lib/engine/core.js');
            const world = await import('./src/lib/engine/world.js');
            const lighting = await import('./src/lib/engine/lighting.js');

            const built = core.createCore(canvas);
            scene = built.scene; camera = built.camera; renderer = built.renderer;
            lighting.buildLighting(scene);
            const { group, collider, bvhHelper } = world.buildWorld(scene); // real level, real obstacles
            environmentGroup = group;
            worldCollider = collider;
            worldBvhHelper = bvhHelper;
        } catch (err) {
            console.warn('Project engine modules not found — using a standalone fallback scene.', err);
            usingFallbackScene = true;

            renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a1a2e);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

            const hemi = new THREE.HemisphereLight(0xffffff, 0x33334d, 1.1);
            scene.add(hemi);
            const dir = new THREE.DirectionalLight(0xffffff, 1.1);
            dir.position.set(15, 25, 10);
            scene.add(dir);

            const ground = new THREE.Mesh(
                new THREE.PlaneGeometry(300, 300),
                new THREE.MeshStandardMaterial({ color: 0x2e7d32 })
            );
            ground.rotation.x = -Math.PI / 2;
            scene.add(ground);
            scene.add(new THREE.GridHelper(300, 60, 0x555555, 0x333333));

            // Placeholder obstacles so collision is testable even without
            // the project's real world.js — swap for the real thing once
            // this runs inside your app.
            environmentGroup = new THREE.Group();
            scene.add(environmentGroup);
            const demoMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
            const crateGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
            const demoLayout = [
                { geo: crateGeo, pos: [4, 0.55, 0] },
                { geo: crateGeo, pos: [4, 0.55, 1.3] },
                { geo: new THREE.BoxGeometry(4, 1.4, 0.4), pos: [-5, 0.7, 0] },
                { geo: new THREE.CylinderGeometry(0.5, 0.5, 1.0, 12), pos: [0, 0.5, 5] },
            ];
            demoLayout.forEach(({ geo, pos }) => {
                const mesh = new THREE.Mesh(geo, demoMat);
                mesh.position.set(...pos);
                environmentGroup.add(mesh);
            });
        }

        document.getElementById('hud-engine-warning').style.display = usingFallbackScene ? 'block' : 'none';
    }

    await setupScene();

    window.addEventListener('resize', () => {
        const w = window.innerWidth, h = window.innerHeight;
        if (camera.isPerspectiveCamera) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
        renderer.setSize(w, h);
    });

    // -----------------------------------------------------------------
    // CHARACTER — simple primitive-based stand-in (cylinder body + head
    // + a forward-facing nose cone so rotation is visually obvious).
    // Built from basic geometry rather than CapsuleGeometry to avoid
    // any three.js-version compatibility surprises — swap in your real
    // character mesh/model here once you're happy with the feel.
    // -----------------------------------------------------------------
    const charGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x42a5f5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16), bodyMat);
    body.position.y = 0.6 + 0.35;
    charGroup.add(body);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc80 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), headMat);
    head.position.y = 1.2 + 0.35 + 0.28;
    charGroup.add(head);

    const noseMat = new THREE.MeshStandardMaterial({ color: 0xe53935 });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.2 + 0.35, 0.35);
    charGroup.add(nose);

    scene.add(charGroup);

    // -----------------------------------------------------------------
    // COLLISION — generic, shape-agnostic: we compute an axis-aligned
    // bounding box (THREE.Box3) for every top-level child of the
    // environment group, regardless of what it actually is (crate, wall,
    // rock, tree, compound object, ...). This means it automatically
    // covers whatever world.js's obstacleDefs produce — no per-type
    // logic needed here, unlike the level editor which had to know each
    // type's floor offset.
    //
    // The character is treated as a vertical cylinder (radius/height
    // tunable in the GUI). Two things happen every frame:
    //   1. Horizontal push-out against any box the character's height
    //      range overlaps (so you can't walk through crates/walls/rocks).
    //   2. A "support height" query used for gravity, so falling onto an
    //      obstacle lands you on top of it instead of inside/through it
    //      (e.g. jump onto a crate). Walking into the side of something
    //      taller than you just blocks you, same as a real obstacle.
    // -----------------------------------------------------------------
    let obstacleBoxes = [];
    let collisionHelpers = null;
    
    // Character Collision Helper
    const charCollisionGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
    const charCollisionMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.5 });
    const charCollisionHelper = new THREE.Mesh(charCollisionGeo, charCollisionMat);
    charCollisionHelper.visible = false;
    scene.add(charCollisionHelper);

    const STEP_EPS = 0.05;

    function rebuildCollisionBoxes() {
        if (worldCollider) {
            worldCollider.material = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, 
                wireframe: true, 
                transparent: true, 
                opacity: 0.5 
            });
            worldCollider.visible = params.showCollisionBoxes;
            if (worldBvhHelper) worldBvhHelper.visible = false;
            document.getElementById('hud-obstacles').textContent = 'Wireframe';
            return;
        }

        obstacleBoxes = [];
        if (collisionHelpers) {
            scene.remove(collisionHelpers);
            collisionHelpers = null;
        }
        if (!environmentGroup) return;

        collisionHelpers = new THREE.Group();
        collisionHelpers.visible = params.showCollisionBoxes;
        scene.add(collisionHelpers);

        environmentGroup.children.forEach((obj) => {
            const box = new THREE.Box3().setFromObject(obj);
            if (box.isEmpty()) return;
            obstacleBoxes.push(box);

            const helper = new THREE.Box3Helper(box, 0xffeb3b);
            collisionHelpers.add(helper);
        });
        document.getElementById('hud-obstacles').textContent = obstacleBoxes.length;
    }

    function getSupportHeight(x, z) {
        let support = params.groundY;
        if (!params.enableCollisions) return support;
        for (const box of obstacleBoxes) {
            if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) {
                if (box.max.y > support) support = box.max.y;
            }
        }
        return support;
    }

    function resolveHorizontalCollisions(pos, radius, height) {
        if (!params.enableCollisions) return;
        for (const box of obstacleBoxes) {
            const feetY = pos.y;
            const headY = pos.y + height;
            // Already standing on top of this box (or above it) — don't
            // also push horizontally, or you'd jitter off the edge.
            if (feetY >= box.max.y - STEP_EPS) continue;
            // Fully below the box's underside — nothing to collide with.
            if (headY <= box.min.y) continue;

            const closestX = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x);
            const closestZ = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z);
            const dx = pos.x - closestX;
            const dz = pos.z - closestZ;
            const distSq = dx * dx + dz * dz;

            if (distSq < radius * radius) {
                const dist = Math.sqrt(distSq);
                if (dist < 1e-5) {
                    // Center is inside the box footprint (rare) — push out
                    // along the box's own center-to-character direction.
                    const cx = (box.min.x + box.max.x) / 2;
                    const cz = (box.min.z + box.max.z) / 2;
                    let ndx = pos.x - cx, ndz = pos.z - cz;
                    const nlen = Math.hypot(ndx, ndz) || 1;
                    ndx /= nlen; ndz /= nlen;
                    pos.x += ndx * radius;
                    pos.z += ndz * radius;
                } else {
                    const overlap = radius - dist;
                    pos.x += (dx / dist) * overlap;
                    pos.z += (dz / dist) * overlap;
                }
            }
        }
    }

    // -----------------------------------------------------------------
    // PARAMETERS — every one of these is live: the physics/camera loop
    // below reads straight from this object every frame, so dragging a
    // slider changes behavior immediately, no "apply" step needed.
    // -----------------------------------------------------------------
    const params = {
        // Start / respawn
        startX: 0, startY: 0, startZ: 0,

        // Keybindings
        keyForward: 'KeyW',
        keyBackward: 'KeyS',
        keyLeft: 'KeyA',
        keyRight: 'KeyD',
        keyJump: 'Space',
        keySprint: 'ShiftLeft',

        // Movement
        moveSpeed: 5,
        sprintMultiplier: 1.8,
        turnSpeed: 12,

        // Physics
        enableGravity: true,
        gravity: -20,
        jumpForce: 8,
        maxFallSpeed: -30,
        groundY: 0,

        // Camera
        cameraMode: 'follow', // 'follow' | 'free'
        followOffsetX: 0,
        followOffsetY: 3.2,
        followOffsetZ: 6.5,
        followSmoothing: 0.15,
        autoAlign: true,
        autoAlignForce: 2.0,
        freeX: 10, freeY: 8, freeZ: 10,
        freeLookAtChar: true,

        // Collision
        enableCollisions: true,
        charRadius: 0.4,
        charHeight: 1.8,
        showCollisionBoxes: false,
        showCharCollision: false,
    };

    rebuildCollisionBoxes();

    let velocityY = 0;
    let grounded = true;

    function respawn() {
        const support = getSupportHeight(params.startX, params.startZ);
        charGroup.position.set(params.startX, support + Math.max(0, params.startY), params.startZ);
        charGroup.rotation.y = 0;
        velocityY = 0;
        grounded = true;
    }
    respawn();

    // -----------------------------------------------------------------
    // CAMERA — Follow: locked third-person chase cam computed from the
    // character's facing direction, smoothed with a lerp. Free: normal
    // OrbitControls you can drag around, plus explicit XYZ fields you
    // can "snap" the camera to for reproducible framing.
    // -----------------------------------------------------------------
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;

    let guiCtrlOffsetX, guiCtrlOffsetY, guiCtrlOffsetZ;
    const camVizGroup = new THREE.Group();
    camVizGroup.visible = false;
    scene.add(camVizGroup);

    const dummyCamBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    const dummyCamLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    dummyCamLens.rotation.x = Math.PI / 2;
    dummyCamLens.position.set(0, 0, -0.25);
    const dummyCamMesh = new THREE.Group();
    dummyCamMesh.add(dummyCamBody);
    dummyCamMesh.add(dummyCamLens);
    camVizGroup.add(dummyCamMesh);

    const orbitLineMat = new THREE.LineBasicMaterial({ color: 0xcddc39 }); // lime/yellow
    const orbitLineGeo = new THREE.BufferGeometry();
    const orbitLine = new THREE.LineLoop(orbitLineGeo, orbitLineMat);
    camVizGroup.add(orbitLine);

    let cameraYaw = Math.PI;

    const tControls = new TransformControls(camera, renderer.domElement);
    tControls.attach(dummyCamMesh);
    tControls.setMode('translate');
    camVizGroup.add(tControls.getHelper());

    function updateOrbitVisuals() {
        const pts = [];
        const numPts = 64;
        const radius = Math.hypot(params.followOffsetX, params.followOffsetZ);
        
        for(let i=0; i<numPts; i++) {
            const th = (i / numPts) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.sin(th) * radius, params.followOffsetY, Math.cos(th) * radius));
        }
        orbitLineGeo.setFromPoints(pts);
        orbitLine.position.copy(charGroup.position);

        if (!tControls.dragging) {
            const offset = new THREE.Vector3(params.followOffsetX, params.followOffsetY, params.followOffsetZ);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
            dummyCamMesh.position.copy(charGroup.position).add(offset);
        }
        
        dummyCamMesh.lookAt(charGroup.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    }

    tControls.addEventListener('dragging-changed', (event) => {
        orbit.enabled = !event.value && (params.cameraMode === 'free');
    });

    tControls.addEventListener('change', () => {
        if (!tControls.dragging) return;
        
        const localPos = dummyCamMesh.position.clone().sub(charGroup.position);
        localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -cameraYaw);

        params.followOffsetX = localPos.x;
        params.followOffsetY = localPos.y;
        params.followOffsetZ = localPos.z;
        
        if (guiCtrlOffsetX) guiCtrlOffsetX.updateDisplay();
        if (guiCtrlOffsetY) guiCtrlOffsetY.updateDisplay();
        if (guiCtrlOffsetZ) guiCtrlOffsetZ.updateDisplay();
        
        updateOrbitVisuals();
    });

    function applyCameraMode() {
        orbit.enabled = (params.cameraMode === 'free');
        if (camVizGroup) camVizGroup.visible = (params.cameraMode === 'free');
        if (params.cameraMode === 'free') {
            camera.position.set(params.freeX, params.freeY, params.freeZ);
            if (params.freeLookAtChar) orbit.target.copy(charGroup.position);
            orbit.update();
        }
    }
    applyCameraMode();

    let isDraggingCam = false;
    let lastPointerX = 0;

    window.addEventListener('pointerdown', (e) => {
        if (params.cameraMode !== 'follow') return;
        isDraggingCam = true;
        lastPointerX = e.clientX;
    });
    window.addEventListener('pointerup', () => { isDraggingCam = false; });
    window.addEventListener('pointermove', (e) => {
        if (params.cameraMode !== 'follow' || !isDraggingCam) return;
        cameraYaw -= (e.clientX - lastPointerX) * 0.005;
        lastPointerX = e.clientX;
    });

    const _idealOffset = new THREE.Vector3();
    const _idealLookAt = new THREE.Vector3();

    function updateFollowCamera(dt) {
        if (params.autoAlign && !isDraggingCam) {
            cameraYaw = smoothAngle(cameraYaw, charGroup.rotation.y + Math.PI, params.autoAlignForce * dt);
        }

        _idealOffset
            .set(params.followOffsetX, params.followOffsetY, params.followOffsetZ)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw)
            .add(charGroup.position);
            
        camera.position.lerp(_idealOffset, THREE.MathUtils.clamp(params.followSmoothing, 0.01, 1));
        
        _idealLookAt.copy(charGroup.position).add(new THREE.Vector3(0, 1.2, 0));
        camera.lookAt(_idealLookAt);
    }

    function updateFreeCamera() {
        if (params.freeLookAtChar) orbit.target.copy(charGroup.position);
        orbit.update();
    }

    // -----------------------------------------------------------------
    // INPUT
    // -----------------------------------------------------------------
    const keys = new Set();
    function isTypingInField(e) {
        const tag = e.target.tagName;
        return tag === 'TEXTAREA' || tag === 'INPUT';
    }
    window.addEventListener('keydown', (e) => {
        if (isTypingInField(e)) return;
        keys.add(e.code);
        if (e.code === params.keyJump) {
            e.preventDefault();
            if (params.enableGravity && grounded) {
                velocityY = params.jumpForce;
                grounded = false;
            } else if (!params.enableGravity) {
                // no-gravity "fly mode": Space/Shift move straight up/down
            }
        }
    });
    window.addEventListener('keyup', (e) => { keys.delete(e.code); });

    function smoothAngle(current, target, rate) {
        let diff = target - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const step = THREE.MathUtils.clamp(rate, 0, 1) * diff;
        return current + step;
    }

    // -----------------------------------------------------------------
    // MAIN LOOP
    // -----------------------------------------------------------------
    const clock = new THREE.Clock();

    function updateCharacter(dt) {
        let inputX = 0, inputZ = 0;
        if (keys.has(params.keyForward) || keys.has('ArrowUp')) inputZ -= 1;
        if (keys.has(params.keyBackward) || keys.has('ArrowDown')) inputZ += 1;
        if (keys.has(params.keyLeft) || keys.has('ArrowLeft')) inputX -= 1;
        if (keys.has(params.keyRight) || keys.has('ArrowRight')) inputX += 1;

        const sprinting = keys.has(params.keySprint) || keys.has('ShiftRight');
        const speed = params.moveSpeed * (sprinting ? params.sprintMultiplier : 1);

        if (inputX !== 0 || inputZ !== 0) {
            const len = Math.hypot(inputX, inputZ);
            inputX /= len; inputZ /= len;

            const camForward = new THREE.Vector3();
            camera.getWorldDirection(camForward);
            camForward.y = 0;
            if (camForward.lengthSq() < 1e-6) camForward.set(0, 0, -1);
            camForward.normalize();
            const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).negate();

            const moveDir = new THREE.Vector3()
                .addScaledVector(camForward, -inputZ)
                .addScaledVector(camRight, inputX);
            if (moveDir.lengthSq() > 1e-6) {
                moveDir.normalize();
                charGroup.position.addScaledVector(moveDir, speed * dt);
                if (!worldCollider) {
                    resolveHorizontalCollisions(charGroup.position, params.charRadius, params.charHeight);
                }
                const targetYaw = Math.atan2(moveDir.x, moveDir.z);
                charGroup.rotation.y = smoothAngle(charGroup.rotation.y, targetYaw, params.turnSpeed * dt);
            }
        }

        if (worldCollider && worldCollider.geometry.boundsTree && params.enableCollisions) {
            if (params.enableGravity) {
                velocityY += params.gravity * dt;
                velocityY = Math.max(velocityY, params.maxFallSpeed);
                charGroup.position.y += velocityY * dt;
            } else {
                let vertical = 0;
                if (keys.has('Space')) vertical += 1;
                if (sprinting) vertical -= 1;
                charGroup.position.y += vertical * speed * dt;
                velocityY = 0;
            }

            const bvh = worldCollider.geometry.boundsTree;
            _tempBox.makeEmpty();
            _tempMat.copy(worldCollider.matrixWorld).invert();
            
            _tempSegment.start.set(0, params.charRadius, 0).add(charGroup.position).applyMatrix4(_tempMat);
            _tempSegment.end.set(0, params.charHeight - params.charRadius, 0).add(charGroup.position).applyMatrix4(_tempMat);

            _tempBox.expandByPoint(_tempSegment.start);
            _tempBox.expandByPoint(_tempSegment.end);
            _tempBox.min.addScalar(-params.charRadius);
            _tempBox.max.addScalar(params.charRadius);

            bvh.shapecast({
                intersectsBounds: (box) => box.intersectsBox(_tempBox),
                intersectsTriangle: (tri) => {
                    const distance = tri.closestPointToSegment(_tempSegment, _tempVector, _tempVector2);
                    if (distance < params.charRadius) {
                        const depth = params.charRadius - distance;
                        const direction = _tempVector2.sub(_tempVector).normalize();
                        _tempSegment.start.addScaledVector(direction, depth);
                        _tempSegment.end.addScaledVector(direction, depth);
                    }
                }
            });

            const newPosition = _tempVector.copy(_tempSegment.start).applyMatrix4(worldCollider.matrixWorld);
            newPosition.y -= params.charRadius;

            _deltaVector.subVectors(newPosition, charGroup.position);
            charGroup.position.copy(newPosition);

            if (_deltaVector.y > 0.001 && velocityY < 0) {
                velocityY = 0;
                grounded = true;
            } else {
                grounded = false;
            }
        } else {
            if (params.enableGravity) {
                velocityY += params.gravity * dt;
                velocityY = Math.max(velocityY, params.maxFallSpeed);
                charGroup.position.y += velocityY * dt;
                const support = getSupportHeight(charGroup.position.x, charGroup.position.z);
                if (charGroup.position.y <= support) {
                    charGroup.position.y = support;
                    velocityY = 0;
                    grounded = true;
                } else {
                    grounded = false;
                }
            } else {
                // Fly mode: Space / Shift move straight up/down, no falling.
                let vertical = 0;
                if (keys.has('Space')) vertical += 1;
                if (sprinting) vertical -= 1;
                charGroup.position.y += vertical * speed * dt;
                velocityY = 0;
                const support = getSupportHeight(charGroup.position.x, charGroup.position.z);
                grounded = Math.abs(charGroup.position.y - support) < 0.01;
            }
        }
    }

    function refreshHud() {
        const p = charGroup.position;
        document.getElementById('hud-pos').textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
        document.getElementById('hud-grounded').textContent = grounded ? 'yes' : 'no';
        document.getElementById('hud-vspeed').textContent = velocityY.toFixed(2);
        document.getElementById('hud-cam').textContent = params.cameraMode;
    }

    function animate() {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05); // clamp to avoid big jumps on tab-switch

        updateCharacter(dt);

        if (charCollisionHelper) {
            charCollisionHelper.visible = params.showCharCollision;
            if (params.showCharCollision) {
                // CylinderGeometry is radius 1, height 1
                charCollisionHelper.scale.set(params.charRadius, params.charHeight, params.charRadius);
                charCollisionHelper.position.copy(charGroup.position);
                charCollisionHelper.position.y += params.charHeight / 2;
            }
        }

        if (params.cameraMode === 'follow') {
            updateFollowCamera(dt);
        } else {
            updateFreeCamera();
            updateOrbitVisuals();
        }

        refreshHud();
        renderer.render(scene, camera);
    }
    animate();

    // -----------------------------------------------------------------
    // GUI — every tunable parameter as a live slider / checkbox / dropdown.
    // -----------------------------------------------------------------
    const gui = new GUI();

    const keysFolder = gui.addFolder('Key Bindings');
    keysFolder.add(params, 'keyForward').name('Forward');
    keysFolder.add(params, 'keyBackward').name('Backward');
    keysFolder.add(params, 'keyLeft').name('Left');
    keysFolder.add(params, 'keyRight').name('Right');
    keysFolder.add(params, 'keyJump').name('Jump');
    keysFolder.add(params, 'keySprint').name('Sprint');

    const startFolder = gui.addFolder('Start Position');
    startFolder.add(params, 'startX', -50, 50, 0.5).name('Start X');
    startFolder.add(params, 'startY', -10, 20, 0.5).name('Start Y');
    startFolder.add(params, 'startZ', -50, 50, 0.5).name('Start Z');
    startFolder.add({ respawn }, 'respawn').name('Respawn Here');

    const moveFolder = gui.addFolder('Movement');
    moveFolder.add(params, 'moveSpeed', 0.5, 20, 0.1).name('Move Speed');
    moveFolder.add(params, 'sprintMultiplier', 1, 4, 0.1).name('Sprint x (Shift)');
    moveFolder.add(params, 'turnSpeed', 1, 30, 0.5).name('Turn Speed');

    const physicsFolder = gui.addFolder('Physics');
    physicsFolder.add(params, 'enableGravity').name('Enable Gravity').onChange(() => { velocityY = 0; });
    physicsFolder.add(params, 'gravity', -60, -1, 0.5).name('Gravity');
    physicsFolder.add(params, 'jumpForce', 0, 25, 0.5).name('Jump Force');
    physicsFolder.add(params, 'maxFallSpeed', -80, -5, 1).name('Max Fall Speed');
    physicsFolder.add(params, 'groundY', -10, 10, 0.1).name('Ground Y');

    const collisionFolder = gui.addFolder('Collision');
    collisionFolder.add(params, 'enableCollisions').name('Enable Collisions');
    collisionFolder.add(params, 'charRadius', 0.1, 2, 0.05).name('Character Radius');
    collisionFolder.add(params, 'charHeight', 0.5, 3, 0.05).name('Character Height');
    collisionFolder.add(params, 'showCollisionBoxes').name('Show World Collisions').onChange(v => {
        if (worldCollider) {
            worldCollider.visible = v;
        } else if (collisionHelpers) {
            collisionHelpers.visible = v;
        }
    });
    collisionFolder.add(params, 'showCharCollision').name('Show Char Collision');
    collisionFolder.add({ rebuild: rebuildCollisionBoxes }, 'rebuild').name('Rebuild From World');

    const camFolder = gui.addFolder('Camera');
    camFolder.add(params, 'cameraMode', ['follow', 'free']).name('Mode').onChange(applyCameraMode);

    const followFolder = camFolder.addFolder('Follow settings');
    guiCtrlOffsetX = followFolder.add(params, 'followOffsetX', -20, 20, 0.5).name('Offset X');
    guiCtrlOffsetY = followFolder.add(params, 'followOffsetY', -20, 20, 0.5).name('Offset Y');
    guiCtrlOffsetZ = followFolder.add(params, 'followOffsetZ', -20, 20, 0.5).name('Offset Z');
    followFolder.add(params, 'followSmoothing', 0.01, 1, 0.01).name('Smoothing');
    followFolder.add(params, 'autoAlign').name('Auto Align');
    followFolder.add(params, 'autoAlignForce', 0.1, 10, 0.1).name('Auto Align Force');

    const freeFolder = camFolder.addFolder('Free settings');
    freeFolder.add(params, 'freeX', -100, 100, 0.5).name('Position X');
    freeFolder.add(params, 'freeY', -20, 100, 0.5).name('Position Y');
    freeFolder.add(params, 'freeZ', -100, 100, 0.5).name('Position Z');
    freeFolder.add({ snap: () => { camera.position.set(params.freeX, params.freeY, params.freeZ); orbit.update(); } }, 'snap').name('Snap Camera Here');
    freeFolder.add(params, 'freeLookAtChar').name('Look At Character');

    // -----------------------------------------------------------------
    // EXPORT / IMPORT
    // -----------------------------------------------------------------
    const exportOverlay = document.getElementById('export-overlay');
    const importOverlay = document.getElementById('import-overlay');

    function buildExportCode() {
        const p = charGroup.position;
        return `  // Character controller config — generated by the Character & Controls Tuner.
  // Rename keys as needed to match your player/character module.
  const characterConfig = {
    startPosition: [${params.startX.toFixed(2)}, ${params.startY.toFixed(2)}, ${params.startZ.toFixed(2)}],
    keyBindings: {
      forward: '${params.keyForward}',
      backward: '${params.keyBackward}',
      left: '${params.keyLeft}',
      right: '${params.keyRight}',
      jump: '${params.keyJump}',
      run: '${params.keySprint}'
    },
    moveSpeed: ${params.moveSpeed},
    sprintMultiplier: ${params.sprintMultiplier},
    turnSpeed: ${params.turnSpeed},
    enableGravity: ${params.enableGravity},
    gravity: ${params.gravity},
    jumpForce: ${params.jumpForce},
    maxFallSpeed: ${params.maxFallSpeed},
    groundY: ${params.groundY},
    enableCollisions: ${params.enableCollisions},
    collisionRadius: ${params.charRadius},
    collisionHeight: ${params.charHeight}
  };

  const cameraConfig = {
    mode: '${params.cameraMode}',
    follow: {
      offsetX: ${params.followOffsetX},
      offsetY: ${params.followOffsetY},
      offsetZ: ${params.followOffsetZ},
      smoothing: ${params.followSmoothing},
      autoAlign: ${params.autoAlign},
      autoAlignForce: ${params.autoAlignForce}
    },
    free: {
      position: [${params.freeX}, ${params.freeY}, ${params.freeZ}],
      lookAtCharacter: ${params.freeLookAtChar}
    }
  };

  // Character position at time of export: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
    }

    document.getElementById('export-btn').addEventListener('click', () => {
        document.getElementById('code-output').value = buildExportCode();
        exportOverlay.style.display = 'flex';
    });
    document.getElementById('close-export-btn').addEventListener('click', () => {
        exportOverlay.style.display = 'none';
    });
    document.getElementById('copy-btn').addEventListener('click', async () => {
        const output = document.getElementById('code-output');
        output.select();
        try {
            await navigator.clipboard.writeText(output.value);
            const btn = document.getElementById('copy-btn');
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 1200);
        } catch (err) {
            console.warn('Clipboard copy failed, text is selected for manual copy:', err);
        }
    });

    function parseConfigObjects(text) {
        const extract = (name) => {
            const re = new RegExp(name + '\\s*=\\s*(\\{[\\s\\S]*?\\n\\s*\\};?)', 'm');
            const m = text.match(re);
            if (!m) return null;
            const literal = m[1].replace(/;\s*$/, '');
            return Function('"use strict"; return (' + literal + ');')();
        };
        const characterConfig = extract('characterConfig');
        const cameraConfig = extract('cameraConfig');
        if (!characterConfig && !cameraConfig) {
            throw new Error('Could not find a characterConfig or cameraConfig object in the pasted text.');
        }
        return { characterConfig, cameraConfig };
    }

    function applyImportedConfig(cfg) {
        const c = cfg.characterConfig;
        if (c) {
            if (c.keyBindings) {
                params.keyForward = c.keyBindings.forward || params.keyForward;
                params.keyBackward = c.keyBindings.backward || params.keyBackward;
                params.keyLeft = c.keyBindings.left || params.keyLeft;
                params.keyRight = c.keyBindings.right || params.keyRight;
                params.keyJump = c.keyBindings.jump || params.keyJump;
                params.keySprint = c.keyBindings.run || params.keySprint;
            }
            if (Array.isArray(c.startPosition)) {
                [params.startX, params.startY, params.startZ] = c.startPosition;
            }
            if (typeof c.moveSpeed === 'number') params.moveSpeed = c.moveSpeed;
            if (typeof c.sprintMultiplier === 'number') params.sprintMultiplier = c.sprintMultiplier;
            if (typeof c.turnSpeed === 'number') params.turnSpeed = c.turnSpeed;
            if (typeof c.enableGravity === 'boolean') params.enableGravity = c.enableGravity;
            if (typeof c.gravity === 'number') params.gravity = c.gravity;
            if (typeof c.jumpForce === 'number') params.jumpForce = c.jumpForce;
            if (typeof c.maxFallSpeed === 'number') params.maxFallSpeed = c.maxFallSpeed;
            if (typeof c.groundY === 'number') params.groundY = c.groundY;
            if (typeof c.enableCollisions === 'boolean') params.enableCollisions = c.enableCollisions;
            if (typeof c.collisionRadius === 'number') params.charRadius = c.collisionRadius;
            if (typeof c.collisionHeight === 'number') params.charHeight = c.collisionHeight;
        }
        const cam = cfg.cameraConfig;
        if (cam) {
            if (cam.mode === 'follow' || cam.mode === 'free') params.cameraMode = cam.mode;
            if (cam.follow) {
                if (typeof cam.follow.offsetX === 'number') params.followOffsetX = cam.follow.offsetX;
                if (typeof cam.follow.offsetY === 'number') params.followOffsetY = cam.follow.offsetY;
                if (typeof cam.follow.offsetZ === 'number') params.followOffsetZ = cam.follow.offsetZ;
                if (typeof cam.follow.smoothing === 'number') params.followSmoothing = cam.follow.smoothing;
                if (typeof cam.follow.autoAlign === 'boolean') params.autoAlign = cam.follow.autoAlign;
                if (typeof cam.follow.autoAlignForce === 'number') params.autoAlignForce = cam.follow.autoAlignForce;
            }
            if (cam.free) {
                if (Array.isArray(cam.free.position)) [params.freeX, params.freeY, params.freeZ] = cam.free.position;
                if (typeof cam.free.lookAtCharacter === 'boolean') params.freeLookAtChar = cam.free.lookAtCharacter;
            }
        }
        gui.controllersRecursive().forEach(ctrl => ctrl.updateDisplay());
        applyCameraMode();
        respawn();
    }

    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-status').textContent = '';
        document.getElementById('import-status').className = '';
        importOverlay.style.display = 'flex';
    });
    document.getElementById('close-import-btn').addEventListener('click', () => {
        importOverlay.style.display = 'none';
    });
    document.getElementById('load-btn').addEventListener('click', () => {
        const text = document.getElementById('code-input').value;
        const status = document.getElementById('import-status');
        try {
            const cfg = parseConfigObjects(text);
            applyImportedConfig(cfg);
            status.className = 'success';
            status.textContent = 'Config loaded and applied.';
        } catch (err) {
            status.className = 'error';
            status.textContent = err.message;
        }
    });

    document.getElementById('respawn-btn').addEventListener('click', respawn);

    // Esc closes overlays; ignore other global shortcuts while typing.
    window.addEventListener('keydown', (e) => {
        if (isTypingInField(e)) return;
        if (e.key === 'Escape') {
            exportOverlay.style.display = 'none';
            importOverlay.style.display = 'none';
        }
    });
