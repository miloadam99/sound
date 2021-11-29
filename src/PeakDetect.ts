/**
 *  @class  PeakDetect
 *  @constructor
 *  @param {Number} [freq1]     lowFrequency - defaults to 20Hz
 *  @param {Number} [freq2]     highFrequency - defaults to 20000 Hz
 *  @param {Number} [threshold] Threshold for detecting a beat between 0 and 1
 *                            scaled logarithmically where 0.1 is 1/2 the loudness
 *                            of 1.0. Defaults to 0.35.
 *  @param {Number} [framesPerPeak]     Defaults to 20.
 */
import { FFT } from './FFT';

class PeakDetect
{
    // framesPerPeak determines how often to look for a beat.
    // If a beat is provided, try to look for a beat based on bpm
    public framesPerPeak: number;
    public framesSinceLastPeak: number;
    public decayRate: number;
    public threshold: number;
    public cutoff: number;
    public cutoffMult: number;
    public energy: number;
    public penergy: number;
    public currentValue: number;
    public isDetected: boolean;
    public f1: number;
    public f2: number;
    _onPeak : () => void;

    /**
     *
     * @param freq1 Starting cutoff filter frequency
     * @param freq2 Ending cutoff filter frequency
     * @param threshold Threshold for detecting a beat between 0 and 1 scaled
     * logarithmically where 0.1 is 1/2 the loudness of 1.0.
     * @param _framesPerPeak Peak Detector will not detect peaks during frame size.
     */
    constructor(freq1 = 40, freq2 = 20000, threshold = 0.35, _framesPerPeak = 20)
    {
        this.framesPerPeak = _framesPerPeak;
        this.framesSinceLastPeak = 0;
        this.decayRate = 0.95;

        this.threshold = threshold;
        this.cutoff = 0;

        // how much to increase the cutoff
        // TO DO: document this / figure out how to make it accessible
        this.cutoffMult = 1.5;

        this.energy = 0;
        this.penergy = 0;

        // TO DO: document this property / figure out how to make it accessible
        this.currentValue = 0;

        /**
         *  isDetected is set to true when a peak is detected.
         *
         *  @attribute isDetected {Boolean}
         *  @default  false
         */
        this.isDetected = false;

        this.f1 = freq1;
        this.f2 = freq2;

        // function to call when a peak is detected
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        this._onPeak = () => {};
    }

    /**
     *  The update method is run in the draw loop.
     *
     *  Accepts an FFT object. You must call .analyze()
     *  on the FFT object prior to updating the peakDetect
     *  because it relies on a completed FFT analysis.
     *
     *  @method  update
     *  @param  {FFT} fft An FFT object
     */
    update(fft : FFT) : void
    {
        const nrg = (this.energy = fft.getEnergy(this.f1, this.f2) / 255);

        if (nrg > this.cutoff && nrg > this.threshold && nrg - this.penergy > 0)
        {
            // trigger callback
            this._onPeak();
            this.isDetected = true;

            // debounce
            this.cutoff = nrg * this.cutoffMult;
            this.framesSinceLastPeak = 0;
        }
        else
        {
            this.isDetected = false;
            if (this.framesSinceLastPeak <= this.framesPerPeak)
            {
                this.framesSinceLastPeak++;
            }
            else
            {
                this.cutoff *= this.decayRate;
                this.cutoff = Math.max(this.cutoff, this.threshold);
            }
        }

        this.currentValue = nrg;
        this.penergy = nrg;
    }

    /**
     *  onPeak accepts two arguments: a function to call when
     *  a peak is detected. The value of the peak,
     *  between 0.0 and 1.0, is passed to the callback.
     *
     *  @method  onPeak
     *  @param  {Function} callback Name of a function that will
     *                              be called when a peak is
     *                              detected.
     *
     *  @param  {Object}   [val]    Optional value to pass
     *                              into the function when
     *                              a peak is detected.
     */
    onPeak(callback : (energy : number, val : any) => void, val : any) : void
    {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        // eslint-disable-next-line func-names
        self._onPeak = function ()
        {
            callback(self.energy, val);
        };
    }
}

export { PeakDetect };
