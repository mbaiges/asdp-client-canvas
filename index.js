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
const COLOR_TO_CODE = {
    "white": COLOR_CODES.WHITE,
    "red": COLOR_CODES.RED,
    "blue": COLOR_CODES.BLUE
}

// Self-Described Aggregation Protocol

const SDAP_MESSAGE_TYPE = {
    HELLO:       'hello',
    CREATE:      'create',
    GET:         'get',
    UPDATE:      'update',
    SUBSCRIBE:   'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    CHANGES:     'changes'
}

// Update Frequency

const UPDATE_FREQ = 100;

// Configuration

/* WebSockets */
const WEBSOCKETS_SERVER = "ws://localhost:9000";

const LAST_CHANGES_ARR_SIZE = 200;

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
var createRoomBtn = null, joinRoomBtn = null, roomNameInput = null;
var roomName = null;

/* WebSockets */
var socket = null;

const CHANGE_TYPE = {
    OWN:    "own",
    OTHERS: "others"
};

var appliedChanges = [];
for (let i = 0; i < LAST_CHANGES_ARR_SIZE; i++) {
    appliedChanges.push(undefined);
}
var nextChangeIdx = 0;
var lastChangeId = undefined;
var lastChangeAt = undefined;

function _updateLastChange(change) {
    appliedChanges[nextChangeIdx] = change;
    nextChangeIdx = (nextChangeIdx + 1) % LAST_CHANGES_ARR_SIZE;
    lastChangeId = change.changeId;
    lastChangeAt = change.changeAt;
}

// onLoad

function onLoad() {
    // Buttons and Inputs
    createRoomBtn = document.getElementById("createRoom");
    joinRoomBtn   = document.getElementById("joinRoom");
    roomNameInput   = document.getElementById("roomName");

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
        console.log(e.which)
        if (e.which == 1) { // left click
            paint(x, y, COLORS.RED);
        } else if (e.which == 3) { // right click
            paint(x, y, COLORS.WHITE);
        }
    });
    canvas.addEventListener('mousemove', function(e) {
        const [x, y] = getCursorPosition(e);
        if (e.which == 1) { // left click
            paint(x, y, COLORS.RED);
        } else if (e.which == 3) { // right click
            paint(x, y, COLORS.WHITE);
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
        hello();
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        console.log('Message from server', data);
        switch(data.type) {
            case SDAP_MESSAGE_TYPE.HELLO:
                helloed(data);
                break;
            case SDAP_MESSAGE_TYPE.CREATE:
                roomCreated(data);
                break;
            case SDAP_MESSAGE_TYPE.GET:
                roomAcquired(data);
                break;
            case SDAP_MESSAGE_TYPE.UPDATE:
                roomUpdated(data);
                break;
            case SDAP_MESSAGE_TYPE.SUBSCRIBE:
                subscribed(data);
                break;
            case SDAP_MESSAGE_TYPE.UNSUBSCRIBE:
                unsubscribed(data);
                break;
            case SDAP_MESSAGE_TYPE.CHANGES:
                roomChanged(data);
                break;
        }
    });
}

////////////////////
// HELLO
////////////////////

function hello() {
    console.log("Hello");
    const msg = {
        type: SDAP_MESSAGE_TYPE.HELLO,
        username: "anonymous"
    };
    socket.send(JSON.stringify(msg));
}

function helloed(data) {
    console.log("Helloed from server");
    console.log("Username is " + data.newUsername);
}

////////////////////
// CREATE
////////////////////

function createRoom() {
    console.log("Creating room");
    if (roomName) {
        // if there's a room already, we create a new blank one
        newScreen();
        // And unsubscribe
        unsubscribeToRoomChanges(roomName);
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
    roomName = created.name;
    console.log("Room " + roomName)
    if (roomName) {
        roomNameInput.value = roomName;
    }
    console.log(`Room with name '${roomName}' created successfully.`);
    subscribeToRoomChanges(roomName);
}

////////////////////
// GET
////////////////////

function getRoom(name) {
    console.log(`Getting value for room name '${name}'`);
    const msg = {
        type: SDAP_MESSAGE_TYPE.GET,
        name: roomName
    };
    socket.send(JSON.stringify(msg));
}

function roomAcquired(data) {
    const room = data.value;
    console.log(`Received room name '${data.name}'`);
    console.log("Room:");
    console.log(room);
    lastChangeId = data.lastChangeId;
    lastChangeAt = data.lastChangeAt;
    screen = room;
    redraw();
}

////////////////////
// UPDATE
////////////////////

function updateRoom(name, update) {
    console.log(`Updating room name '${name}'`);
    const msg = {
        type:    SDAP_MESSAGE_TYPE.UPDATE,
        name:    roomName,
        updates: [
            update
        ]
    };
    socket.send(JSON.stringify(msg));
}

function roomUpdated(data) {
    if (data.name == roomName) {
        console.log(`Room name '${data.name}' was updated`);
        console.log("Update results:");
        console.log(data.results);
        if (data.results) {
            for (let result of data.results) {
                const change = {
                    type: CHANGE_TYPE.OWN,
                    changeId: result.changeId,
                    changeTime: result.change
                };
                _updateLastChange(change);
            }
        }
    }
}

////////////////////
// SUBSCRIBE
////////////////////

function subscribeToRoomChanges(name) {
    console.log(`Subscribing to changes on room name '${name}'`);
    const msg = {
        type: SDAP_MESSAGE_TYPE.SUBSCRIBE,
        name: roomName
    };
    socket.send(JSON.stringify(msg));
}

function subscribed(data) {
    if (data.success) {
        console.log(`Subscribed successfully to changes on room name '${data.name}'`)
    }
}

////////////////////
// UNSUBSCRIBE
////////////////////

function unsubscribeToRoomChanges(name) {
    console.log(`Unsubscribing to changes on room name '${name}'`);
    const msg = {
        type: SDAP_MESSAGE_TYPE.UNSUBSCRIBE,
        name: roomName
    };
    socket.send(JSON.stringify(msg));
}

function unsubscribed(data) {
    if (data.success) {
        console.log(`Unsubscribed successfully to changes on room name '${data.name}'`)
    }
}

////////////////////
// CHANGES
////////////////////

function roomChanged(data) {
    const changes = data.changes;
    console.log(`Received changes from room name '${data.name}'`);
    console.log("Changes:");
    console.log(changes);
    for (const change of changes) {
        const ops = change.ops;
        for (const ptr in ops) {
            const op = ops[ptr];
            if (op.type == 'set') { // Only supported right now
                const p = ptr.split('/');
                if (p.length == 3) {
                    const [y, x] = [p[1], p[2]];
                    const c = op.value;
                    addSquareToScreen(x, y, c);
                    draw([{
                        x, 
                        y, 
                        c
                    }]);
                }
            }
            
        }

        const ch = {
            type: CHANGE_TYPE.OTHERS,
            changeId: change.changeId,
            changeTime: change.change,
            change: change
        };
        _updateLastChange(ch);
    }
}

////////////////////
// OTHERS
////////////////////

function joinRoom() {
    if (!roomNameInput) {
        console.log('Cannot find room name input');
        return;
    }

    if (roomName) {
        unsubscribeToRoomChanges(roomName);
    }

    roomName = roomNameInput.value;
    console.log(`Joining room name '${roomName}'`);
    getRoom(roomName);
    subscribeToRoomChanges(roomName);
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

function paint(mouseX, mouseY, color) {
    const x = Math.floor((mouseX-FRAME_BORDER_WIDTH)/BLOCK_SIZE);
    const y = Math.floor((mouseY-FRAME_BORDER_WIDTH)/BLOCK_SIZE);
    const c = COLOR_TO_CODE[color];
    const res = addSquareToScreen(x, y, c);

    if(res && roomName) {
        const ptr = `/${y}/${x}`
        const update = {
            ops: {}
        };
        update.ops[ptr] = {
            type: "set",
            value: c
        };
        updateRoom(roomName, update);
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