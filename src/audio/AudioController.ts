/**
 * AudioController - Synthesized audio system using Web Audio API
 * Handles all game SFX without external assets
 */

export interface SoundConfig {
  volume: number;
  pitchVariation: number;
}

export class AudioController {
  private _context: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _isInitialized: boolean = false;
  private _config: SoundConfig = { volume: 0.5, pitchVariation: 0.1 };
  
  constructor(config?: Partial<SoundConfig>) {
    if (config) {
      this._config.volume = config.volume ?? this._config.volume;
      this._config.pitchVariation = config.pitchVariation ?? this._config.pitchVariation;
    }
  }
  
  private async _init(): Promise<void> {
    if (this._isInitialized) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this._context = new AudioContextClass();
      this._masterGain = this._context.createGain();
      this._masterGain.gain.value = this._config.volume;
      this._masterGain.connect(this._context.destination);
      this._isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }
  
  public async resume(): Promise<void> {
    if (!this._context) await this._init();
    if (this._context && this._context.state === 'suspended') {
      await this._context.resume();
    }
  }
  
  public setVolume(value: number): void {
    this._config.volume = Math.max(0, Math.min(1, value));
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this._config.volume, this._context!.currentTime, 0.1);
    }
  }
  
  public getVolume(): number {
    return this._config.volume;
  }
  
  /** Play engine idle sound */
  public playEngineIdle(speed: number): void {
    if (!this._context || !this._masterGain) return;
    
    const osc = this._context.createOscillator();
    const gain = this._context.createGain();
    
    // Engine tone based on speed
    const frequency = 80 + (speed / 350) * 150;
    osc.frequency.setValueAtTime(frequency, this._context.currentTime);
    
    // Add some harmonic content
    const harmonics = this._context.createOscillator();
    harmonics.type = 'sawtooth';
    harmonics.frequency.setValueAtTime(frequency * 2, this._context.currentTime);
    const harmonicGain = this._context.createGain();
    harmonicGain.gain.value = 0.15;
    harmonics.connect(harmonicGain);
    harmonicGain.connect(this._masterGain);
    
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this._masterGain);
    
    gain.gain.setValueAtTime(0.1, this._context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this._context.currentTime + 0.3);
    
    osc.start(this._context.currentTime);
    osc.stop(this._context.currentTime + 0.3);
    harmonics.start(this._context.currentTime);
    harmonics.stop(this._context.currentTime + 0.3);
  }
  
  /** Play tire skid sound */
  public playSkid(driftIntensity: number): void {
    if (!this._context || !this._masterGain) return;
    
    const bufferSize = this._context.sampleRate * 0.3;
    const buffer = this._context.createBuffer(1, bufferSize, this._context.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * driftIntensity;
    }
    
    const noise = this._context.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this._context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 + driftIntensity * 600, this._context.currentTime);
    
    const gain = this._context.createGain();
    gain.gain.setValueAtTime(0.3 * driftIntensity, this._context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this._context.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    
    noise.start(this._context.currentTime);
  }
  
  /** Play jump/bounce sound */
  public playJump(): void {
    if (!this._context || !this._masterGain) return;
    
    const osc = this._context.createOscillator();
    const gain = this._context.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this._context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this._context.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.4, this._context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this._context.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this._masterGain);
    
    osc.start(this._context.currentTime);
    osc.stop(this._context.currentTime + 0.15);
  }
  
  /** Play crash/damage sound */
  public playCrash(): void {
    if (!this._context || !this._masterGain) return;
    
    const bufferSize = this._context.sampleRate * 0.5;
    const buffer = this._context.createBuffer(1, bufferSize, this._context.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    
    const noise = this._context.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this._context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, this._context.currentTime);
    filter.frequency.linearRampToValueAtTime(50, this._context.currentTime + 0.5);
    
    const gain = this._context.createGain();
    gain.gain.setValueAtTime(0.8, this._context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this._context.currentTime + 0.5);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    
    noise.start(this._context.currentTime);
  }
  
  /** Play coin/pickup sound */
  public playCoin(): void {
    if (!this._context || !this._masterGain) return;
    
    const osc = this._context.createOscillator();
    const gain = this._context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this._context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this._context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.5, this._context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this._context.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this._masterGain);
    
    osc.start(this._context.currentTime);
    osc.stop(this._context.currentTime + 0.1);
  }
  
  /** Play power-up activation sound */
  public playPowerUp(type: string): void {
    if (!this._context || !this._masterGain) return;
    
    const osc = this._context.createOscillator();
    const gain = this._context.createGain();
    
    const frequencies: Record<string, number[]> = {
      nitro: [400, 600, 800],
      shield: [300, 500, 700],
      turbo: [500, 750, 1000],
      default: [300, 500]
    };
    
    const freqs = frequencies[type] || frequencies.default;
    const now = this._context.currentTime;
    
    for (let i = 0; i < freqs.length; i++) {
      const noteOsc = this._context.createOscillator();
      const noteGain = this._context.createGain();
      
      noteOsc.type = 'sine';
      noteOsc.frequency.setValueAtTime(freqs[i], now + i * 0.05);
      noteOsc.frequency.linearRampToValueAtTime(freqs[i] * 1.5, now + i * 0.05 + 0.15);
      
      noteGain.gain.setValueAtTime(0.3 / freqs.length, now + i * 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.15);
      
      noteOsc.connect(noteGain);
      noteGain.connect(this._masterGain);
      
      noteOsc.start(now + i * 0.05);
      noteOsc.stop(now + i * 0.05 + 0.15);
    }
  }
  
  /** Play drift score combo sound */
  public playDriftCombo(count: number): void {
    if (!this._context || !this._masterGain) return;
    
    const osc = this._context.createOscillator();
    const gain = this._context.createGain();
    
    const baseFreq = 200 + count * 100;
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, this._context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, this._context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.2, this._context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this._context.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this._masterGain);
    
    osc.start(this._context.currentTime);
    osc.stop(this._context.currentTime + 0.1);
  }
  
  /** Play game over sound */
  public playGameOver(): void {
    if (!this._context || !this._masterGain) return;
    
    const osc = this._context.createOscillator();
    const gain = this._context.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, this._context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this._context.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.5, this._context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this._context.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this._masterGain);
    
    osc.start(this._context.currentTime);
    osc.stop(this._context.currentTime + 0.5);
  }
  
  /** Play win/victory sound */
  public playWin(): void {
    if (!this._context || !this._masterGain) return;
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C major arpeggio
    
    notes.forEach((freq, i) => {
      const osc = this._context!.createOscillator();
      const gain = this._context!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this._context!.currentTime + i * 0.15);
      osc.frequency.linearRampToValueAtTime(freq * 1.2, this._context!.currentTime + i * 0.15 + 0.2);
      
      gain.gain.setValueAtTime(0.4, this._context!.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, this._context!.currentTime + i * 0.15 + 0.2);
      
      osc.connect(gain);
      gain.connect(this._masterGain!);
      
      osc.start(this._context!.currentTime + i * 0.15);
      osc.stop(this._context!.currentTime + i * 0.15 + 0.2);
    });
  }
  
  /** Pause all sounds */
  public pauseAll(): void {
    if (this._context) {
      this._context.suspend();
    }
  }
  
  /** Resume paused sounds */
  public resumeAll(): void {
    if (this._context) {
      this._context.resume();
    }
  }
  
  /** Dispose of audio context */
  public dispose(): void {
    if (this._context) {
      this._context.close();
      this._context = null;
      this._masterGain = null;
      this._isInitialized = false;
    }
  }
}