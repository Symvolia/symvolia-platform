/**
 * Symvolia — Portal Audio Timeline
 * Web Audio API score synced to the cinematic portal (8–10s).
 * Cross-fades only — no gaps. Mix headroom ≈ −3 dB.
 */
(function (global) {
  'use strict';

  const MASTER_GAIN = 0.707; // −3 dB headroom

  function PortalAudio() {
    this.ctx = null;
    this.master = null;
    this.bpm = 60;
    this._hbTimer = null;
    this._nodes = [];
    this._started = false;
    this._muted = false;
    this._phaseGains = {};
  }

  PortalAudio.prototype._ensure = function () {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : MASTER_GAIN;
    this.master.connect(this.ctx.destination);
    return true;
  };

  PortalAudio.prototype.setMuted = function (muted) {
    this._muted = !!muted;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_GAIN, t + 0.12);
    }
  };

  PortalAudio.prototype.resume = function () {
    if (!this._ensure()) return Promise.resolve();
    if (this.ctx.state === 'suspended') return this.ctx.resume();
    return Promise.resolve();
  };

  PortalAudio.prototype._track = function (node) {
    this._nodes.push(node);
    return node;
  };

  PortalAudio.prototype._gain = function (v) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    this._track(g);
    return g;
  };

  /** Soft low drone (phase A baseline). */
  PortalAudio.prototype._startDrone = function () {
    const ctx = this.ctx;
    const g = this._gain(0);
    g.connect(this.master);
    this._phaseGains.drone = g;

    [38, 55, 77].forEach((freq, i) => {
      const o = this._track(ctx.createOscillator());
      const og = this._gain(i === 0 ? 0.35 : 0.18);
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = freq;
      const f = this._track(ctx.createBiquadFilter());
      f.type = 'lowpass';
      f.frequency.value = 180;
      o.connect(og);
      og.connect(f);
      f.connect(g);
      o.start();
    });
  };

  /** Warm pad that brightens in phase B. */
  PortalAudio.prototype._startPad = function () {
    const ctx = this.ctx;
    const g = this._gain(0);
    g.connect(this.master);
    this._phaseGains.pad = g;

    [110, 164.81, 220].forEach((freq, i) => {
      const o = this._track(ctx.createOscillator());
      const og = this._gain(0.12);
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = (i - 1) * 7;
      o.connect(og);
      og.connect(g);
      o.start();
    });
  };

  PortalAudio.prototype._beat = function (time, intensity) {
    const ctx = this.ctx;
    // Dual thump (lub-dub)
    [0, 0.12].forEach((off, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(i === 0 ? 68 : 52, time + off);
      o.frequency.exponentialRampToValueAtTime(28, time + off + 0.12);
      g.gain.setValueAtTime(0.0001, time + off);
      g.gain.exponentialRampToValueAtTime(0.45 * intensity, time + off + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + off + 0.18);
      o.connect(g);
      g.connect(this.master);
      o.start(time + off);
      o.stop(time + off + 0.22);
    });
  };

  PortalAudio.prototype._scheduleHeartbeats = function (startAt, durationSec, bpmFrom, bpmTo) {
    const ctx = this.ctx;
    let t = startAt;
    const end = startAt + durationSec;
    // Approximate accelerating BPM by segmenting
    while (t < end) {
      const p = (t - startAt) / durationSec;
      const bpm = bpmFrom + (bpmTo - bpmFrom) * p;
      const intensity = 0.55 + p * 0.45;
      this._beat(t, intensity);
      t += 60 / Math.max(40, bpm);
    }
  };

  /** Epic peak: bass drop + cymbal-like noise swell, centered on absolute 6.0s. */
  PortalAudio.prototype._schedulePeak = function (absPeakSec) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const peak = t0 + absPeakSec;

    // Bass drop
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(90, peak - 0.15);
    bass.frequency.exponentialRampToValueAtTime(32, peak + 0.55);
    bg.gain.setValueAtTime(0.0001, peak - 0.15);
    bg.gain.exponentialRampToValueAtTime(0.7, peak);
    bg.gain.exponentialRampToValueAtTime(0.0001, peak + 0.9);
    bass.connect(bg);
    bg.connect(this.master);
    bass.start(peak - 0.15);
    bass.stop(peak + 1.0);

    // Cymbal / noise swell
    const len = ctx.sampleRate * 1.4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, peak - 0.35);
    bp.frequency.exponentialRampToValueAtTime(6000, peak);
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, peak - 0.4);
    ng.gain.exponentialRampToValueAtTime(0.35, peak);
    ng.gain.exponentialRampToValueAtTime(0.0001, peak + 0.85);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.master);
    src.start(peak - 0.4);
  };

  /**
   * Start the full 0→8.5s+ score. `originMs` is performance.now() of cinematic t=0.
   * Timeline (seconds from origin):
   *   0–3.5  drone + HB 60
   *   3.5–5.5 pad grow + HB 60→100
   *   5.5–6.5 peak (bass+cymbal @ 6.0)
   *   6.5–8.5 decay to baseline
   *   8.5+ atmospheric steady
   */
  PortalAudio.prototype.startTimeline = function () {
    if (this._started) return;
    if (!this._ensure()) return;
    this._started = true;

    const self = this;
    this.resume().then(function () {
      const ctx = self.ctx;
      const t0 = ctx.currentTime;

      self._startDrone();
      self._startPad();

      // Phase A: drone fade-in
      self._phaseGains.drone.gain.setValueAtTime(0.0001, t0);
      self._phaseGains.drone.gain.exponentialRampToValueAtTime(0.55, t0 + 1.2);
      self._phaseGains.drone.gain.setValueAtTime(0.55, t0 + 3.5);

      // Heartbeats 0–3.5 @ 60 BPM
      self._scheduleHeartbeats(t0 + 0.35, 3.15, 60, 60);

      // Phase B: pad rise + HB accel
      self._phaseGains.pad.gain.setValueAtTime(0.0001, t0 + 3.4);
      self._phaseGains.pad.gain.exponentialRampToValueAtTime(0.5, t0 + 5.4);
      self._phaseGains.drone.gain.linearRampToValueAtTime(0.4, t0 + 5.5);
      self._scheduleHeartbeats(t0 + 3.5, 2.0, 60, 100);

      // Phase C: peak @ 6.0s absolute
      self._schedulePeak(6.0);
      self._phaseGains.drone.gain.linearRampToValueAtTime(0.75, t0 + 6.05);
      self._phaseGains.pad.gain.linearRampToValueAtTime(0.65, t0 + 6.05);

      // Phase D: decay toward baseline
      self._phaseGains.drone.gain.linearRampToValueAtTime(0.32, t0 + 8.4);
      self._phaseGains.pad.gain.linearRampToValueAtTime(0.22, t0 + 8.4);

      // Soft HB settling 6.5–8.5
      self._scheduleHeartbeats(t0 + 6.5, 2.0, 90, 62);

      // Phase E: steady atmospheric (hold levels)
      self._phaseGains.drone.gain.setValueAtTime(0.28, t0 + 8.5);
      self._phaseGains.pad.gain.setValueAtTime(0.18, t0 + 8.5);
    });
  };

  /** Crossfade portal bed into site ambient (no gap). */
  PortalAudio.prototype.handOff = function (durationSec) {
    if (!this.ctx || !this._phaseGains.drone) return;
    const t = this.ctx.currentTime;
    const d = durationSec || 1.4;
    Object.keys(this._phaseGains).forEach((k) => {
      const g = this._phaseGains[k];
      g.gain.cancelScheduledValues(t);
      g.gain.linearRampToValueAtTime(0.0001, t + d);
    });
  };

  PortalAudio.prototype.dispose = function () {
    this.handOff(0.3);
    this._nodes = [];
    this._started = false;
  };

  global.SymvoliaPortalAudio = PortalAudio;
})(typeof window !== 'undefined' ? window : globalThis);
