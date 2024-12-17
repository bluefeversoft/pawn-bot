const API_ENDPOINTS = {
    BASE_URL: 'http://localhost:5000',
    STATUS: '/status',
    START: '/start',
    STOP: '/stop',
    MOVES: '/moves'
};

const ELEMENT_IDS = {
    BOARD_LAYOUT: 'board-layout-main',
    BOARD_CHESSBOARD: 'board-layout-chessboard',
    ENGINE_OUTPUT: 'chess-engine-output',
    ENGINE_DEPTH: 'engine-output-depth',
    ENGINE_SCORE: 'engine-output-score',
    ENGINE_PV: 'engine-output-pv',
    TOGGLE_ENGINE: 'toggleEngine',
    CHECK_STATE: 'checkState'
};

const SELECTORS = {
    MOVE_LIST: 'wc-simple-move-list',
    MOVE_ROWS: '.main-line-row.move-list-row',
    WHITE_MOVE: '.node.white-move.main-line-ply .node-highlight-content',
    BLACK_MOVE: '.node.black-move.main-line-ply .node-highlight-content'
};

// design skillz (bruh)
const styles = {
    engineOutput: {
        backgroundColor: '#000',
        color: '#fff',
        padding: '10px',
        fontSize: '16px',
        textAlign: 'center',
        boxSizing: 'border-box',
        zIndex: '9999'
    },
    flexRow: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    flexColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },
    outputSpan: {
        padding: '5px 10px'
    },
    button: {
        padding: '5px 10px',
        fontSize: '14px',
        cursor: 'pointer'
    }
};

let gameMoves = [];
let wcObserver = null;
let isObservingMoveList = false;
const socket = io(API_ENDPOINTS.BASE_URL);



const styleToString = (style) => 
    Object.entries(style)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
        .join('; ');

// The HMTL that makes the engine output display, obviously some potential for a proper design here, but hey ho, my boat was floating
const generateHTML = () => `
    <div id="${ELEMENT_IDS.ENGINE_OUTPUT}" style="${styleToString(styles.engineOutput)}">
        <div style="${styleToString(styles.flexRow)}">
            <div>
                <span style="${styleToString(styles.outputSpan)}" id="${ELEMENT_IDS.ENGINE_DEPTH}">Depth 0</span>
                <span style="${styleToString(styles.outputSpan)}" id="${ELEMENT_IDS.ENGINE_SCORE}">-</span>
                <span style="${styleToString(styles.outputSpan)}" id="${ELEMENT_IDS.ENGINE_PV}">-- --</span>
            </div>
            <div style="${styleToString(styles.flexColumn)}">
                <button id="${ELEMENT_IDS.TOGGLE_ENGINE}" style="${styleToString(styles.button)}">Start / Stop</button>
                <button id="${ELEMENT_IDS.CHECK_STATE}" style="${styleToString(styles.button)}">Check Status</button>
            </div>
        </div>
    </div>
`;


function parseEngineLine(line) {
    const parts = line.split(' ');
    const data = { depth: null, score: null, pv: [] };

    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 'depth') data.depth = parts[i + 1];
        if (parts[i] === 'cp') data.score = parts[i + 1];
        if (parts[i] === 'pv') data.pv = parts.slice(i + 1).join(' ');
    }
    return data;
}



function initializeControls() {
    const elements = {
        toggle: document.getElementById(ELEMENT_IDS.TOGGLE_ENGINE),
        checkState: document.getElementById(ELEMENT_IDS.CHECK_STATE),
        outputDepth: document.getElementById(ELEMENT_IDS.ENGINE_DEPTH),
        outputScore: document.getElementById(ELEMENT_IDS.ENGINE_SCORE),
        outputPV: document.getElementById(ELEMENT_IDS.ENGINE_PV)
    };

    if (!elements.toggle || !elements.checkState) return;

    async function updateButtonState() {
        try {
            const response = await fetch(`${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.STATUS}`);
            const data = await response.json();
            engineRunning = data.data.status === 'running';
            elements.toggle.textContent = engineRunning ? 'Stop Engine' : 'Start Engine';
        } catch (error) {
            console.error('Error checking status:', error);
        }
    }

    elements.toggle.addEventListener('click', async () => {
        const endpoint = engineRunning ? API_ENDPOINTS.STOP : API_ENDPOINTS.START;
        try {
            await fetch(`${API_ENDPOINTS.BASE_URL}${endpoint}`, { method: 'POST' });
            await updateButtonState();
        } catch (error) {
            console.error('Error toggling engine:', error);
        }
    });

    elements.checkState.addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.STATUS}`);
            const data = await response.json();
            alert(`Engine is currently ${data.data.status}`);
        } catch (error) {
            alert('Failed to check engine state');
        }
    });

    updateButtonState();

    socket.on('engine_output_single', (data) => {
        const parsed = parseEngineLine(data.data);
        elements.outputDepth.textContent = `Depth ${parsed.depth}`;
        elements.outputScore.textContent = (parsed.score / 100).toFixed(2);
        elements.outputPV.textContent = parsed.pv;
    });
}

function injectCustomHTML() {
    const chessboardDiv = document.getElementById(ELEMENT_IDS.BOARD_LAYOUT);
    if (chessboardDiv) {
        const existingOutput = document.getElementById(ELEMENT_IDS.ENGINE_OUTPUT);
        if (!existingOutput) {
            const container = document.createElement('div');
            container.innerHTML = generateHTML();
            chessboardDiv.appendChild(container.firstElementChild);
            initializeControls();
        }
    }
}


async function sendMovesToBackend(moves) {
    try {
        const response = await fetch(`${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.MOVES}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moves })
        });
        await response.json();
    } catch (error) {
        console.error('APP:: Error sending moves:', error);
    }
}

function extractMoves(element) {
    
    const moves = [];
    const moveRows = element.querySelectorAll(SELECTORS.MOVE_ROWS);

    moveRows.forEach((row) => {
        const whiteMoveElement = row.querySelector(SELECTORS.WHITE_MOVE);
        const blackMoveElement = row.querySelector(SELECTORS.BLACK_MOVE);

        if (whiteMoveElement) moves.push(whiteMoveElement.textContent.trim());
        if (blackMoveElement) moves.push(blackMoveElement.textContent.trim());
    });

    if (JSON.stringify(gameMoves) !== JSON.stringify(moves)) {
        gameMoves = moves;
        console.log('APP:: Game moves updated:', gameMoves);
        sendMovesToBackend(gameMoves);
    }

    return moves;
}

function observeMoveListElement(wcElement) {
    if (isObservingMoveList) return;
    isObservingMoveList = true;

    console.log('APP:: Observing wc-simple-move-list for changes');

    wcObserver = new MutationObserver(() => extractMoves(wcElement));
    wcObserver.observe(wcElement, { childList: true, subtree: true });
    extractMoves(wcElement);
}

function stopObservingMoveListElement() {
    if (wcObserver) {
        wcObserver.disconnect();
        wcObserver = null;
        isObservingMoveList = false;
        console.log('APP:: Stopped observing wc-simple-move-list');
    }
}

// the only thing really of note here is to not update the movelist every time the DOM changes.
// so whenever the overall dom changes, we check if the wc-simple-move-list is present, and if it is, we start observing it.
function globalDOMObserverCallback(mutations, globalObserver) {

    const wcElement = document.querySelector(SELECTORS.MOVE_LIST);
    const chessboardDiv = document.getElementById(ELEMENT_IDS.BOARD_CHESSBOARD);

    if (wcElement) {
        observeMoveListElement(wcElement);
    } else {
        stopObservingMoveListElement();
    }

    if (chessboardDiv) {
        injectCustomHTML();
    }
}

const globalObserver = new MutationObserver(globalDOMObserverCallback);
globalObserver.observe(document.body, { childList: true, subtree: true });

injectCustomHTML();

const initialMoveListElement = document.querySelector(SELECTORS.MOVE_LIST);
if (initialMoveListElement) {
    observeMoveListElement(initialMoveListElement);
}