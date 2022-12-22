// Load everything

window.onload = function() {
    onLoad();
};

// Constants

const COLORS = {
    WHITE: 'white',
    RED:   'red',
    BLUE:  'blue'
}
const COLOR_CODES = {
    WHITE: 0,
    RED:   1,
    BLUE:  2
}
const CODE_TO_COLOR = {
    0: COLORS.WHITE,
    1: COLORS.RED,
    2: COLORS.BLUE
}

// Self-Described Aggregation Protocol

const SDAP_MESSAGE_TYPE = {
    CREATE:  'create',
    GET:     'get',
    UPDATE:  'update',
    CHANGES: 'changes'
}

// Update Frequency

const UPDATE_FREQ = 100;

// Configuration

/* WebSockets */
const WEBSOCKETS_SERVER = "ws://localhost:9000";

/* Canvas */
const BACKGROUND_CODE_COLOR = COLOR_CODES.WHITE;
const BACKGROUND_COLOR      = CODE_TO_COLOR[BACKGROUND_CODE_COLOR];
const CLEAR_MARGIN          = 25;
const FRAME_BORDER_COLOR    = COLORS.BLUE;
const FRAME_BORDER_WIDTH    = 4;
const BLOCK_SIZE            = 10;

// Global variables

/* To handle the HTML canvas element */
var canvas, ctx;

/* To handle the periodical update */
var intervalId;

/* To handle the drawing canvas */
var realWidth, realHeight;
var maxX, maxY;

/* To handle the drawing canvas representation */
var screen = null;

/* Buttons and inputs */
var createRoomBtn = null, joinRoomBtn = null, roomIdInput = null;
var roomId = null;

/* WebSockets */
var socket = null;

// onLoad

function onLoad() {
    // Buttons and Inputs
    createRoomBtn = document.getElementById("createRoom");
    joinRoomBtn   = document.getElementById("joinRoom");
    roomIdInput   = document.getElementById("roomId");

    // Canvas
    canvas = document.getElementById("myCanvas");
    ctx = canvas.getContext("2d");

    /* Resizing */
    window.addEventListener('resize', resizeCanvas, false);
    // Draw canvas border for the first time.
    resizeCanvas();
    redraw();

    /* Regular check */
    // intervalId = setInterval(function() {
    //     draw();
    // }, UPDATE_FREQ);
    
    // clearInterval(intervalId);

    /* Mouse user input */
    // TODO: Should check if it's inside canvas
    canvas.addEventListener('mousedown', function(e) {
        const [x, y] = getCursorPosition(e);
        paint(x, y, COLORS.RED);
    });
    canvas.addEventListener('mousemove', function(e) {
        if (e.which == 1) {
            const [x, y] = getCursorPosition(e);
            paint(x, y, COLORS.RED);
        }
    });

    /* Websockets handling */
    wsConfigure();

    /* Buttons interactions */
    uiConfigure();
}

// Utils

/* Mouse */

function getCursorPosition(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return [x, y];
}

/* Websockets communication */

function wsConfigure() {
    // Create WebSocket connection.
    socket = new WebSocket(WEBSOCKETS_SERVER);

    if (!socket) {
        console.log("Could not connect to " + WEBSOCKETS_SERVER);
        return;
    }

    // Connection opened
    socket.addEventListener('open', (event) => {
        console.log("Connected to server");
        // socket.send('Hello Server!');
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        console.log('Message from server', data);
        switch(data.type) {
            case SDAP_MESSAGE_TYPE.CREATE:
                roomCreated(data);
                break;
            case SDAP_MESSAGE_TYPE.GET:
                roomAcquired(data);
                break;
            case SDAP_MESSAGE_TYPE.UPDATE:
                roomUpdated(data);
                break;
            case SDAP_MESSAGE_TYPE.CHANGES:
                roomChanged(data);
                break;
        }
    });
}

////////////////////
// CREATE
////////////////////

function createRoom() {
    console.log("Creating room");
    if (roomId) {
        // if there's a room already, we create a new blank one
        newScreen();
    }
    const msg = {
        type: SDAP_MESSAGE_TYPE.CREATE,
        schema: {
            "$schema": "http://json-schema.org/draft-04/schema#",
            "type": "array",
            "items": [
                {
                    "type": "array",
                    "items": [
                        {
                            "type": "integer"
                        }
                    ]
                }
            ]
        },
        value: screen
    };
    socket.send(JSON.stringify(msg));
}

function roomCreated(data) {
    const created = data.created;
    roomId = created.id;
    if (roomId) {
        roomIdInput.value = roomId;
    }
    console.log(`Room with id '${roomId}' created successfully.`);
    subscribeToRoom(roomId);
}

////////////////////
// GET
////////////////////

function getRoom(id) {
    console.log(`Getting value for room id '${id}'`);
    const msg = {
        type: SDAP_MESSAGE_TYPE.GET,
        id: roomId
    };
    socket.send(JSON.stringify(msg));
}

function roomAcquired(data) {
    const room = data.value;
    console.log(`Received room id '${data.id}'`);
    console.log("Room:");
    console.log(room);
    screen = room;
    redraw();
}

////////////////////
// UPDATE
////////////////////

function updateRoom(id, update) {
    console.log(`Updating room id '${id}'`);
    const msg = {
        type:    SDAP_MESSAGE_TYPE.UPDATE,
        id:      roomId,
        updates: [
            update
        ]
    };
    socket.send(JSON.stringify(msg));
}

function roomUpdated(data) {
    if (data.id == roomId) {
        const updateResults = data.updates;
        console.log(`Room id '${data.id}' was updated`);
        console.log("Update results:");
        console.log(updateResults);
    }
}

////////////////////
// CHANGES
////////////////////

function subscribeToRoomChanges(id) {
    console.log(`Subscribing to changes on room id '${id}'`);
    const msg = {
        type: SDAP_MESSAGE_TYPE.CHANGES,
        id: roomId
    };
    socket.send(JSON.stringify(msg));
}

function roomChanged(data) {
    const changes = data.changes;
    console.log(`Received changes from room id '${data.id}'`);
    console.log("Changes:");
    console.log(changes);
}

////////////////////
// OTHERS
////////////////////

function joinRoom() {
    if (!roomIdInput) {
        console.log('Cannot find room id input');
        return;
    }

    roomId = roomIdInput.value;
    console.log(`Joining room id '${roomId}'`);
    getRoom(roomId);
    subscribeToRoomChanges(roomId);
}

/* UI */

function uiConfigure() {
    if (!socket) {
        return;
    }

    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', (event) => {
            createRoom();
        });
    }
    
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', (event) => {
            joinRoom();
        });
    }
}

/* Canvas resizing and drawing */

function newScreen() {
    screen = null;
    resizeCanvas();
}

function resizeCanvas() {
    let finalCanvasWidth  = window.innerWidth  - CLEAR_MARGIN - 2 * FRAME_BORDER_WIDTH;
    finalCanvasWidth  = Math.floor(finalCanvasWidth/BLOCK_SIZE)  * BLOCK_SIZE;
    let finalCanvasHeight = window.innerHeight - CLEAR_MARGIN - 2 * FRAME_BORDER_WIDTH;
    finalCanvasHeight = Math.floor(finalCanvasHeight/BLOCK_SIZE) * BLOCK_SIZE;

    canvas.width  = finalCanvasWidth  + 2 * FRAME_BORDER_WIDTH;
    canvas.height = finalCanvasHeight + 2 * FRAME_BORDER_WIDTH;

    realWidth  = finalCanvasWidth;
    realHeight = finalCanvasHeight;

    maxX = Math.floor(realWidth/BLOCK_SIZE)  - 1;
    maxY = Math.floor(realHeight/BLOCK_SIZE) - 1;

    console.log("New dimensions: " + maxX + " x " + maxY + " pixels");

    buildScreen(maxX, maxY);
    redraw();
}

function clear() {
    ctx.save();
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function frame() {
    ctx.save();
    ctx.strokeStyle = FRAME_BORDER_COLOR;
    ctx.lineWidth = `${FRAME_BORDER_WIDTH}`;
    ctx.strokeRect(
        0             + FRAME_BORDER_WIDTH/2, 
        0             + FRAME_BORDER_WIDTH/2, 
        canvas.width  - FRAME_BORDER_WIDTH, 
        canvas.height - FRAME_BORDER_WIDTH
    );
    ctx.restore();
}

/* Screen handling */

function drawSquareInScreen(x, y, fillStyle) {
    if (x < 0 || x > maxX || y < 0 || y > maxY) {
        // console.log("Trying to print outside the screen");
        // console.log(x, maxX, y, maxY);
        return;
    }
    ctx.save();
    ctx.fillStyle = fillStyle;
    const realX = Math.floor(FRAME_BORDER_WIDTH + x * BLOCK_SIZE);
    const realY = Math.floor(FRAME_BORDER_WIDTH + y * BLOCK_SIZE);
    ctx.fillRect(
        realX,
        realY,
        BLOCK_SIZE,
        BLOCK_SIZE
    );
    ctx.restore();
}

function buildScreen(newMaxX, newMaxY) {
    let oldScreen = screen;
    screen = [];
    for(let y = 0; y <= newMaxY; y++) {
        let row = [];
        for(let x = 0; x <= newMaxX; x++) {
            row.push(COLOR_CODES.WHITE);
        }
        screen.push(row);
    }
    if (oldScreen) {
        for(let y = 0; y < oldScreen.length; y++) {
            let row = oldScreen[y];
            for(let x = 0; x < row.length; x++) {
                screen[y][x] = row[x];
            }
        }
    }
}

function addSquareToScreen(x, y, color) {
    if (x < 0 || x > maxX || y < 0 || y > maxY) {
        // console.log("Trying to add square outside the screen");
        // console.log(x, y, color);
        return false;
    }
    screen[y][x] = color;
    return true;
}

function redrawScreen() {
    for(let y = 0; y < screen.length; y++) {
        let row = screen[y];
        for(let x = 0; x < row.length; x++) {
            let color = row[x];
            if (!color) {
                color = BACKGROUND_CODE_COLOR;
            }
            drawSquareInScreen(x, y, CODE_TO_COLOR[color]);
        }
    }
}

function drawChangesOnScreen(changes) {
    for (const change of changes) {
        const {x, y, c} = change;
        drawSquareInScreen(x, y, CODE_TO_COLOR[c]);
    }
}

function paint(mouseX, mouseY) {
    const x = Math.floor((mouseX-FRAME_BORDER_WIDTH)/BLOCK_SIZE);
    const y = Math.floor((mouseY-FRAME_BORDER_WIDTH)/BLOCK_SIZE);
    const c = COLOR_CODES.RED;
    const res = addSquareToScreen(x, y, c);

    if(res && roomId) {
        const ptr = `/${y}/${x}`
        const update = {
            ops: {}
        };
        update.ops[ptr] = {
            type: "set",
            value: c
        };
        updateRoom(roomId, update);
    }

    draw([{x,y,c}]);
}

/* Draw function */

function draw(changes) {
    drawChangesOnScreen(changes);
}

function redraw() {
    clear();
    redrawScreen();
    frame();
}