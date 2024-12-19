# Online Chess Bot Example

> *Disclaimer: This repository exists purely to demonstrate the simplicity of chess automation, challenging claims about "sophisticated" detection systems. Please use this knowledge responsibly, or don't - It's not my problem.*

## Introduction
This is the companion code to the YouTube video [https://youtu.be/S--1kgug2lw] where we explore how embarrassingly simple it is to automate chess moves online. If you're here to lecture about code quality, please note that my inbox is already full of strongly-worded emails about proper documentation practices. It is quick and dirty, simply a demo

## Prerequisites

- Python 3 (preferably from this decade)
- A UCI chess engine of your choice
- The ability to resist using this in actual games (recommended)

## System Requirements

To check if Python is installed:
```bash
python -V  # or python3 -V if you're fancy
```

If you get an error, either Python isn't installed or your computer is having an existential crisis.

# Installation

## Backend

1. Navigate to the backend folder:

```bash
cd backend
```

2. Create a virtual environment:

```bash

# Windows
python -m venv venv

# MacOS/Linux
python3 -m venv venv
```

3. Activate the virtual environment:

```bash
# Windows
venv\Scripts\activate

# MacOS/Linux
source venv/bin/activate
```


4. Install the required packages:

```bash
pip install -r requirements.txt
```


5. Create an engines directory and add your UCI engine:
```
backend/
└── engines/
    └── stockfish.exe
```

6. Configure the .env file:

```bash
ENGINE="stockfish.exe"
ENGINES_PATH="./engines"
```

6. Run the server

```bash
python server.py
```
and the server will be running.

## Frontend
This is easier.


1. Open Google Chrome (yes, it has to be Chrome, I'm not writing browser-specific code for fun)

2. Go to `chrome://extensions/`

3. Turn on developer mode using the switch top right

4. Then, top left, select `Load unpacked`

5. Browse to the extension folder of the repo.

## Usage

> Note: the backend should be running before you start the browser

1. Visit chess.com
2. Set board Piece Notation to text (not figurine, because I value my free time)
3. Press F12 to open developer tools (if you want to see the console output)
4. Start a game
5. Look for the engine bar below the board
6. Click start to activate your silicon overlord

## Important Notes

* This code is intentionally quick and dirty. If you're here to critique the architecture, please redirect your energy towards solving world hunger.
* Everything except the UCI engine is included. You'll need to source that yourself because I'm not getting into licensing discussions.
* To the code police: Yes, I know about best practices. No, I didn't use them. We all have our crosses to bear.

## Final Thoughts

Remember: Just because you *can* build a chess bot doesn't mean you *should* use it. Maybe try getting better at chess instead? Just a thought.
