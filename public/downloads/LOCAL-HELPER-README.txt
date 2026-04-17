Arduino Button Mapper Local Helper
==================================

What this mode does
-------------------
The Local Helper runs the compile/upload backend on your own computer at:
http://localhost:3001

That means the website can still do the UI work, but sketch compilation happens
locally instead of depending on the hosted compiler.

How to use it
-------------
1. Download the helper package or this project folder.
2. Make sure the backend folder is included beside the launcher script.
3. Install Node.js if it is not already installed.
4. Install arduino-cli and the AVR core:

   arduino-cli core update-index
   arduino-cli core install arduino:avr
   arduino-cli lib install "Keyboard" "Mouse"

5. Open the launcher:
   - Mac: Arduino-Button-Mapper-Helper.command
   - Windows: Arduino-Button-Mapper-Helper.bat

6. In the web app, switch Upload Method to "Local Helper".
7. Upload from Chrome or Edge as usual.

If it does not connect
----------------------
- Confirm the helper is running on localhost:3001
- Use a data USB cable
- Use Chrome or Edge
- Try the full serial picker if your board is a clone
