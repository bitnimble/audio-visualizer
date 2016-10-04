//Note: bins needs to be a power of 2
let displayBins = 512;
let backgroundColour = "#262626";
let barColour = "#F1910C";
let songFont = "15px 'Open Sans'";
//Where the bottom of the waveform is rendered at (out of 255). I recommend
//leaving it at 96 since it seems to work well, basically any volume will push
//it past 96. If your audio stream is quiet though, you'll want to reduce this.
let floorLevel = 96;

//Whether to draw the frequencies directly, or scale the x-axis logarithmically and show pitch instead.
let drawPitch = true;
//Whether to draw the visualisation as a curve instead of discrete bars
let drawCurved = true;
//If drawCurved is enabled, this flag fills the area beneath the curve (the same colour as the line)
let drawFilled = true;
//Whether to draw text the songText on top of the visualisation
let drawText = false;

//Can't touch this
let audioContext;
let audioBuffer;
let audioAnalyserNode;
let audioVisualizerInitialized = false;
let songText = "";
let textSize;
let canvasContext;
let canvasWidth;
let canvasHeight;
let multiplier;
let finalBins = [];
let binWidth;
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
	audioAnalyserNode.fftSize = drawPitch ? 4096 : displayBins * 2;
	multiplier = Math.pow(2, Math.log2(displayBins) / (22050 / magicConstant));
	for (let i = 0; i < displayBins; i++)
		finalBins.push(0);
	binWidth = Math.ceil(canvasWidth / (displayBins - 1));
	
	src.connect(audioAnalyserNode);
	audioAnalyserNode.connect(audioContext.destination);	
		
	audioVisualizerInitialized = true;
}

function initCanvas(canvasElement) {
	canvasContext = canvasElement.getContext('2d');
	canvasWidth = canvas.width;
	canvasHeight = canvas.height;
	requestAnimationFrame(paint);
	canvasContext.font = songFont;
	canvasContext.strokeStyle = barColour;
	
	textSize = canvasContext.measureText(songText);
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
	let binLengths = [];
	let data = new Uint8Array(bins);
	audioAnalyserNode.getByteFrequencyData(data);
	canvasContext.fillStyle = barColour;
	
	if (drawPitch)
		updateBinsLog(bins, binLengths, data);
	else
		updateBins(bins, binLengths, data);
	
	if (!drawCurved) {
		for (let i = 0; i < displayBins; i++) {
			paintSingleBin(i);
		}
	} else {
		canvasContext.fillStyle = barColour;
		canvasContext.beginPath();
		canvasContext.moveTo(0, canvasHeight - getBinHeight(0));
		let i;
		let lastX, lastY;
		let j = 0;
		let drawStopper = false;
		for (i = 0; i < displayBins - 2;) {
			var thisX = i * binWidth;
			var nextX = (i + binLengths[i]) * binWidth; //First subbin of the next bin
			var x = (thisX + nextX) / 2;
			
			var thisY = canvasHeight - getBinHeight(i);
			var nextY = canvasHeight - getBinHeight(i + binLengths[i]);
			var y = (thisY + nextY) / 2;
			
			canvasContext.quadraticCurveTo(thisX, thisY, x, y);
			
			i += binLengths[i];
		}
		canvasContext.quadraticCurveTo(i * binWidth, canvasHeight - getBinHeight(i), (i + 1) * binWidth, canvasHeight - getBinHeight(i + 1));
		if (drawFilled) {
			canvasContext.lineTo(canvasWidth, canvasHeight);
			canvasContext.lineTo(0, canvasHeight);
			canvasContext.fill();
		} else {
			canvasContext.stroke();
		}
	}
	
	if (drawText) {
		canvasContext.fillStyle = 'white';
		//Note: the 15's here need to be changed if you change the font size
		canvasContext.fillText(songText, canvasWidth / 2 - textSize.width / 2, canvasHeight / 2 - 15 / 2 + 15);
	}
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

function updateBins(bins, binLengths, data) {
	let step = bins / displayBins;
	for (let i = 0; i < displayBins; i++) {
		let lower = i * step;
		let upper = (i + 1) * step - 1;
		let binValue = averageRegion(data, lower, upper);
		binLengths.push(1);
		finalBins[i] = binValue;
	}
}

//TODO: pull the indexing out into a lookup table
function updateBinsLog(bins, binLengths, data) {
	let lastFrequency = magicConstant / multiplier;
	let currentLength = 0;
	let lastBinIndex = 0;
	for(let i = 0; i < displayBins; i++) {
		let thisFreq = lastFrequency * multiplier;
		lastFrequency = thisFreq;
		let binIndex = Math.floor(bins * thisFreq / 22050);
		let binValue = data[binIndex];
		currentLength++;
		
		if (binIndex != lastBinIndex) {
			for (let j = 0; j < currentLength; j++)
				binLengths.push(currentLength);
			currentLength = 0;
		}
		
		lastBinIndex = binIndex;
		finalBins[i] = binValue;
	}
}

function getBinHeight(i) {
	let binValue = finalBins[i];
	
	//Pretty much any volume will push it over [floorLevel] so we set that as the bottom threshold
	//I suspect I should be doing a logarithmic space for the volume as well
	let height = Math.max(0, (binValue - floorLevel));
	//Scale to the height of the bar
	//Since we change the base level in the previous operations, 256 should be changed to 160 (i think) if we want it to go all the way to the top
	height = (height / (256 - floorLevel)) * canvasHeight * 0.8;
	return height;
}

function paintSingleBin(i) {
	let height = getBinHeight(i);
	canvasContext.fillRect(i * binWidth, canvasHeight - height, binWidth, height);
}