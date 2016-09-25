# audio-visualizer
A simple canvas visualizer for frequencies from an input audio file or stream, sampled as _perceived frequency_ and not as _absolute frequency_. 

Click here for a demo!

# Summary
This visualiser is a simple bar representation of the frequencies of an audio input. Initialisation is simple, you just call `initializeVisualizer(canvas, audio)`, passing in the canvas you want to render to and the audio element with the source audio. Source audio can be anything that HTML5 audio supports. This control runs on top of the Web Audio API, so support is limited to browsers that support that API. If unsure, test it out.

Background colour, bar colour, number of bars ('frequency bins') and text font is configurable inside visualizer.js, modify to your taste.
Call `updateSongText(text)` to change the text on the control.

See index.html for example usage. Currently only 1 control is supported at a time, but I'll refactor it to fix that when I'm not feeling so lazy.

![](https://my.mixtape.moe/voarfb.png)
