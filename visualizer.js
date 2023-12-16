//Note: bins needs to be a power of 2
let displayBins = 512;
let backgroundColour = "#2C2E3B";
let barColour = "#EC1A55";
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
let drawFilled = false;
//Whether to draw text the songText on top of the visualisation
let drawText = false;
//Rainbow gradients more your thing? You can enable this for full rainbow effect (this ignores "barColour")
let rainbowColours = false;

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
let logLookupTable = [];
let logBinLengths = [];
let binWidth;
let magicConstant = 42; //Meaning of everything. I don't know why this works.

function initializeVisualizer(canvasElement, audioElement) {
	try {
		let ctxt = window.AudioContext || window.webkitAudioContext;
		if (ctxt) {
			initCanvas(canvasElement);
			audioContext = new ctxt();
			setupAudioApi(audioElement);
		}
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
	audioAnalyserNode.fftSize = drawPitch ? displayBins * 8 : displayBins * 2;
	multiplier = Math.pow(22050, 1 / displayBins) * Math.pow(1 / magicConstant, 1 / displayBins);
	finalBins = [];
	logLookupTable = [];
	logBinLengths = [];
	for (let i = 0; i < displayBins; i++) {
		finalBins.push(0);
		logLookupTable.push(0);
	}
	createLookupTable(audioAnalyserNode.frequencyBinCount, logBinLengths, logLookupTable);
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
	
	if (rainbowColors) {
		var gradient = canvasContext.createLinearGradient(10, 0, canvasWidth, canvasHeight);
		gradient.addColorStop(0, 'red');
		gradient.addColorStop(1 / 6, 'orange');
		gradient.addColorStop(2 / 6, 'yellow');
		gradient.addColorStop(3 / 6, 'green');
		gradient.addColorStop(4 / 6, 'blue');
		gradient.addColorStop(5 / 6, 'indigo');
		gradient.addColorStop(1, 'violet');
	}

	canvasContext.fillStyle = backgroundColour;
	canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

	let bins = audioAnalyserNode.frequencyBinCount;
	let data = new Uint8Array(bins);
	audioAnalyserNode.getByteFrequencyData(data);
	
	if (rainbowColors) { canvasContext.fillStyle = gradient; } 
	else { canvasContext.fillStyle = barColour; }

	if (drawPitch)
		updateBinsLog(logLookupTable, data);
	else
		updateBins(bins, logBinLengths, data);

	if (!drawCurved) {
		for (let i = 0; i < displayBins; i++) {
			paintSingleBin(i);
		}
	} else {
		if (rainbowColors) { canvasContext.fillStyle = gradient; } 
		else { canvasContext.fillStyle = barColour; }
		canvasContext.beginPath();
		canvasContext.moveTo(0, canvasHeight - getBinHeight(0));
		let i;
		for (i = 0; i < displayBins - 2;) {
			var thisX = i * binWidth;
			var nextX = (i + logBinLengths[i]) * binWidth; //First subbin of the next bin
			var x = (thisX + nextX) / 2;

			var thisY = canvasHeight - getBinHeight(i);
			var nextY = canvasHeight - getBinHeight(i + logBinLengths[i]);
			var y = (thisY + nextY) / 2;

			canvasContext.quadraticCurveTo(thisX, thisY, x, y);

			i += logBinLengths[i];
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

function createLookupTable(bins, binLengths, lookupTable) {
	if (drawPitch) {
		let lastFrequency = magicConstant / multiplier;
		let currentLength = 0;
		let lastBinIndex = 0;
		for (let i = 0; i < displayBins; i++) {
			let thisFreq = lastFrequency * multiplier;
			lastFrequency = thisFreq;
			let binIndex = Math.floor(bins * thisFreq / 22050);
			lookupTable[i] = binIndex;
			currentLength++;

			if (binIndex != lastBinIndex) {
				for (let j = 0; j < currentLength; j++)
					binLengths.push(currentLength);
				currentLength = 0;
			}

			lastBinIndex = binIndex;
		}
	} else {
		for (let i = 0; i < displayBins; i++) {
			lookupTable[i] = i;
		}
	}
}

function updateBinsLog(lookupTable, data) {
	for (let i = 0; i < displayBins; i++) {
		finalBins[i] = data[lookupTable[i]];
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
