const fs = require('fs');
const path = require('path');

const pirateDir = './public/models/pirate';
const files = fs.readdirSync(pirateDir).filter(f => f.endsWith('.glb'));
const basenames = files.map(f => f.replace('.glb', ''));

const worldJsPath = './src/lib/engine/world.js';
let worldJs = fs.readFileSync(worldJsPath, 'utf8');

// 1. Add pirateTex and loader loop
if (!worldJs.includes('const pirateFiles')) {
  const injection1 = `
const pirateTex = new THREE.TextureLoader().load('/models/pirate/Textures/colormap.png');
pirateTex.colorSpace = THREE.SRGBColorSpace;
pirateTex.flipY = false;

const pirateFiles = ${JSON.stringify(files)};
for (const file of pirateFiles) {
  try {
    const gltf = await loader.loadAsync(\`/models/pirate/\${file}\`);
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.map = pirateTex;
        child.material.needsUpdate = true;
      }
    });
    gltfCache[file.replace('.glb', '')] = model;
  } catch (e) {
    console.warn("Could not load", file, e);
  }
}
`;
  worldJs = worldJs.replace('const PALETTE = {', injection1 + '\nconst PALETTE = {');
}

// 2. Add to switch statement in createObstacle
const cases = basenames.map(b => `    case '${b}':`).join('\n');
worldJs = worldJs.replace(/case 'ship-small-ghost': \{/g, `case 'ship-small-ghost':\n${cases} {`);

// 3. Add to OBSTACLE_LIBRARY
const dictEntries = basenames.map(b => `  { type: '${b}', label: '${b.replace(/-/g, ' ')}', defaults: { scale: 1, rot: 0 } }`).join(',\n');
worldJs = worldJs.replace(/\{ type: 'cannon', label: 'Cannon', defaults: \{ scale: 1, rot: 0 \} \}/g, `{ type: 'cannon', label: 'Cannon', defaults: { scale: 1, rot: 0 } },\n${dictEntries}`);

fs.writeFileSync(worldJsPath, worldJs);

// 4. Update preview.html
const previewPath = './preview.html';
let preview = fs.readFileSync(previewPath, 'utf8');

if (!preview.includes('Kenney Pirate')) {
  const buttons = basenames.map(b => `        <button class="asset-btn" draggable="true" data-type="${b}">🏴‍☠️ ${b.replace(/-/g, ' ')}</button>`).join('\n');
  const injection2 = `
        <hr style="border-color: #555; margin: 5px 0; width: 100%;">
        <div class="section-title">Kenney Pirate</div>
${buttons}
`;
  preview = preview.replace('<div class="section-title">Selected Object</div>', injection2 + '        <div class="section-title">Selected Object</div>');
  fs.writeFileSync(previewPath, preview);
}

console.log("Successfully updated files.");
