const vscode = acquireVsCodeApi();

// --- Drag & Drop Logic ---
let activeWindow = null;
let initialX = 0;
let initialY = 0;
let currentX = 0;
let currentY = 0;
let xOffset = 0;
let yOffset = 0;

function startDrag(e, windowId) {
    activeWindow = document.getElementById(windowId);
    
    if (activeWindow) {
        // Get current transform values if any
        const style = window.getComputedStyle(activeWindow);
        const matrix = new WebKitCSSMatrix(style.transform);
        xOffset = matrix.m41;
        yOffset = matrix.m42;

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        // Bring to front
        bringToFront(activeWindow);
    }
}

function drag(e) {
    if (activeWindow) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        setTranslate(currentX, currentY, activeWindow);
    }
}

function endDrag(e) {
    initialX = currentX;
    initialY = currentY;
    activeWindow = null;
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

function bringToFront(el) {
    // Simple z-index management
    const windows = document.querySelectorAll('.visualizer-window');
    let maxZ = 100;
    windows.forEach(w => {
        const z = parseInt(window.getComputedStyle(w).zIndex);
        if (z > maxZ) maxZ = z;
    });
    el.style.zIndex = maxZ + 1;
}

function closeWindow(windowId) {
    const el = document.getElementById(windowId);
    if (el) el.remove();
}

// Attach global event listeners for drag
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', endDrag);

// --- Visualization Logic ---

// Function called by the "Visualize" button/checkbox
function requestVisualizer(varRef, visualizerId) {
    vscode.postMessage({
        command: 'createVisualizer',
        varRef: varRef,
        visualizerId: visualizerId
    });
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'addVisualizerWindow':
            const canvas = document.getElementById('canvas');
            if (canvas) {
                // Create a temp container to parse HTML
                const temp = document.createElement('div');
                temp.innerHTML = message.html;
                const newWindow = temp.firstElementChild;
                canvas.appendChild(newWindow);
                
                // Execute script if any
                if (message.script) {
                    try {
                        eval(message.script);
                    } catch (e) {
                        console.error('Error executing visualizer script:', e);
                    }
                }
            }
            break;
    }
});


// Function to update variable value
function updateVariable(parentRef, name, value) {
    vscode.postMessage({
        command: 'updateVariable',
        parentRef: parseInt(parentRef),
        name: name,
        value: value
    });
}
