from http import HTTPStatus
import os
import subprocess
import threading
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from dotenv import load_dotenv
import chess
import re

load_dotenv(override=True) # because Vscode is weird and caches env vars

app = Flask(__name__)
CORS(app)  # anywhere, we don't care
socketio = SocketIO(app, cors_allowed_origins="*") # security is important

FULL_ENGINE_PATH = f'{os.getenv("ENGINES_PATH")}/{os.getenv("ENGINE")}'
MULTIPV = 5


engine_process = None # with luck this will be the engine process
output_thread = None # when the engine is started, this thread will read the output
running = False # is the engine running
current_board = chess.Board()


current_depth_buffer = {} # dict for the mulitpv output
current_depth = None

def make_response(data=None, message=None, error=None, status=HTTPStatus.OK):
    response = {}
    if message:
        response["message"] = message
    if error:
        response["error"] = error
    if data:
        response["data"] = data

    print(response)
    return jsonify(response), status


def convert_san_to_lan(san_moves: list):
    '''
    san_moves should be a list of SAN moves (e.g. ["e4", "e5", "Nf3", "Nc6"])

    If it isn't then bang.
    '''
    board = chess.Board()
    lan_moves = []
    for san in san_moves:
        try:
            move = board.parse_san(san)
            lan_moves.append(move.uci())
            board.push(move)
        except ValueError:
            raise Exception(f"Invalid SAN move: {san}")
    return lan_moves


def parse_engine_output(output: str):
    '''
    output should be a pv line

    If it isn't then bang.
    '''
    try:
        pv_match = re.search(r'pv\s+((?:\w+\d+\w+\d+\s*)+)', output)
        if not pv_match:
            return output
        
        uci_moves = pv_match.group(1).strip().split()
        
        temp_board = current_board.copy()
        san_moves = []
        for uci_move in uci_moves:
            move = chess.Move.from_uci(uci_move)
            san_moves.append(temp_board.san(move))
            temp_board.push(move)
            
        modified_output = output[:pv_match.start(1)] + ' '.join(san_moves) + output[pv_match.end(1):]
        return modified_output
        
    except Exception as e:
        print(f"Error parsing engine output: {e}")
        return output


def process_engine_line(line):
    
    '''
    UCI engines spit out a huge amount of info, try to find the multipv lines and parse them
    '''

    global current_depth_buffer, current_depth
    
    if "info multipv" not in line:
        return None
        
    depth_match = re.search(r'depth (\d+)', line)
    multipv_match = re.search(r'multipv (\d+)', line)
    
    if not depth_match or not multipv_match:
        return None
    

    # we'll assume int here, if it breaks, we derserve it anyway (bruh) 
    depth = int(depth_match.group(1))
    multipv = int(multipv_match.group(1))
    
    if depth != current_depth:
        current_depth = depth
        current_depth_buffer = {}
    
    parsed_line = parse_engine_output(line)
    current_depth_buffer[multipv] = parsed_line
    
    if len(current_depth_buffer) == 5: 
        lines = []
        for i in range(1, MULTIPV):
            if i in current_depth_buffer:
                lines.append(current_depth_buffer[i])
        return lines
    
    return None # great


def on_engine_output(output):
    if "info multipv" in output: 
        complete_depth = process_engine_line(output)
        if complete_depth and len(complete_depth) > 0: # such a hack like this whole thing
            socketio.emit('engine_output', {'data': complete_depth})
            socketio.emit('engine_output_single', {'data': complete_depth[0]})


def process_engine_output():
    while running:
        line = engine_process.stdout.readline()
        if not line:  # Engine might have crashed we can NO LONGER CHEAT
            break
        on_engine_output(line.strip())


def start_engine():   
    global engine_process, output_thread, running

    if engine_process:
        raise Exception("Engine already running")

    engine_process = subprocess.Popen(
        [FULL_ENGINE_PATH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        bufsize=1,
    )
    running = True

    output_thread = threading.Thread(target=process_engine_output, daemon=True)
    output_thread.start()


def stop_engine():
    global engine_process, running, current_depth_buffer, current_depth

    if engine_process:
        running = False
        engine_process.stdin.write("quit\n")
        engine_process.stdin.flush()
        engine_process.wait()
        engine_process = None
        current_depth_buffer = {}
        current_depth = None


def send_command(command):
    if engine_process:
        engine_process.stdin.write(command + "\n")
        engine_process.stdin.flush()


@app.route("/start", methods=["POST"])
def start_analysis():
    try:
        global current_board
        current_board = chess.Board()
        start_engine()
        send_command("uci")
        send_command("isready")
        send_command(f"setoption name MultiPV value {MULTIPV}")
        send_command("ucinewgame")
        send_command("position startpos")
        send_command("go infinite")
        return make_response(message="Engine started in infinite analysis mode", status=HTTPStatus.OK)
    except Exception as e:
        return make_response(error=str(e), status=HTTPStatus.BAD_REQUEST)


@app.route("/stop", methods=["POST"])
def stop_analysis():
    try:
        stop_engine()
        return make_response(message="Engine stopped", status=HTTPStatus.OK)
    except Exception as e:
        return make_response(error=str(e), status=HTTPStatus.BAD_REQUEST)


@app.route("/moves", methods=["POST"])
def moves():
    global current_board, current_depth_buffer, current_depth
    san_moves = request.json.get("moves")
    if not san_moves or not isinstance(san_moves, list):
        return make_response(error="Invalid input. Please provide a list of SAN moves.", status=HTTPStatus.BAD_REQUEST)

    try:
        socketio.emit('clear_output')
        lan_moves = convert_san_to_lan(san_moves)
        current_board = chess.Board()
        for move in lan_moves:
            current_board.push(chess.Move.from_uci(move))
        
        # Reset depth tracking
        current_depth_buffer = {}
        current_depth = None
            
        send_command("stop")
        send_command(f"position startpos moves {' '.join(lan_moves)}")
        send_command("go infinite")
        return make_response(message=f"Moves sent: {san_moves}", status=HTTPStatus.OK)
    except Exception as e:
        return make_response(error=str(e), status=HTTPStatus.BAD_REQUEST)



@app.route("/status", methods=["GET"])
def status():
    if engine_process:
        return make_response(data={"status": "running"}, status=HTTPStatus.OK)
    return make_response(data={"status": "stopped"}, status=HTTPStatus.OK)




if __name__ == "__main__":
    socketio.run(app, debug=True)