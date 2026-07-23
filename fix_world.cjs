const fs = require('fs');
let code = fs.readFileSync('src/lib/engine/world.js', 'utf8');

const startIndex = code.indexOf("    case 'barrel': {");
const endIndex = code.indexOf("    case 'signpost': {");

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `    case 'barrel': {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 10);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.85 })
      );
      baseY = 0.5 * scaleY;
      break;
    }

    case 'bush': {
      const geo = new THREE.IcosahedronGeometry(0.6, 0);
      geo.scale(1, 0.8, 1);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true, roughness: 1 })
      );
      baseY = 0.5 * scaleY;
      break;
    }

    case 'tree': {
      mesh = new THREE.Group();
      const trunkHeight = 1.4;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, trunkHeight, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.95 })
      );
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 1.6, 7),
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true, roughness: 1 })
      );
      canopy.position.y = trunkHeight + 0.6;
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      mesh.add(trunk, canopy);
      baseY = 0;
      break;
    }

    case 'lamppost': {
      mesh = new THREE.Group();
      const height = 2.0;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, height, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.metal, flatShading: true, roughness: 0.6 })
      );
      pole.position.y = height / 2;
      pole.castShadow = true;
      pole.receiveShadow = true;
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.3, 0.25),
        new THREE.MeshStandardMaterial({ color: PALETTE.hay, flatShading: true, roughness: 0.4 })
      );
      lamp.position.y = height + 0.1;
      lamp.castShadow = true;
      lamp.receiveShadow = true;
      mesh.add(pole, lamp);
      baseY = 0;
      break;
    }

    case 'bench': {
      mesh = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.12, 0.45),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      seat.position.y = 0.45;
      seat.castShadow = true;
      seat.receiveShadow = true;
      const legGeo = new THREE.BoxGeometry(0.12, 0.45, 0.4);
      const legMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.6, 0.225, 0);
      legL.castShadow = true;
      legL.receiveShadow = true;
      const legR = legL.clone();
      legR.position.x = 0.6;
      mesh.add(seat, legL, legR);
      baseY = 0;
      break;
    }

    case 'firing-cannon': {
      if (!gltfCache['cannon']) {
        mesh = new THREE.Group();
        break;
      }
      mesh = SkeletonUtils.clone(gltfCache['cannon']);
      baseY = 0;

      updatables.push({
        timer: Math.random() * 2,
        mesh: mesh,
        update: function(dt, worldScene) {
          this.timer += dt;
          if (this.timer > 3) {
            this.timer = 0;
            let ball;
            if (gltfCache['cannon-ball']) {
              ball = SkeletonUtils.clone(gltfCache['cannon-ball']);
            } else {
              const ballGeo = new THREE.SphereGeometry(0.18, 16, 16);
              const ballMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
              ball = new THREE.Mesh(ballGeo, ballMat);
            }
            const offset = new THREE.Vector3(0, 0.6, 0.6);
            ball.position.copy(offset);
            ball.applyMatrix4(this.mesh.matrixWorld);
            const velocity = new THREE.Vector3(0, 0.5, 1);
            velocity.applyQuaternion(this.mesh.getWorldQuaternion(new THREE.Quaternion()));
            velocity.normalize().multiplyScalar(15);
            worldScene.add(ball);
            updatables.push({
              life: 4,
              update: function(bdt, ws, arr, idx) {
                this.life -= bdt;
                if (this.life <= 0) {
                  ws.remove(ball);
                  this.dead = true;
                  return;
                }
                velocity.y -= 20 * bdt;
                ball.position.addScaledVector(velocity, bdt);
              }
            });
          }
        }
      });
      break;
    }

`;

  const newCode = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync('src/lib/engine/world.js', newCode);
  console.log('Fixed world.js successfully!');
} else {
  console.log('Could not find start or end index.');
}
