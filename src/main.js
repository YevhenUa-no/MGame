import './app.css';
import { createExperience } from './lib/engine/experience.js';
import Overlay from './lib/ui/Overlay.svelte';

const canvasEl = document.querySelector('.experience-canvas');

// We no longer pass config objects from here, because we moved the
// customized values directly into the default configs of the engine files
// (player.js, cameraRig.js, etc.).
const experience = createExperience(canvasEl);
experience.start();

// Mount the Svelte Overlay UI to the #app div,
// and pass it the sendEmoji function from the experience.
const overlay = new Overlay({
  target: document.getElementById('app')
});

const loader = document.getElementById('loading-screen');
if (loader) {
  loader.style.opacity = '0';
  setTimeout(() => loader.remove(), 500);
}

export default { experience, overlay };
