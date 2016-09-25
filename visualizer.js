//Note: bins needs to be a power of 2
let bins = 64;
let backgroundColour = "#262626";
let barColour = "#F1910C";
let songFont = "15px 'Open Sans'";
//Where the bottom of the waveform is rendered at (out of 255). I recommend
//leaving it at 96 since it seems to work well, basically any volume will push
//it past 96. If your audio stream is quiet though, you'll want to reduce this.
let floorLevel = 96;

//Can't touch this
let audioContext;
let audioBuffer;
let audioAnalyserNode;
let initialized = false;
let songText = "";
let textSize;
let freqLookup = [];
let canvasContext;
let canvasWidth;
let canvasHeight;

function initializeVisualizer(canvasElement, audioElement) {
	try {
		initCanvas(canvasElement);
		audioContext = new AudioContext();
		setupAudioApi(audioElement);
	} catch(e) {
		console.log(e);
	}
}

function updateSongText(newText) {
	songText = newText;
	if (canvasContext)
		textSize = canvasContext.measureText(songText);
}

function setupAudioApi(audioElement) {
	let src = audioContext.createMediaElementSource(audioElement);
	
	audioAnalyserNode = audioContext.createAnalyser();
	//FFT node takes in 2 samples per bin, and we internally use 2 samples per bin
	audioAnalyserNode.fftSize = bins * 4;
	
	src.connect(audioAnalyserNode);
	audioAnalyserNode.connect(audioContext.destination);	
		
	initialized = true;
	initFreqLookupTable();
}

function initCanvas(canvasElement) {
	canvasContext = canvasElement.getContext('2d');
	canvasWidth = canvas.width;
	canvasHeight = canvas.height;
	requestAnimationFrame(paint);
	canvasContext.font = songFont;
	
	textSize = canvasContext.measureText(songText);
}

function getFreqPoint(start, stop, n, binCount) {
	return start * Math.pow(stop / start, n / (binCount - 1));
}

function initFreqLookupTable() {
	let lastPoint = 0;
	let bins = audioAnalyserNode.frequencyBinCount;
	for(let i = 0; i < bins / 2; i++) {
		//Scale to perceived frequency distribution
		let newFreq = getFreqPoint(20, 20000, i * 2, bins);
		let point = Math.floor(bins * newFreq / 20000);
		while (point <= lastPoint)
			point++;
		lastPoint = point;
		freqLookup.push(point);
	}
}

//Render some fancy bars
function paint() {
	requestAnimationFrame(paint);
	
	if(!initialized)
		return;
		
	canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
	canvasContext.fillStyle = backgroundColour;
	canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);
	
	let bins = audioAnalyserNode.frequencyBinCount;
	let data = new Uint8Array(bins);
	audioAnalyserNode.getByteFrequencyData(data);
	canvasContext.fillStyle = barColour;
	
	for(let i = 0; i < bins; i++) {
		let point = freqLookup[i];
		//Pretty much any volume will push it over [floorLevel] so we set that as the bottom threshold
		//I suspect I should be doing a logarithmic space for the volume as well
		let height = Math.max(0, (data[point] - floorLevel));
		//Scale to the height of the bar
		//Since we change the base level in the previous operations, 256 should be changed to 160 (i think) if we want it to go all the way to the top
		height = (height / (256 - floorLevel)) * canvasHeight * 0.8;
		let width = Math.ceil(canvasWidth / ((bins / 2) - 1));
		canvasContext.fillRect(i * width, canvasHeight - height, width, height);
	}
	canvasContext.fillStyle = 'white';
	//Note: the 15's here need to be changed if you change the font size
	canvasContext.fillText(songText, canvasWidth / 2 - textSize.width / 2, canvasHeight / 2 - 15 / 2 + 15);
}