Arduino Button Mapper Local Helper
==================================

What this mode does
-------------------
The Local Helper runs the compile/upload backend on your own computer at:
http://localhost:3001

That means the website can still do the UI work, but sketch compilation happens
locally instead of depending on the hosted compiler.

How to use it on Mac
--------------------
1. Download `Arduino-Button-Mapper-Helper-Mac.zip`.
2. Unzip it.
3. Open `Arduino Button Mapper Helper.app`.
4. If macOS warns that the app was downloaded from the internet, open it from Finder with right-click -> Open.
5. The helper starts in the background on `localhost:3001`. You do not need to keep a Terminal window open.

Before first launch, install:
- Node.js
- arduino-cli
- the Arduino AVR core and Keyboard/Mouse libraries

Install the Arduino tooling with:

   arduino-cli core update-index
   arduino-cli core install arduino:avr
   arduino-cli lib install "Keyboard" "Mouse"

Then in the web app:
1. Open your profile menu.
2. Set Upload Method to `Local`.
3. Upload from Chrome or Edge as usual.

If it does not connect
----------------------
- Confirm the helper app is running on localhost:3001
- Use a data USB cable
- Use Chrome or Edge
- Try the full serial picker if your board is a clone
- Check the helper log at:
  `~/Library/Logs/Arduino Button Mapper Helper/helper.log`
