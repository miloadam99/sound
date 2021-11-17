import { WebAudioInstance } from './webaudio/WebAudioInstance';

interface FrequencyBand {
    low: number;
    ctr: number;
    hi: number;
}

/**
 *  <p>FFT (Fast Fourier Transform) is an analysis algorithm that
 *  isolates individual
 *  <a href="https://en.wikipedia.org/wiki/Audio_frequency">
 *  audio frequencies</a> within a waveform.</p>
 *
 *  <p>Once instantiated, a pixi.FFT object can return an array based on
 *  two types of analyses: <br> • <code>FFT.waveform()</code> computes
 *  amplitude values along the time domain. The array indices correspond
 *  to samples across a brief moment in time. Each value represents
 *  amplitude of the waveform at that sample of time.<br>
 *  • <code>FFT.analyze() </code> computes amplitude values along the
 *  frequency domain. The array indices correspond to frequencies (i.e.
 *  pitches), from the lowest to the highest that humans can hear. Each
 *  value represents amplitude at that slice of the frequency spectrum.
 *  Use with <code>getEnergy()</code> to measure amplitude at specific
 *  frequencies, or within a range of frequencies. </p>
 *
 *  <p>FFT analyzes a very short snapshot of sound called a sample
 *  buffer. It returns an array of amplitude measurements, referred
 *  to as <code>bins</code>. The array is 1024 bins long by default.
 *  You can change the bin array length, but it must be a power of 2
 *  between 16 and 1024 in order for the FFT algorithm to function
 *  correctly. The actual size of the FFT buffer is twice the
 *  number of bins, so given a standard sample rate, the buffer is
 *  2048/44100 seconds long.</p>
 *
 *
 *  @class
 *  @constructor
 *  @param {Number} [smoothing]   Smooth results of Frequency Spectrum.
 *                                0.0 < smoothing < 1.0.
 *                                Defaults to 0.8.
 *  @param {Number} [bins]    Length of resulting array.
 *                            Must be a power of two between
 *                            16 and 1024. Defaults to 1024.
 *  @example
 */
import { isSafari } from './utils/supported';
import { IMediaInstance } from './interfaces';
import { HTMLAudioInstance } from './htmlaudio/HTMLAudioInstance';

export function map(num: number, inMin: number, inMax: number, outMin: number, outMax: number): number
{
    // eslint-disable-next-line no-mixed-operators
    return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

class FFT
{
    analyzerNode : AnalyserNode;

    freqDomain : Uint8Array | Float32Array;
    timeDomain : Uint8Array | Float32Array;

    bass = [20, 140];
    lowMid = [140, 400];
    mid = [400, 2600];
    highMid = [2600, 5200];
    treble = [5200, 14000];

    constructor(smoothing : number, bins : number, source: IMediaInstance | WebAudioInstance | HTMLAudioInstance)
    {
        if (source instanceof WebAudioInstance)
        {
            this.analyzerNode = source._source.context.createAnalyser();
        }

        this.smoothing = smoothing;
        this.bins = bins || 1024;

        this.freqDomain = new Uint8Array(this.analyzerNode.frequencyBinCount);
        this.timeDomain = new Uint8Array(this.analyzerNode.frequencyBinCount);
    }

    get bins() : number
    {
        return this.analyzerNode.fftSize / 2;
    }

    set bins(val : number)
    {
        this.analyzerNode.fftSize = val * 2;
    }

    get smoothing(): number
    {
        return this.analyzerNode.smoothingTimeConstant;
    }

    set smoothing(val : number)
    {
        this.analyzerNode.smoothingTimeConstant = val;
    }

    /**
     *  Returns an array of amplitude values (between -1.0 and +1.0) that represent
     *  a snapshot of amplitude readings in a single buffer. Length will be
     *  equal to bins (defaults to 1024). Can be used to draw the waveform
     *  of a sound.
     *
     *  @method waveform
     *  @for p5.FFT
     *  @param {Number} [bins]    Must be a power of two between
     *                            16 and 1024. Defaults to 1024.
     *  @param {String} [precision] If any value is provided, will return results
     *                              in a Float32 Array which is more precise
     *                              than a regular array.
     *  @return {Array}  Array    Array of amplitude values (-1 to 1)
     *                            over time. Array length = bins.
     *
     */
    get waveformSpectrum() : number[] | Uint8Array
    {
        const normalArray : number[] = [];

        if (!isSafari()) // getFloatFrequencyData doesnt work in Safari as of 5/2015
        {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            this.timeToFloat();
            this.analyzerNode.getFloatTimeDomainData(this.timeDomain as Float32Array);

            return this.timeDomain as Uint8Array;
        }

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.timeToInt();
        this.analyzerNode.getByteTimeDomainData(this.timeDomain as Uint8Array);
        for (let j = 0; j < this.timeDomain.length; j++)
        {
            const scaled = map(this.timeDomain[j], 0, 255, -1, 1);

            normalArray.push(scaled);
        }

        return normalArray;
    }

    /**
     *  Returns an array of amplitude values (between 0 and 255)
     *  across the frequency spectrum. Length is equal to FFT bins
     *  (1024 by default). The array indices correspond to frequencies
     *  (i.e. pitches), from the lowest to the highest that humans can
     *  hear. Each value represents amplitude at that slice of the
     *  frequency spectrum. Must be called prior to using
     *  <code>getEnergy()</code>.
     *
     *  @method analyze
     *  @for FFT
     *  @param {Number} [bins]    Must be a power of two between
     *                             16 and 1024. Defaults to 1024.
     *  @param {Number} [scale]    If "dB," returns decibel
     *                             float measurements between
     *                             -140 and 0 (max).
     *                             Otherwise returns integers from 0-255.
     *  @return {Number[]} spectrum    Array of energy (amplitude/volume)
     *                              values across the frequency spectrum.
     *                              Lowest energy (silence) = 0, highest
     *                              possible is 255.
     */
    analyze() : number[]
    {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.freqToInt();
        this.analyzerNode.getByteFrequencyData(this.freqDomain as Uint8Array);
        const normalArray = Array.from(this.freqDomain);

        return normalArray;
    }

    /**
     *  Returns an array of amplitude values (between 0 and 255)
     *  across the frequency spectrum. Length is equal to FFT bins
     *  (1024 by default). The array indices correspond to frequencies
     *  (i.e. pitches), from the lowest to the highest that humans can
     *  hear. Each value represents amplitude at that slice of the
     *  frequency spectrum. Must be called prior to using
     *  <code>getEnergy()</code>.
     *
     *  @method analyze
     *  @for FFT
     *  @param {Number} [bins]    Must be a power of two between
     *                             16 and 1024. Defaults to 1024.
     *  @param {Number} [scale]    If "dB," returns decibel
     *                             float measurements between
     *                             -140 and 0 (max).
     *                             Otherwise returns integers from 0-255.
     *  @return {Float32Array} spectrum    Array of energy (amplitude/volume)
     *                              values across the frequency spectrum.
     *                              Lowest energy (silence) = 0, highest
     *                              possible is 255.
     */
    get analyzeFloat32() : Float32Array
    {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.freqToFloat();
        this.analyzerNode.getFloatFrequencyData(this.freqDomain as Float32Array);

        return this.freqDomain as Float32Array;
    }

    /**
     *  Returns the amount of energy (volume) at a specific
     *  <a href="https://en.wikipedia.org/wiki/Audio_frequency" target="_blank">
     *  frequency</a>, or the average amount of energy between two
     *  frequencies. Accepts Number(s) corresponding
     *  to frequency (in Hz), or a "string" corresponding to predefined
     *  frequency ranges ("bass", "lowMid", "mid", "highMid", "treble").
     *  Returns a range between 0 (no energy/volume at that frequency) and
     *  255 (maximum energy).
     *  <em>NOTE: analyze() must be called prior to getEnergy(). analyze()
     *  tells the FFT to analyze frequency data, and getEnergy() uses
     *  the results to determine the value at a specific frequency or
     *  range of frequencies.</em></p>
     *
     *  @method  getEnergy
     *  @for p5.FFT
     *  @param  {Number|String} frequency1   Will return a value representing
     *                                energy at this frequency. Alternately,
     *                                the strings "bass", "lowMid" "mid",
     *                                "highMid", and "treble" will return
     *                                predefined frequency ranges.
     *  @param  {Number} [frequency2] If a second frequency is given,
     *                                will return average amount of
     *                                energy that exists between the
     *                                two frequencies.
     *  @return {Number}   Energy   Energy (volume/amplitude) from
     *                              0 and 255.
     *
     */

    getEnergy(frequency1 : number | string, frequency2 : number)
    {
        const nyquist = this.analyzerNode.context.sampleRate / 2;

        if (frequency1 === 'bass')
        {
            frequency1 = this.bass[0];
            frequency2 = this.bass[1];
        }
        else if (frequency1 === 'lowMid')
        {
            frequency1 = this.lowMid[0];
            frequency2 = this.lowMid[1];
        }
        else if (frequency1 === 'mid')
        {
            frequency1 = this.mid[0];
            frequency2 = this.mid[1];
        }
        else if (frequency1 === 'highMid')
        {
            frequency1 = this.highMid[0];
            frequency2 = this.highMid[1];
        }
        else if (frequency1 === 'treble')
        {
            frequency1 = this.treble[0];
            frequency2 = this.treble[1];
        }

        if (typeof frequency1 !== 'number')
        {
            throw new Error('invalid input for getEnergy()');
        }
        else if (!frequency2)
        {
        // if only one parameter:
            const index = Math.round((frequency1 / nyquist) * this.freqDomain.length);

            return this.freqDomain[index];
        }
        else if (frequency1 && frequency2)
        {
        // if two parameters:
        // if second is higher than first
            if (frequency1 > frequency2)
            {
                const swap = frequency2;

                frequency2 = frequency1;
                frequency1 = swap;
            }
            const lowIndex = Math.round(
                (frequency1 / nyquist) * this.freqDomain.length
            );
            const highIndex = Math.round(
                (frequency2 / nyquist) * this.freqDomain.length
            );

            let total = 0;
            let numFrequencies = 0;
            // add up all of the values for the frequencies

            for (let i = lowIndex; i <= highIndex; i++)
            {
                total += this.freqDomain[i];
                numFrequencies += 1;
            }
            // divide by total number of frequencies
            const toReturn = total / numFrequencies;

            return toReturn;
        }
        else
        {
            throw 'invalid input for getEnergy()';
        }
    }

    /**
     *  Returns the
     *  <a href="http://en.wikipedia.org/wiki/Spectral_centroid" target="_blank">
     *  spectral centroid</a> of the input signal.
     *  <em>NOTE: analyze() must be called prior to getCentroid(). Analyze()
     *  tells the FFT to analyze frequency data, and getCentroid() uses
     *  the results determine the spectral centroid.</em></p>
     *
     *  @method  getCentroid
     *  @for FFT
     *  @return {Number}   Spectral Centroid Frequency  of the spectral centroid in Hz.
     *
     *
     * @example
     *  <div><code>
     * function setup(){
     *  cnv = createCanvas(100,100);
     *  cnv.mousePressed(userStartAudio);
     *  sound = new p5.AudioIn();
     *  sound.start();
     *  fft = new p5.FFT();
     *  sound.connect(fft);
     *}
     *
     *function draw() {
     *  if (getAudioContext().state !== 'running') {
     *    background(220);
     *    text('tap here and enable mic to begin', 10, 20, width - 20);
     *    return;
     *  }
     *  let centroidplot = 0.0;
     *  let spectralCentroid = 0;
     *
     *  background(0);
     *  stroke(0,255,0);
     *  let spectrum = fft.analyze();
     *  fill(0,255,0); // spectrum is green
     *
     *  //draw the spectrum
     *  for (let i = 0; i < spectrum.length; i++){
     *    let x = map(log(i), 0, log(spectrum.length), 0, width);
     *    let h = map(spectrum[i], 0, 255, 0, height);
     *    let rectangle_width = (log(i+1)-log(i))*(width/log(spectrum.length));
     *    rect(x, height, rectangle_width, -h )
     *  }
     *  let nyquist = 22050;
     *
     *  // get the centroid
     *  spectralCentroid = fft.getCentroid();
     *
     *  // the mean_freq_index calculation is for the display.
     *  let mean_freq_index = spectralCentroid/(nyquist/spectrum.length);
     *
     *  centroidplot = map(log(mean_freq_index), 0, log(spectrum.length), 0, width);
     *
     *  stroke(255,0,0); // the line showing where the centroid is will be red
     *
     *  rect(centroidplot, 0, width / spectrum.length, height)
     *  noStroke();
     *  fill(255,255,255);  // text is white
     *  text('centroid: ', 10, 20);
     *  text(round(spectralCentroid)+' Hz', 10, 40);
     *}
     * </code></div>
     */
    getCentroid()
    {
        const nyquist = this.analyzerNode.context.sampleRate / 2;
        let cumulative_sum = 0;
        let centroid_normalization = 0;

        for (let i = 0; i < this.freqDomain.length; i++)
        {
            cumulative_sum += i * this.freqDomain[i];
            centroid_normalization += this.freqDomain[i];
        }

        let mean_freq_index = 0;

        if (centroid_normalization !== 0)
        {
            mean_freq_index = cumulative_sum / centroid_normalization;
        }

        const spec_centroid_freq
            = mean_freq_index * (nyquist / this.freqDomain.length);

        return spec_centroid_freq;
    }

    /**
     *  Returns an array of average amplitude values for a given number
     *  of frequency bands split equally. N defaults to 16.
     *  <em>NOTE: analyze() must be called prior to linAverages(). Analyze()
     *  tells the FFT to analyze frequency data, and linAverages() uses
     *  the results to group them into a smaller set of averages.</em></p>
     *
     *  @method  linAverages
     *  @for p5.FFT
     *  @param  {Number}  freqGroupCount                Number of returned frequency groups
     *  @return {Array}   linearAverages   Array of average amplitude values for each group
     */
    linAverages(freqGroupCount : number)
    {
        const N = freqGroupCount || 16; // This prevents undefined, null or 0 values of N

        const spectrum = this.freqDomain;
        const spectrumLength = spectrum.length;
        const spectrumStep = Math.floor(spectrumLength / N);

        const linearAverages = new Array(N);
        // Keep a second index for the current average group and place the values accordingly
        // with only one loop in the spectrum data
        let groupIndex = 0;

        for (let specIndex = 0; specIndex < spectrumLength; specIndex++)
        {
            linearAverages[groupIndex]
                = linearAverages[groupIndex] !== undefined
                    ? (linearAverages[groupIndex] + spectrum[specIndex]) / 2
                    : spectrum[specIndex];

            // Increase the group index when the last element of the group is processed
            if (specIndex % spectrumStep === spectrumStep - 1)
            {
                groupIndex++;
            }
        }

        return linearAverages;
    }

    /**
     *  Returns an array of average amplitude values of the spectrum, for a given
     *  set of <a href="https://en.wikipedia.org/wiki/Octave_band" target="_blank">
     *  Octave Bands</a>
     *  <em>NOTE: analyze() must be called prior to logAverages(). Analyze()
     *  tells the FFT to analyze frequency data, and logAverages() uses
     *  the results to group them into a smaller set of averages.</em></p>
     *
     *  @method  logAverages
     *  @for FFT
     *  @param  {Array}   octaveBands    Array of Octave Bands objects for grouping
     *  @return {Array}   logAverages    Array of average amplitude values for each group
     */
    logAverages(octaveBands : FrequencyBand[])
    {
        const nyquist = this.analyzerNode.context.sampleRate / 2;
        const spectrum = this.freqDomain;
        const spectrumLength = spectrum.length;

        const logAverages = new Array(octaveBands.length);
        // Keep a second index for the current average group and place the values accordingly
        // With only one loop in the spectrum data
        let octaveIndex = 0;

        for (let specIndex = 0; specIndex < spectrumLength; specIndex++)
        {
            const specIndexFrequency = Math.round(
                (specIndex * nyquist) / this.freqDomain.length
            );

            // Increase the group index if the current frequency exceeds the limits of the band
            if (specIndexFrequency > octaveBands[octaveIndex].hi)
            {
                octaveIndex++;
            }

            logAverages[octaveIndex]
                = logAverages[octaveIndex] !== undefined
                    ? (logAverages[octaveIndex] + spectrum[specIndex]) / 2
                    : spectrum[specIndex];
        }

        return logAverages;
    }

    /**
     *  Calculates and Returns the 1/N
     *  <a href="https://en.wikipedia.org/wiki/Octave_band" target="_blank">Octave Bands</a>
     *  N defaults to 3 and minimum central frequency to 15.625Hz.
     *  (1/3 Octave Bands ~= 31 Frequency Bands)
     *  Setting fCtr0 to a central value of a higher octave will ignore the lower bands
     *  and produce less frequency groups.
     *
     *  @method   getOctaveBands
     *  @for FFT
     *  @param  {Number}  _N             Specifies the 1/N type of generated octave bands
     *  @param  {Number}  _fCtr0         Minimum central frequency for the lowest band
     *  @return {Array}   octaveBands   Array of octave band objects with their bounds
     */
    getOctaveBands(_N : number, _fCtr0 : number) : FrequencyBand[]
    {
        const N = _N || 3; // Default to 1/3 Octave Bands
        const fCtr0 = _fCtr0 || 15.625; // Minimum central frequency, defaults to 15.625Hz

        const octaveBands : FrequencyBand[] = [];
        let lastFrequencyBand : FrequencyBand = {
            low: fCtr0 / Math.pow(2, 1 / (2 * N)),
            ctr: fCtr0,
            hi: fCtr0 * Math.pow(2, 1 / (2 * N)),
        };

        octaveBands.push(lastFrequencyBand);

        const nyquist = this.analyzerNode.context.sampleRate / 2;

        while (lastFrequencyBand.hi < nyquist)
        {
            const newCtr : number = lastFrequencyBand.ctr * Math.pow(2, 1 / N);
            const newFrequencyBand : FrequencyBand = {
                low: lastFrequencyBand.hi,
                ctr: newCtr,
                hi: newCtr * Math.pow(2, 1 / (2 * N))
            };

            octaveBands.push(newFrequencyBand);
            lastFrequencyBand = newFrequencyBand;
        }

        return octaveBands;
    }

    // helper methods to convert type from float (dB) to int (0-255)
    freqToFloat() : void
    {
        if (this.freqDomain instanceof Float32Array)
        {
            this.freqDomain = new Float32Array(this.analyzerNode.frequencyBinCount);
        }
    }

    freqToInt() : void
    {
        if (this.freqDomain instanceof Uint8Array)
        {
            this.freqDomain = new Uint8Array(this.analyzerNode.frequencyBinCount);
        }
    }

    timeToFloat() : void
    {
        if (!(this.timeDomain instanceof Float32Array))
        {
            this.timeDomain = new Float32Array(this.analyzerNode.frequencyBinCount);
        }
    }

    /* Converts FFT Time domain From Float32Array to UInt8Array */
    timeToInt() : void
    {
        if (!(this.timeDomain instanceof Uint8Array))
        {
            this.timeDomain = new Uint8Array(this.analyzerNode.frequencyBinCount);
        }
    }
}

export { FFT };
