const canvas = document.getElementById('fieldCanvas'); 
const ctx = canvas.getContext('2d');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const tableBody = document.querySelector('#pointTable tbody');

const modeSelect = document.getElementById('modeSelect');
// Field background selector
const fieldSelect = document.getElementById('fieldSelect');
fieldSelect.addEventListener('change', (e) => {
    const selectedImage = e.target.value;
    canvas.style.backgroundImage = `url('${selectedImage}')`;
    canvas.style.backgroundSize = 'cover';
});


let points = [];
let coordMode = 'absolute'; // 'absolute' or 'relative'
let relativeOrigin = { x: 0, y: 0 };

// Convert between pixels and inches
function pixelToInches(xPixel, yPixel) {
    const mmPerPixelX = 3600 / canvas.width; // 12ft = 3600mm
    const mmPerPixelY = 3600 / canvas.height;
    return {
        x: (xPixel - canvas.width / 2) * mmPerPixelX / 25.4,
        y: (canvas.height / 2 - yPixel) * mmPerPixelY / 25.4
    };
}

function inchesToPixel(xInches, yInches) {
    const mmX = xInches * 25.4;
    const mmY = yInches * 25.4;
    return {
        x: canvas.width / 2 + (mmX / 3600) * canvas.width,
        y: canvas.height / 2 - (mmY / 3600) * canvas.height
    };
}

// Mode toggle
modeSelect.addEventListener('change', (e) => {
    coordMode = e.target.value;
    if (coordMode === 'relative' && points.length > 0) {
        relativeOrigin = { x: points[0].realX, y: points[0].realY };
    }
    drawPointsAndLines();
    updateTable();
});

// Add a point on click
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const xPixel = e.clientX - rect.left;
    const yPixel = e.clientY - rect.top;
    let { x: realX, y: realY } = pixelToInches(xPixel, yPixel);

    // If relative mode, set the first point as origin (0,0)
    if (coordMode === 'relative') {
        if (points.length === 0) {
            relativeOrigin = { x: realX, y: realY };
        }
        realX -= relativeOrigin.x;
        realY -= relativeOrigin.y;
    }

    let heading = 0;
    if (points.length > 0) {
        const prev = points[points.length - 1];
        const dx = realX - prev.realX;
        const dy = realY - prev.realY;
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
        const startHeading = Number(document.getElementById('startingHeadingInput').value) || 0;
        let robotHeading = -(angleDeg - startHeading);
        if (robotHeading > 180) robotHeading -= 360;
        if (robotHeading < -180) robotHeading += 360;
        heading = Math.round(robotHeading);
    }

    const newPoint = {
        realX: Math.round(realX * 100) / 100,
        realY: Math.round(realY * 100) / 100,
        heading,
        speed: 100,
        direction: 'forward'
    };

    const pixel = inchesToPixel(
        coordMode === 'relative' ? newPoint.realX + relativeOrigin.x : newPoint.realX,
        coordMode === 'relative' ? newPoint.realY + relativeOrigin.y : newPoint.realY
    );

    newPoint.x = pixel.x;
    newPoint.y = pixel.y;

    points.push(newPoint);
    updateTable();
    drawPointsAndLines();
});

// Draw everything
function drawPointsAndLines() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length > 1) {
        ctx.strokeStyle = 'purple';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    points.forEach((pt, index) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'purple';
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.stroke();

        // Draw starting heading arrow
        if (index === 0) {
            const startHeading = Number(document.getElementById('startingHeadingInput').value) || 0;
            const arrowLength = 20;
            const angleRad = startHeading * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.x + arrowLength * Math.cos(angleRad),
                       pt.y - arrowLength * Math.sin(angleRad));
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Label coordinates and heading
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.fillText(`(${pt.realX}, ${pt.realY})`, pt.x + 8, pt.y - 8);
        ctx.fillText(`H:${pt.heading}°`, pt.x + 8, pt.y + 12);
    });
}

// Update editable table
function updateTable() {
    tableBody.innerHTML = '';
    points.forEach((pt, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td contenteditable="true">${pt.realX}</td>
            <td contenteditable="true">${pt.realY}</td>
            <td contenteditable="true">${pt.heading}</td>
            <td contenteditable="true">${pt.speed}</td>
            <td>
                <select>
                    <option value="forward" ${pt.direction === 'forward' ? 'selected' : ''}>Forward</option>
                    <option value="backward" ${pt.direction === 'backward' ? 'selected' : ''}>Backward</option>
                </select>
            </td>
            <td><button class="deleteBtn">Delete</button></td>
        `;
        tableBody.appendChild(tr);

        tr.querySelector('.deleteBtn').addEventListener('click', () => {
            points.splice(i, 1);
            recalcHeadings();
            updateTable();
            drawPointsAndLines();
        });

        tr.cells[1].addEventListener('blur', () => {
            pt.realX = parseFloat(tr.cells[1].textContent);
            const px = inchesToPixel(
                coordMode === 'relative' ? pt.realX + relativeOrigin.x : pt.realX,
                coordMode === 'relative' ? pt.realY + relativeOrigin.y : pt.realY
            );
            pt.x = px.x;
            pt.y = px.y;
            recalcHeadings();
            drawPointsAndLines();
        });

        tr.cells[2].addEventListener('blur', () => {
            pt.realY = parseFloat(tr.cells[2].textContent);
            const px = inchesToPixel(
                coordMode === 'relative' ? pt.realX + relativeOrigin.x : pt.realX,
                coordMode === 'relative' ? pt.realY + relativeOrigin.y : pt.realY
            );
            pt.x = px.x;
            pt.y = px.y;
            recalcHeadings();
            drawPointsAndLines();
        });

        tr.cells[3].addEventListener('blur', () => {
            pt.heading = parseFloat(tr.cells[3].textContent);
            drawPointsAndLines();
        });

        tr.cells[4].addEventListener('blur', () => {
            pt.speed = parseFloat(tr.cells[4].textContent);
        });

        tr.cells[5].querySelector('select').addEventListener('change', (e) => {
            pt.direction = e.target.value;
        });
    });
}

// Recalculate headings
function recalcHeadings() {
    if (points.length === 0) return;
    const startHeading = Number(document.getElementById('startingHeadingInput').value) || 0;
    points[0].heading = startHeading;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].realX - points[i - 1].realX;
        const dy = points[i].realY - points[i - 1].realY;
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
        let robotHeading = -(angleDeg - startHeading);
        if (robotHeading > 180) robotHeading -= 360;
        if (robotHeading < -180) robotHeading += 360;
        points[i].heading = Math.round(robotHeading);
    }
}

// Export route
exportBtn.addEventListener('click', () => {
    const exportData = points.map(pt => ({
        x: pt.realX,
        y: pt.realY,
        heading: pt.heading,
        speed: pt.speed,
        direction: pt.direction
    }));
    console.log(JSON.stringify(exportData, null, 2));
    alert('Route exported to console!');
});

// Clear route
clearBtn.addEventListener('click', () => {
    points = [];
    tableBody.innerHTML = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

