const canvas = document.getElementById('fieldCanvas');
const ctx = canvas.getContext('2d');
const newRouteBtn = document.getElementById('newRouteBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const tableBody = document.querySelector('#pointTable tbody');
const coordModeSelect = document.getElementById('coordMode'); // new dropdown

let points = [];
let coordMode = 'absolute'; // default
let relativeOrigin = { x: 0, y: 0 };

// Convert pixel <-> inches
function pixelToInches(xPixel, yPixel) {
    const mmPerPixelX = 3600 / canvas.width; // canvas represents -1800mm -> 1800mm
    const mmPerPixelY = 3600 / canvas.height;
    return {
        x: (xPixel - canvas.width/2) * mmPerPixelX / 25.4,
        y: (canvas.height/2 - yPixel) * mmPerPixelY / 25.4
    };
}

function inchesToPixel(xInches, yInches) {
    const mmX = xInches * 25.4;
    const mmY = yInches * 25.4;
    return {
        x: canvas.width/2 + mmX / 3600 * canvas.width,
        y: canvas.height/2 - mmY / 3600 * canvas.height
    };
}

// Coordinate mode toggle
coordModeSelect.addEventListener('change', e => {
    coordMode = e.target.value;
    if (coordMode === 'relative' && points.length > 0) {
        relativeOrigin = { x: points[0].realX, y: points[0].realY };
    }
    updateTable();
    drawPointsAndLines();
});

// Add new point on canvas click
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const xPixel = e.clientX - rect.left;
    const yPixel = e.clientY - rect.top;
    const {x: realX, y: realY} = pixelToInches(xPixel, yPixel);

    let heading = 0;
    if(points.length > 0){
        const prev = points[points.length-1];
        const dx = realX - prev.realX;
        const dy = realY - prev.realY;
        let angleDeg = Math.atan2(dy, dx) * 180/Math.PI;
        const startHeading = Number(document.getElementById('startingHeadingInput').value) || 0;
        let robotHeading = -(angleDeg - startHeading);
        if(robotHeading > 180) robotHeading -= 360;
        if(robotHeading < -180) robotHeading += 360;
        heading = Math.round(robotHeading);
    }

    // store raw world coordinates
    const newPoint = {
        x: xPixel,
        y: yPixel,
        realX: Math.round(realX*100)/100,
        realY: Math.round(realY*100)/100,
        heading,
        speed: 100,
        direction: 'forward'
    };

    // if this is the first point and relative mode, set relative origin
    if (points.length === 0 && coordMode === 'relative') {
        relativeOrigin = { x: newPoint.realX, y: newPoint.realY };
    }

    points.push(newPoint);
    updateTable();
    drawPointsAndLines();
});

// Draw lines & points
function drawPointsAndLines(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Lines
    if(points.length>1){
        ctx.strokeStyle='purple';
        ctx.lineWidth=2;
        ctx.setLineDash([10,5]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Points
    points.forEach((pt,index)=>{
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI*2);
        ctx.fillStyle='purple';
        ctx.fill();
        ctx.strokeStyle='black';
        ctx.lineWidth=1;
        ctx.stroke();

        // Starting arrow
        if(index===0){
            const startHeading = Number(document.getElementById('startingHeadingInput').value) || 0;
            const arrowLength=15;
            const angleRad = startHeading * Math.PI/180;
            const arrowX = pt.x + arrowLength * Math.cos(angleRad);
            const arrowY = pt.y - arrowLength * Math.sin(angleRad);
            ctx.strokeStyle='black';
            ctx.lineWidth=2;
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(arrowX, arrowY);
            ctx.stroke();
        }

        // Labels
        ctx.fillStyle='black';
        ctx.font='12px Arial';

        // If relative mode, show coords relative to origin
        let displayX = pt.realX;
        let displayY = pt.realY;
        if (coordMode === 'relative') {
            displayX = Math.round((pt.realX - relativeOrigin.x) * 100) / 100;
            displayY = Math.round((pt.realY - relativeOrigin.y) * 100) / 100;
        }

        ctx.fillText(`(${displayX},${displayY})`, pt.x+8, pt.y-8);
        ctx.fillText(`H:${pt.heading}°`, pt.x+8, pt.y+12);
    });
}

// Update table
function updateTable(){
    tableBody.innerHTML='';
    points.forEach((pt,index)=>{
        const tr = document.createElement('tr');

        let displayX = pt.realX;
        let displayY = pt.realY;
        if (coordMode === 'relative') {
            displayX = Math.round((pt.realX - relativeOrigin.x) * 100) / 100;
            displayY = Math.round((pt.realY - relativeOrigin.y) * 100) / 100;
        }

        tr.innerHTML=`
        <td>${index+1}</td>
        <td contenteditable="true">${displayX}</td>
        <td contenteditable="true">${displayY}</td>
        <td contenteditable="true">${pt.heading}</td>
        <td contenteditable="true">${pt.speed}</td>
        <td>
            <select>
                <option value="forward" ${pt.direction==='forward'?'selected':''}>Forward</option>
                <option value="backward" ${pt.direction==='backward'?'selected':''}>Backward</option>
            </select>
        </td>
        <td><button class="deleteBtn">Delete</button></td>
        `;
        tableBody.appendChild(tr);

        // Delete button
        tr.querySelector('.deleteBtn').addEventListener('click', ()=>{
            points.splice(index,1);
            updateTable();
            recalcHeading(1);
            drawPointsAndLines();
        });

        // Editable X
        tr.cells[1].addEventListener('blur', ()=>{
            const val = parseFloat(tr.cells[1].textContent);
            if (coordMode === 'relative') pt.realX = relativeOrigin.x + val;
            else pt.realX = val;
            const px = inchesToPixel(pt.realX, pt.realY);
            pt.x = px.x; pt.y = px.y;
            recalcHeading(index+1);
            drawPointsAndLines();
        });

        // Editable Y
        tr.cells[2].addEventListener('blur', ()=>{
            const val = parseFloat(tr.cells[2].textContent);
            if (coordMode === 'relative') pt.realY = relativeOrigin.y + val;
            else pt.realY = val;
            const px = inchesToPixel(pt.realX, pt.realY);
            pt.x = px.x; pt.y = px.y;
            recalcHeading(index+1);
            drawPointsAndLines();
        });

        // Editable heading
        tr.cells[3].addEventListener('blur', ()=>{
            pt.heading = parseFloat(tr.cells[3].textContent);
            drawPointsAndLines();
        });

        // Editable speed
        tr.cells[4].addEventListener('blur', ()=>{
            pt.speed = parseFloat(tr.cells[4].textContent);
        });

        // Direction
        tr.cells[5].querySelector('select').addEventListener('change', e=>{
            pt.direction = e.target.value;
        });
    });
}

// Recalculate headings from startIndex
function recalcHeading(startIndex = 1){
    const startHeading = Number(document.getElementById('startingHeadingInput').value) || 0;
    for(let i=startIndex; i<points.length; i++){
        const prev = points[i-1];
        const pt = points[i];
        const dx = pt.realX - prev.realX;
        const dy = pt.realY - prev.realY;
        let angleDeg = Math.atan2(dy, dx) * 180/Math.PI;
        let robotHeading = -(angleDeg - startHeading);
        if(robotHeading>180) robotHeading -=360;
        if(robotHeading<-180) robotHeading +=360;
        pt.heading = Math.round(robotHeading);

        const row = tableBody.children[i];
        if(row) row.cells[3].textContent = pt.heading;
    }
}

// Export route
exportBtn.addEventListener('click', ()=>{
    const exportData = points.map(pt=>{
        let xOut = pt.realX;
        let yOut = pt.realY;
        if (coordMode === 'relative') {
            xOut -= relativeOrigin.x;
            yOut -= relativeOrigin.y;
        }
        return {
            x: xOut,
            y: yOut,
            heading: pt.heading,
            speed: pt.speed,
            direction: pt.direction
        };
    });
    console.log(JSON.stringify(exportData,null,2));
    alert('Route exported to console!');
});

// Clear route
clearBtn.addEventListener('click', () => {
    points = [];
    tableBody.innerHTML = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});
