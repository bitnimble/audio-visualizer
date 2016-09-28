//Note: bins needs to be a power of 2
let displayBins = 512;
let backgroundColour = "#262626";
let barColour = "#F1910C";
let songFont = "15px 'Open Sans'";
//Where the bottom of the waveform is rendered at (out of 255). I recommend
//leaving it at 96 since it seems to work well, basically any volume will push
//it past 96. If your audio stream is quiet though, you'll want to reduce this.
let floorLevel = 96;

let drawPitch = true;

//Can't touch this
let audioContext;
let audioBuffer;
let audioAnalyserNode;
let audioVisualizerInitialized = false;
let songText = "";
let textSize;
let freqLookup = [];
let canvasContext;
let canvasWidth;
let canvasHeight;
let multiplier;

let magicConstant = 42; //Meaning of everything. I don't know why this works.

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
	audioAnalyserNode.fftSize = drawPitch ? 8192 : displayBins * 2;
	multiplier = Math.pow(2, Math.log2(displayBins) / (22050 / magicConstant));
	
	src.connect(audioAnalyserNode);
	audioAnalyserNode.connect(audioContext.destination);	
		
	audioVisualizerInitialized = true;
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
	return start * Math.exp((Math.log(stop) - Math.log(start)) * (n / binCount));
}

function initFreqLookupTable() {
	let bins = audioAnalyserNode.frequencyBinCount;
	for (let i = 0; i < bins; i++) {
		//Scale to perceived frequency distribution
		let freqStart = getFreqPoint(1, 22025, i, bins);
		let point = Math.floor(bins * freqStart / 22025);
		freqLookup.push(point);
	}
}

//Render some fancy bars
function paint() {
	requestAnimationFrame(paint);
	
	if(!audioVisualizerInitialized)
		return;
		
	canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
	canvasContext.fillStyle = backgroundColour;
	canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);
	
	let bins = audioAnalyserNode.frequencyBinCount;
	let data = new Uint8Array(bins);
	audioAnalyserNode.getByteFrequencyData(data);
	canvasContext.fillStyle = barColour;
	
	if (drawPitch)
		paintLogBins(bins, data)
	else
		paintBins(bins, data);
	
	canvasContext.fillStyle = 'white';
	//Note: the 15's here need to be changed if you change the font size
	canvasContext.fillText(songText, canvasWidth / 2 - textSize.width / 2, canvasHeight / 2 - 15 / 2 + 15);
}

//Inclusive lower, exclusive upper except with stop == start
function averageRegion(data, start, stop) {
	if (stop <= start)
		return data[start];
	
	let sum = 0;
	for (let i = start; i < stop; i++) {
		sum += data[i];
	}
	return sum / (stop - start);
}

function paintBins(bins, data) {
	let step = bins / displayBins;
	for (let i = 0; i < displayBins; i++) {
		let lower = i * step;
		let upper = (i + 1) * step - 1;
		let binValue = averageRegion(data, lower, upper);
		
		paintSingleBin(binValue, i);
	}
}

function paintLogBins(bins, data) {
	let lastFrequency = magicConstant / multiplier;
	for(let i = 0; i < displayBins; i++) {
		let thisFreq = lastFrequency * multiplier;
		lastFrequency = thisFreq;
		let binIndex = Math.floor(bins * thisFreq / 22050);
		let binValue = data[binIndex];
		
		paintSingleBin(binValue, i);
	}
}

function paintSingleBin(binValue, i) {
	//Pretty much any volume will push it over [floorLevel] so we set that as the bottom threshold
	//I suspect I should be doing a logarithmic space for the volume as well
	let height = Math.max(0, (binValue - floorLevel));
	//Scale to the height of the bar
	//Since we change the base level in the previous operations, 256 should be changed to 160 (i think) if we want it to go all the way to the top
	height = (height / (256 - floorLevel)) * canvasHeight * 0.8;
	let width = Math.ceil(canvasWidth / (displayBins - 1));
	canvasContext.fillRect(i * width, canvasHeight - height, width, height);
}