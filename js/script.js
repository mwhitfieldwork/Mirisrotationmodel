// ===============================
// Scroll Host
// ===============================
// The parallax effect gives .parallax-container its own scrollbar (it is
// position: absolute with overflow-y: auto), so the document itself never
// scrolls. Scroll events fire there and never reach `window`, which is why
// window.scrollY reads 0 forever on this page.
const scroller = document.querySelector('.parallax-container');
const scrollSource = scroller || window;

const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);
const scrollRange = () =>
    scroller ? scroller.scrollHeight - scroller.clientHeight
             : document.documentElement.scrollHeight - window.innerHeight;

// ===============================
// State
// ===============================
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const navbar = document.querySelector('.navbar');
const wrapper = document.getElementById('model-wrapper');

const VIEWER_KEY = 'Nf4TUUp2n8RjtBCFYkU1oiQc8zdg8dTuqPYdgPM8KAA';
const ASSET_UUID = '9f48682c-ac47-49d3-a18d-85d6dbfbc982';

const NAVBAR_SCROLL_THRESHOLD = 50;
const SPIN_RANGE = Math.PI;  // half turn across the page's full scroll
const TILT_RANGE = 0.6;      // radians of pointer-driven Y rotation, each way

let heroStream = null;
let frameQueued = false;
let pointerTilt = 0;

// ===============================
// Smooth Navigation Scroll
// ===============================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ===============================
// Scroll / Pointer Logic
// ===============================
// 0 at the top of the page, 1 at the bottom. Clamped, so the model always rests
// at the same angle for a given scroll position no matter how it got there.
function scrollProgress() {
    const range = scrollRange();
    if (range <= 0) return 0;
    return Math.min(Math.max(scrollTop() / range, 0), 1);
}

// Rotate the stream itself, not the <miris-scene> element. A CSS transform would
// tilt the rendered canvas as a flat image and never reveal new geometry.
// Note: the components <miris-stream> exposes `rotation` directly. There is no
// `object3D` property — reaching for one silently yields undefined.
function updateModelRotation() {
    if (!heroStream || !heroStream.rotation) return;

    if (reducedMotion.matches) {
        heroStream.rotation.x = 0;
        heroStream.rotation.y = 0;
        return;
    }

    heroStream.rotation.y = scrollProgress() * SPIN_RANGE;
    heroStream.rotation.x = pointerTilt;

}

function updateNavbar() {
    if (navbar) navbar.classList.toggle('scrolled', scrollTop() > NAVBAR_SCROLL_THRESHOLD);
}

// Coalesce bursts of scroll and pointer events into one measurement per frame.
function onFrame() {
    frameQueued = false;
    updateNavbar();
    updateModelRotation();
}

function requestFrame() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(onFrame);
}

scrollSource.addEventListener('scroll', requestFrame, { passive: true });
window.addEventListener('resize', requestFrame);
reducedMotion.addEventListener('change', requestFrame);

// Pointer drives the model's Y rotation, scroll drives its X rotation.
document.addEventListener('mousemove', e => {
    pointerTilt = (0.5 - e.clientX / window.innerWidth) * TILT_RANGE * 2;
    requestFrame();
});

// ===============================
// Lazy Load Miris Model
// ===============================
const loadModel = () => {
    // The asset is only ~0.3 world units across, so the camera sits at z=0.3.
    // A conventional z=5 would put it sub-pixel and nothing would appear.
    wrapper.innerHTML = `
        <miris-scene id="hero-model" viewer-key="${VIEWER_KEY}" class="parallax-model">
            <miris-camera controls position="0 0 0.3"></miris-camera>
            <miris-stream uuid="${ASSET_UUID}"></miris-stream>
        </miris-scene>
    `;

    // Until the components bundle upgrades it, <miris-stream> is a plain
    // HTMLElement with no .rotation. Rotation is only a transform, so there is no
    // need to wait for geometry — upgrade is enough.
    customElements.whenDefined('miris-stream').then(() => {
        heroStream = document.querySelector('#hero-model miris-stream');
        requestFrame();
    });
};

if (wrapper) {
    // Named, so the callback can actually disconnect it.
    const modelObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
            loadModel();
            modelObserver.disconnect();
        }
    }, { root: scroller || null });
    modelObserver.observe(wrapper);
}

updateNavbar();
