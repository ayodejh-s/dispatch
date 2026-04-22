"use client";
import { useState, useEffect, useCallback, JSX } from "react";


type SeverityCode = 'ECHO' | 'DELTA' | 'CHARLIE' | 'BRAVO' | 'ALPHA' | 'OMEGA';
type ZoneCode = 'URBAN_DENSE' | 'URBAN_STD' | 'OUTER';
type SceneSafety = 'SAFE' | 'UNSAFE' | 'UNKNOWN';
type StepId = 'caller' | 'safety' | 'complaint' | 'bigsix' | 'protocol' | 'patient' | 'result';

interface Complaint {
  id: string;
  label: string;
  category: string;
  lagosSpecific?: boolean;
}

interface LGA {
  id: string;
  label: string;
  zone: ZoneCode;
}

interface Hospital {
  id: string;
  name: string;
  fullName: string;
  location: string;
  lga: string;
  type: 'ALS' | 'BLS';
  capabilities: string[];
  etaByZone: Record<ZoneCode, number>;
  status: 'OPEN' | 'CLOSED';
}

interface ProtocolQuestion {
  id: string;
  text: string;
  type: 'yesno' | 'select';
  critical?: boolean;
  options?: string[];
}

interface Protocol {
  name: string;
  baseSeverity: SeverityCode;
  questions: ProtocolQuestion[];
}

interface BigSixQuestion {
  id: string;
  text: string;
  severity: 'ECHO' | 'DELTA';
  tag: string;
}

interface PatientData {
  age: string | number;
  sex: string;
  pregnant: boolean;
  gestationalAge: string | number;
  consciousness: string;
  breathing: string;
  knownCardiac: boolean;
  knownDiabetic: boolean;
  knownSeizure: boolean;
  comorbidities: string;
}

interface Incident {
  callerPhone: string;
  callerName: string;
  callerRelation: string;
  address: string;
  lgaId: string;
  patientCount: number;
  sceneSafety: SceneSafety | null;
  hazards?: string[];
  complaint: string | null;
  bigSix: Record<string, boolean>;
  protocolAnswers: Record<string, boolean | string>;
  patient: PatientData | null;
  zone: ZoneCode;
}

interface TriageResult {
  severity: SeverityCode;
  escalationReasons: string[];
  responseTimeMinutes?: number;
  hospital?: Hospital;
  pai?: string[];
  capabilityFilter?: string | null;
  coResponse?: string[];
}

interface SeverityMeta {
  color: string;
  bg: string;
  desc: string;
  resource: string;
}

interface SampleCall {
  id: string;
  complaint: string;
  severity: SeverityCode;
  location: string;
  time: string;
  status: string;
}

// ── Styles ─────────────────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        oklch(11% 0.015 240);
    --bg2:       oklch(15% 0.015 240);
    --bg3:       oklch(19% 0.015 240);
    --border:    oklch(26% 0.015 240);
    --border2:   oklch(32% 0.015 240);
    --text:      oklch(92% 0.008 240);
    --muted:     oklch(56% 0.010 240);
    --accent:    oklch(68% 0.18 165);
    --font-ui:   'IBM Plex Sans', sans-serif;
    --font-mono: 'IBM Plex Mono', monospace;
  }

  html, body, #root { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 14px;
    line-height: 1.5;
    overflow: hidden;
  }

  /* ── TOP BAR ─────────────────────── */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    height: 48px; padding: 0 16px;
    background: var(--bg2); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .topbar-left  { display: flex; align-items: center; gap: 16px; }
  .brand        { font-family: var(--font-mono); font-weight: 500; font-size: 15px; color: var(--accent); letter-spacing: 0.08em; }
  .incident-id  { font-family: var(--font-mono); font-size: 13px; color: var(--text); }
  .dashboard-mode { font-size: 12px; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }
  .call-active  { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #34C759; font-weight: 600; letter-spacing: 0.05em; }
  .pulse-dot    { width: 7px; height: 7px; border-radius: 50%; background: #34C759; animation: pulse 1.2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
  .topbar-progress { display: flex; gap: 5px; }
  .progress-pip { width: 24px; height: 4px; border-radius: 2px; background: var(--border2); transition: background .25s; }
  .progress-pip.done   { background: var(--accent); }
  .progress-pip.active { background: var(--text); }
  .topbar-right { display: flex; align-items: center; gap: 16px; }
  .timer   { font-family: var(--font-mono); font-size: 18px; font-weight: 500; color: var(--text); }
  .operator { font-size: 12px; color: var(--muted); }

  /* ── APP LAYOUT ──────────────────── */
  .app      { display: flex; flex-direction: column; height: 100vh; }
  .app-body { display: flex; flex: 1; overflow: hidden; }

  /* ── SIDEBAR ─────────────────────── */
  .sidebar {
    width: 168px; flex-shrink: 0;
    background: var(--bg2); border-right: 1px solid var(--border);
    padding: 20px 0; display: flex; flex-direction: column; gap: 4px; overflow-y: auto;
  }
  .sidebar-label { font-size: 10px; font-weight: 600; color: var(--muted); letter-spacing: 0.1em; padding: 0 16px 8px; text-transform: uppercase; }
  .step-item { display: flex; align-items: center; gap: 10px; padding: 8px 16px; color: var(--muted); font-size: 12px; transition: all .15s; }
  .step-item.done   { color: var(--accent); }
  .step-item.active { color: var(--text); background: var(--bg3); }
  .step-icon { width: 20px; height: 20px; border-radius: 50%; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; flex-shrink: 0; }
  .step-item.active .step-icon { background: var(--text); color: var(--bg); border-color: var(--text); }
  .step-item.done   .step-icon { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .sidebar-severity { margin: 16px 12px 0; padding: 10px; border-radius: 6px; border: 1px solid; text-align: center; font-family: var(--font-mono); font-weight: 600; font-size: 13px; letter-spacing: 0.1em; }

  /* ── MAIN PANEL ──────────────────── */
  .main-panel { flex: 1; overflow-y: auto; padding: 28px 32px; }

  /* ── SUMMARY PANEL ───────────────── */
  .summary {
    width: 220px; flex-shrink: 0;
    background: var(--bg2); border-left: 1px solid var(--border);
    padding: 20px 16px; overflow-y: auto;
  }
  .summary-label   { font-size: 10px; font-weight: 600; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px; }
  .summary-row     { display: flex; flex-direction: column; margin-bottom: 10px; }
  .s-key           { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .s-val           { font-size: 12px; color: var(--text); margin-top: 1px; }
  .s-val.danger    { color: #FF3B30; }
  .zone-tag        { font-size: 10px; color: var(--muted); background: var(--bg3); border-radius: 3px; padding: 1px 5px; }
  .summary-severity { margin-top: 16px; padding: 12px; border-radius: 6px; border: 1px solid; text-align: center; }
  .sev-code  { font-family: var(--font-mono); font-size: 18px; font-weight: 600; }
  .sev-desc  { font-size: 11px; margin-top: 4px; opacity: .8; }

  /* ── STEP CONTENT ────────────────── */
  .step-content { max-width: 680px; }
  .step-title   { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
  .step-sub     { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
  .step-sub kbd { background: var(--bg3); border: 1px solid var(--border2); border-radius: 3px; padding: 1px 5px; font-size: 11px; font-family: var(--font-mono); color: var(--text); }
  .step-actions { margin-top: 28px; }

  /* ── FORMS ───────────────────────── */
  .form-grid, .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; }
  .field       { display: flex; flex-direction: column; gap: 5px; }
  .field.full  { grid-column: 1 / -1; }
  .field label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .inp { background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 9px 12px; color: var(--text); font-family: var(--font-ui); font-size: 13px; outline: none; transition: border .15s; width: 100%; }
  .inp:focus   { border-color: var(--accent); }
  .inp option  { background: var(--bg3); }
  .search-inp  { margin-bottom: 0; }

  /* ── BUTTONS ─────────────────────── */
  .btn-primary { background: var(--accent); color: oklch(11% 0.015 240); border: none; border-radius: 6px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity .15s; font-family: var(--font-ui); }
  .btn-primary:hover    { opacity: .88; }
  .btn-primary:disabled { opacity: .35; cursor: not-allowed; }

  /* ── SAFETY STEP ─────────────────── */
  .safety-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .safety-btn  { background: var(--bg3); border: 1.5px solid var(--border); border-radius: 8px; padding: 18px 14px; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; transition: all .15s; }
  .safety-btn:hover        { border-color: var(--border2); }
  .safety-btn.safe.selected   { border-color: #34C759; background: #0A2B12; }
  .safety-btn.unsafe.selected { border-color: #FF3B30; background: #3D0A08; }
  .safety-btn.unknown.selected{ border-color: #FF9500; background: #3D2000; }
  .safety-icon { font-size: 24px; }
  .safety-label { font-size: 13px; font-weight: 700; color: var(--text); }
  .safety-desc  { font-size: 11px; color: var(--muted); text-align: center; line-height: 1.4; }
  .hazards-section { margin-top: 16px; }
  .hazards-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
  .hazards-grid  { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .hazard-chip   { background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; padding: 6px 14px; font-size: 12px; color: var(--muted); cursor: pointer; transition: all .15s; }
  .hazard-chip.active { border-color: #FF3B30; background: #3D0A08; color: #FF3B30; }
  .unsafe-notice { background: #3D0A08; border: 1px solid #FF3B30; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #FF3B30; font-weight: 600; }

  /* ── COMPLAINT STEP ──────────────── */
  .complaint-controls { margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
  .cat-tabs   { display: flex; gap: 6px; flex-wrap: wrap; }
  .cat-tab    { background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; padding: 5px 12px; font-size: 12px; color: var(--muted); cursor: pointer; transition: all .15s; }
  .cat-tab.active { border-color: var(--accent); color: var(--accent); background: oklch(17% 0.05 165); }
  .complaint-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .complaint-btn  { background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; text-align: left; cursor: pointer; transition: all .15s; position: relative; display: flex; flex-direction: column; gap: 2px; }
  .complaint-btn:hover   { border-color: var(--border2); background: oklch(21% 0.015 240); }
  .complaint-btn.selected{ border-color: var(--accent); background: oklch(17% 0.05 165); }
  .complaint-btn.critical{ border-left: 3px solid #FF3B30; }
  .complaint-btn.lagos   { border-left: 3px solid #FF9500; }
  .complaint-cat  { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .complaint-name { font-size: 13px; color: var(--text); font-weight: 500; }
  .lagos-badge    { position: absolute; top: 6px; right: 8px; font-size: 9px; font-weight: 700; color: #FF9500; background: #3D2000; border-radius: 3px; padding: 1px 4px; }

  /* ── BIG SIX STEP ────────────────── */
  .bigsix-header     { margin-bottom: 24px; }
  .bigsix-progress-bar { height: 3px; background: var(--border); border-radius: 2px; margin: 12px 0 6px; overflow: hidden; }
  .bigsix-progress-bar div { height: 100%; background: var(--accent); border-radius: 2px; transition: width .3s; }
  .bigsix-counter    { font-size: 11px; color: var(--muted); }
  .bigsix-card       { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 16px; }
  .bigsix-tag        { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-family: var(--font-mono); margin-bottom: 14px; }
  .bigsix-question   { font-size: 18px; font-weight: 600; color: var(--text); line-height: 1.45; margin-bottom: 22px; }
  .bigsix-actions    { display: flex; gap: 12px; }
  .bigsix-yn         { flex: 1; border: 2px solid var(--btn-color, var(--accent)); border-radius: 8px; background: transparent; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; transition: background .15s; }
  .bigsix-yn:hover   { background: color-mix(in srgb, var(--btn-color, var(--accent)) 12%, transparent); }
  .yn-label   { font-size: 22px; font-weight: 700; color: var(--btn-color, var(--accent)); font-family: var(--font-mono); }
  .yn-sub     { font-size: 11px; color: var(--muted); }
  .yn-key     { font-size: 11px; font-family: var(--font-mono); background: var(--bg2); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; color: var(--muted); margin-top: 4px; }
  .bigsix-answered   { display: flex; flex-direction: column; gap: 6px; }
  .bigsix-done-item  { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--muted); padding: 4px 0; border-top: 1px solid var(--border); }
  .bigsix-done-no    { font-family: var(--font-mono); font-size: 11px; color: #34C759; font-weight: 600; min-width: 36px; }

  /* ── PROTOCOL STEP ───────────────── */
  .proto-progress  { display: flex; gap: 4px; margin-bottom: 20px; }
  .proto-pip       { width: 20px; height: 3px; border-radius: 2px; background: var(--border); }
  .proto-pip.done  { background: var(--accent); }
  .proto-pip.active{ background: var(--text); }
  .proto-card      { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 24px; }
  .proto-critical  { font-size: 10px; font-weight: 700; color: #FF3B30; letter-spacing: 0.1em; text-transform: uppercase; font-family: var(--font-mono); margin-bottom: 8px; }
  .proto-q-num     { font-size: 11px; color: var(--muted); font-family: var(--font-mono); margin-bottom: 10px; }
  .proto-question  { font-size: 17px; font-weight: 600; color: var(--text); line-height: 1.45; margin-bottom: 20px; }
  .proto-yn-row    { display: flex; gap: 10px; }
  .proto-yn-btn    { flex: 1; border: 2px solid var(--btn-color, var(--accent)); border-radius: 8px; background: transparent; padding: 12px 20px; font-size: 16px; font-weight: 700; color: var(--btn-color, var(--accent)); cursor: pointer; font-family: var(--font-mono); display: flex; align-items: center; justify-content: center; gap: 10px; transition: background .15s; }
  .proto-yn-btn:hover { background: color-mix(in srgb, var(--btn-color, var(--accent)) 12%, transparent); }
  .proto-yn-btn kbd   { font-size: 11px; background: var(--bg2); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; color: var(--muted); font-family: var(--font-mono); }
  .proto-options   { display: flex; flex-direction: column; gap: 8px; }
  .proto-opt       { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; text-align: left; font-size: 13px; color: var(--text); cursor: pointer; transition: all .15s; }
  .proto-opt:hover    { border-color: var(--border2); }
  .proto-opt.selected { border-color: var(--accent); background: oklch(17% 0.05 165); color: var(--accent); }
  .proto-answered  { margin-top: 16px; display: flex; flex-direction: column; gap: 4px; }
  .proto-done-item { display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 4px 0; border-top: 1px solid var(--border); gap: 12px; }
  .proto-done-label{ color: var(--muted); flex: 1; }
  .proto-done-val  { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--text); }

  /* ── PATIENT STEP ────────────────── */
  .avpu-row        { display: flex; gap: 8px; flex-wrap: wrap; }
  .avpu-btn        { background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 8px 14px; font-size: 12px; color: var(--muted); cursor: pointer; transition: all .15s; }
  .avpu-btn.active { border-color: var(--accent); background: oklch(17% 0.05 165); color: var(--accent); }
  .avpu-btn.danger-btn.active { border-color: #FF3B30; background: #3D0A08; color: #FF3B30; }
  .pregnant-row    { display: flex; align-items: center; gap: 16px; }
  .checkbox-label  { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer; white-space: nowrap; }
  .checkbox-label input { accent-color: var(--accent); width: 14px; height: 14px; }
  .comorbidity-row { display: flex; gap: 10px; flex-wrap: wrap; }
  .comorbid-chip   { display: flex; align-items: center; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; padding: 6px 14px; font-size: 12px; color: var(--muted); cursor: pointer; transition: all .15s; }
  .comorbid-chip input { display: none; }
  .comorbid-chip.active { border-color: #FF9500; background: #3D2000; color: #FF9500; }

  /* ── RESULT ──────────────────────── */
  .result          { max-width: 760px; }
  .mci-banner, .unsafe-banner { border-radius: 7px; padding: 10px 16px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
  .mci-banner   { background: #3D2000; border: 1px solid #FF9500; color: #FF9500; }
  .unsafe-banner{ background: #3D0A08; border: 1px solid #FF3B30; color: #FF3B30; }
  .result-top      { display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-start; }
  .sev-badge-large { border: 2px solid; border-radius: 10px; padding: 20px 28px; flex-shrink: 0; min-width: 170px; }
  .sev-code-large  { font-family: var(--font-mono); font-size: 32px; font-weight: 700; letter-spacing: 0.05em; }
  .sev-desc-large  { font-size: 12px; margin-top: 5px; opacity: .8; text-wrap: pretty; }
  .result-meta     { flex: 1; display: flex; flex-direction: column; gap: 7px; }
  .result-meta-row { display: flex; gap: 12px; font-size: 13px; }
  .rm-key          { color: var(--muted); min-width: 110px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding-top: 1px; }
  .rm-val          { color: var(--text); }
  .response-time   { font-family: var(--font-mono); font-weight: 700; font-size: 16px; }
  .escalation-reasons { background: var(--bg3); border: 1px solid var(--border); border-radius: 7px; padding: 14px 16px; margin-bottom: 20px; }
  .er-label  { font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; font-family: var(--font-mono); }
  .er-item   { font-size: 12px; color: var(--text); padding: 3px 0; border-bottom: 1px solid var(--border); }
  .er-item:last-child { border-bottom: none; }
  .result-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .result-card  { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .rc-title     { font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px; font-family: var(--font-mono); }
  .resource-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
  .res-type     { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; min-width: 80px; margin-top: 2px; font-family: var(--font-mono); }
  .res-info     { display: flex; flex-direction: column; }
  .res-unit     { font-size: 13px; font-weight: 600; color: var(--text); }
  .res-detail   { font-size: 11px; color: var(--muted); }
  .hospital-name     { font-size: 17px; font-weight: 700; margin-bottom: 2px; }
  .hospital-full     { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
  .hospital-location { font-size: 12px; color: var(--text); margin-bottom: 8px; }
  .hospital-eta      { font-size: 12px; color: var(--muted); margin-bottom: 10px; }
  .hospital-caps     { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
  .cap-tag      { font-size: 10px; background: var(--bg2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 7px; color: var(--muted); }
  .cap-tag.cap-match { border-color: var(--accent); color: var(--accent); background: oklch(17% 0.05 165); }
  .hospital-status { font-size: 11px; }
  .status-open  { color: #34C759; }
  .pai-section  { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
  .pai-toggle   { width: 100%; background: transparent; border: none; padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; font-family: var(--font-mono); }
  .pai-toggle:hover { color: var(--text); }
  .pai-list    { padding: 0 16px 16px; }
  .pai-intro   { font-size: 12px; color: var(--muted); margin-bottom: 12px; font-style: italic; }
  .pai-item    { display: flex; gap: 12px; margin-bottom: 8px; align-items: flex-start; }
  .pai-num     { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: var(--bg); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .pai-text    { font-size: 13px; color: var(--text); line-height: 1.5; }
  .dispatch-row { display: flex; align-items: center; gap: 14px; }
  .dispatch-btn { flex: 1; padding: 16px; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; color: var(--bg); cursor: pointer; letter-spacing: 0.06em; font-family: var(--font-mono); transition: opacity .15s; }
  .dispatch-btn:hover { opacity: .88; }
  .new-call-ghost { background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 15px 20px; color: var(--muted); font-size: 13px; cursor: pointer; font-family: var(--font-ui); transition: all .15s; }
  .new-call-ghost:hover { border-color: var(--border2); color: var(--text); }
  .dispatched-confirmation { display: flex; align-items: center; gap: 16px; background: var(--bg3); border: 1.5px solid; border-radius: 8px; padding: 16px 20px; }
  .dispatched-icon  { font-size: 28px; font-weight: 700; }
  .dispatched-text  { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .dispatched-text strong { font-size: 14px; font-weight: 700; }
  .dispatched-text span   { font-size: 12px; color: var(--muted); }

  /* ── DASHBOARD ───────────────────── */
  .dashboard         { padding: 32px 36px; overflow-y: auto; height: calc(100vh - 48px); }
  .dashboard-header  { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .dashboard-title   { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  .dashboard-sub     { font-size: 13px; color: var(--muted); }
  .new-call-btn      { background: var(--accent); color: var(--bg); border: none; border-radius: 7px; padding: 12px 22px; font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.04em; transition: opacity .15s; }
  .new-call-btn:hover { opacity: .88; }
  .dashboard-stats   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
  .stat-card         { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 18px 20px; }
  .stat-val          { font-size: 32px; font-weight: 700; font-family: var(--font-mono); color: var(--accent); margin-bottom: 4px; }
  .stat-label        { font-size: 12px; color: var(--muted); }
  .calls-table-wrap  { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .calls-table-label { padding: 14px 18px; font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; border-bottom: 1px solid var(--border); font-family: var(--font-mono); }
  .calls-table       { width: 100%; border-collapse: collapse; }
  .calls-table th    { padding: 10px 18px; text-align: left; font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; border-bottom: 1px solid var(--border); }
  .calls-table td    { padding: 12px 18px; font-size: 13px; border-bottom: 1px solid var(--border); }
  .calls-table tr:last-child td { border-bottom: none; }
  .calls-table tr:hover td      { background: var(--bg3); }
  .call-id     { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
  .sev-pill    { font-family: var(--font-mono); font-size: 11px; font-weight: 700; border: 1px solid; border-radius: 4px; padding: 2px 8px; }
  .status-pill { font-size: 11px; border-radius: 4px; padding: 3px 8px; font-weight: 600; background: var(--bg3); color: var(--muted); }
  .status-pill.en-route { background: #3D2000; color: #FF9500; }
  .status-pill.on-scene { background: #0A2B12; color: #34C759; }
  .status-pill.hospital { background: oklch(17% 0.05 165); color: var(--accent); }
  .status-pill.closed   { color: var(--muted); }

  /* ── SCROLLBARS ──────────────────── */
  ::-webkit-scrollbar       { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
`;

// ── Data ───────────────────────────────────────────────────────────

const COMPLAINTS: Complaint[] = [
  { id: 'abdominal_pain', label: 'Abdominal Pain', category: 'Medical' },
  { id: 'allergic_reaction', label: 'Allergic Reaction / Anaphylaxis', category: 'Medical' },
  { id: 'assault', label: 'Assault / Sexual Assault', category: 'Trauma' },
  { id: 'back_pain', label: 'Back Pain (non-traumatic)', category: 'Medical' },
  { id: 'breathing_problems', label: 'Breathing Problems', category: 'Medical' },
  { id: 'burns', label: 'Burns / Electrocution', category: 'Trauma' },
  { id: 'cardiac_arrest', label: 'Cardiac Arrest / Unconscious', category: 'Critical' },
  { id: 'chest_pain', label: 'Chest Pain', category: 'Critical' },
  { id: 'childbirth', label: 'Childbirth / Obstetric Emergency', category: 'Obstetric' },
  { id: 'choking', label: 'Choking', category: 'Critical' },
  { id: 'seizures', label: 'Convulsions / Seizures', category: 'Medical' },
  { id: 'diabetic', label: 'Diabetic Problems', category: 'Medical' },
  { id: 'drowning', label: 'Drowning / Near-Drowning', category: 'Critical' },
  { id: 'rta', label: 'Okada / Keke / RTA', category: 'Trauma', lagosSpecific: true },
  { id: 'eye_injury', label: 'Eye Injury', category: 'Trauma' },
  { id: 'falls', label: 'Falls', category: 'Trauma' },
  { id: 'headache', label: 'Headache', category: 'Medical' },
  { id: 'heart_problems', label: 'Heart Problems / AICD', category: 'Critical' },
  { id: 'heat_exposure', label: 'Heat Exposure / Collapse', category: 'Medical' },
  { id: 'hemorrhage', label: 'Hemorrhage / Laceration', category: 'Trauma' },
  { id: 'building_collapse', label: 'Industrial / Building Collapse', category: 'Trauma', lagosSpecific: true },
  { id: 'mental_health', label: 'Mental Health Crisis / Suicide Attempt', category: 'Psych' },
  { id: 'overdose', label: 'Overdose / Poisoning', category: 'Medical' },
  { id: 'pregnancy', label: 'Pregnancy Complications', category: 'Obstetric' },
  { id: 'psychiatric', label: 'Psychiatric Emergency', category: 'Psych' },
  { id: 'sick_person', label: 'Sick Person (specific complaint)', category: 'Medical' },
  { id: 'stab_gsw', label: 'Stab / Gunshot / Penetrating Trauma', category: 'Trauma' },
  { id: 'stroke', label: 'Stroke / CVA', category: 'Critical' },
  { id: 'traumatic_injuries', label: 'Traumatic Injuries (non-RTA)', category: 'Trauma' },
  { id: 'unknown', label: 'Unknown Problem / 3rd-party Caller', category: 'Medical' },
  { id: 'co_poisoning', label: 'Generator CO Poisoning', category: 'Medical', lagosSpecific: true },
  { id: 'flood_rescue', label: 'Flood / Water Rescue', category: 'Trauma', lagosSpecific: true },
];

const LGAS: LGA[] = [
  { id: 'lagos_island', label: 'Lagos Island', zone: 'URBAN_DENSE' },
  { id: 'eti_osa', label: 'Eti-Osa (VI / Lekki)', zone: 'URBAN_DENSE' },
  { id: 'ikeja', label: 'Ikeja', zone: 'URBAN_DENSE' },
  { id: 'lagos_mainland', label: 'Lagos Mainland', zone: 'URBAN_DENSE' },
  { id: 'surulere', label: 'Surulere', zone: 'URBAN_DENSE' },
  { id: 'apapa', label: 'Apapa', zone: 'URBAN_DENSE' },
  { id: 'alimosho', label: 'Alimosho', zone: 'URBAN_STD' },
  { id: 'agege', label: 'Agege', zone: 'URBAN_STD' },
  { id: 'shomolu', label: 'Shomolu', zone: 'URBAN_STD' },
  { id: 'kosofe', label: 'Kosofe', zone: 'URBAN_STD' },
  { id: 'mushin', label: 'Mushin', zone: 'URBAN_STD' },
  { id: 'oshodi_isolo', label: 'Oshodi-Isolo', zone: 'URBAN_STD' },
  { id: 'gbagada', label: 'Gbagada / Somolu', zone: 'URBAN_STD' },
  { id: 'ikorodu', label: 'Ikorodu', zone: 'OUTER' },
  { id: 'badagry', label: 'Badagry', zone: 'OUTER' },
  { id: 'epe', label: 'Epe', zone: 'OUTER' },
  { id: 'ibeju_lekki', label: 'Ibeju-Lekki', zone: 'OUTER' },
];

const HOSPITALS: Hospital[] = [
  { id: 'lasuth', name: 'LASUTH', fullName: 'Lagos State University Teaching Hospital', location: 'Ikeja', lga: 'ikeja', type: 'ALS', capabilities: ['LEVEL_1_TRAUMA', 'STROKE_UNIT', 'PICU', 'NICU', 'EMONC', 'PSYCH_EMERGENCY'], etaByZone: { URBAN_DENSE: 12, URBAN_STD: 18, OUTER: 40 }, status: 'OPEN' },
  { id: 'luth', name: 'LUTH', fullName: 'Lagos University Teaching Hospital', location: 'Idi-Araba, Surulere', lga: 'surulere', type: 'ALS', capabilities: ['LEVEL_1_TRAUMA', 'STROKE_UNIT', 'CATH_LAB', 'PICU', 'BURN_CENTER', 'DIALYSIS'], etaByZone: { URBAN_DENSE: 10, URBAN_STD: 20, OUTER: 45 }, status: 'OPEN' },
  { id: 'reddington', name: 'Reddington Hospital', fullName: 'Reddington Hospital', location: 'Victoria Island', lga: 'eti_osa', type: 'ALS', capabilities: ['LEVEL_1_TRAUMA', 'CATH_LAB', 'STROKE_UNIT', 'PICU'], etaByZone: { URBAN_DENSE: 8, URBAN_STD: 22, OUTER: 50 }, status: 'OPEN' },
  { id: 'lagos_island_gen', name: 'Lagos Island General', fullName: 'Lagos Island General Hospital', location: 'Lagos Island', lga: 'lagos_island', type: 'BLS', capabilities: ['EMONC', 'DIALYSIS'], etaByZone: { URBAN_DENSE: 7, URBAN_STD: 25, OUTER: 55 }, status: 'OPEN' },
  { id: 'gbagada_gen', name: 'Gbagada General', fullName: 'Gbagada General Hospital', location: 'Gbagada', lga: 'gbagada', type: 'BLS', capabilities: ['EMONC'], etaByZone: { URBAN_DENSE: 15, URBAN_STD: 12, OUTER: 35 }, status: 'OPEN' },
  { id: 'isolo_gen', name: 'Isolo General', fullName: 'Isolo General Hospital', location: 'Isolo', lga: 'oshodi_isolo', type: 'BLS', capabilities: ['EMONC'], etaByZone: { URBAN_DENSE: 18, URBAN_STD: 10, OUTER: 38 }, status: 'OPEN' },
  { id: 'epe_gen', name: 'Epe General Hospital', fullName: 'Epe General Hospital', location: 'Epe', lga: 'epe', type: 'BLS', capabilities: ['EMONC', 'VENOM_ANTIDOTES'], etaByZone: { URBAN_DENSE: 60, URBAN_STD: 50, OUTER: 15 }, status: 'OPEN' },
  { id: 'ikorodu_gen', name: 'Ikorodu General', fullName: 'Ikorodu General Hospital', location: 'Ikorodu', lga: 'ikorodu', type: 'BLS', capabilities: ['EMONC'], etaByZone: { URBAN_DENSE: 55, URBAN_STD: 45, OUTER: 12 }, status: 'OPEN' },
];

const COMPLAINT_PROTOCOLS: Record<string, Protocol> = {
  cardiac_arrest: { name: 'Cardiac Arrest / Unconscious', baseSeverity: 'ECHO', questions: [
    { id: 'is_breathing', text: 'Is the patient breathing at all?', type: 'yesno', critical: true },
    { id: 'has_pulse', text: 'Can you feel a pulse — neck or wrist?', type: 'yesno', critical: true },
    { id: 'agonal', text: 'Are they making gasping / gurgling sounds?', type: 'yesno' },
    { id: 'witnessed', text: 'Was the collapse witnessed?', type: 'yesno' },
    { id: 'aed_nearby', text: 'Is there an AED / defibrillator nearby?', type: 'yesno' },
  ]},
  choking: { name: 'Choking', baseSeverity: 'ECHO', questions: [
    { id: 'can_speak', text: 'Can the patient speak or make any sounds?', type: 'yesno', critical: true },
    { id: 'can_breathe', text: 'Can the patient breathe at all?', type: 'yesno', critical: true },
    { id: 'cyanosis', text: 'Is the patient turning blue around the lips or face?', type: 'yesno' },
    { id: 'conscious', text: 'Is the patient conscious?', type: 'yesno' },
  ]},
  drowning: { name: 'Drowning / Near-Drowning', baseSeverity: 'ECHO', questions: [
    { id: 'out_of_water', text: 'Is the patient out of the water?', type: 'yesno' },
    { id: 'breathing', text: 'Is the patient breathing?', type: 'yesno', critical: true },
    { id: 'conscious', text: 'Is the patient conscious?', type: 'yesno', critical: true },
    { id: 'time_submerged', text: 'How long were they submerged?', type: 'select', options: ['< 1 minute', '1–5 minutes', '5–10 minutes', '> 10 minutes', 'Unknown'] },
  ]},
  breathing_problems: { name: 'Breathing Problems', baseSeverity: 'DELTA', questions: [
    { id: 'speaking', text: 'Can the patient speak in full sentences?', type: 'yesno', critical: true },
    { id: 'lips_blue', text: 'Are the lips or fingernails turning blue?', type: 'yesno' },
    { id: 'stridor', text: 'Is there a high-pitched sound when breathing (stridor/wheeze)?', type: 'yesno' },
    { id: 'onset', text: 'How did the breathing problem start?', type: 'select', options: ['Sudden onset', 'Gradual — hours', 'Gradual — days', 'Chronic, worsening'] },
    { id: 'known_asthma', text: 'Does the patient have known asthma or COPD?', type: 'yesno' },
  ]},
  chest_pain: { name: 'Chest Pain', baseSeverity: 'DELTA', questions: [
    { id: 'radiating', text: 'Is the pain radiating to the arm, jaw, neck, or back?', type: 'yesno', critical: true },
    { id: 'sweating', text: 'Is the patient sweating or clammy?', type: 'yesno', critical: true },
    { id: 'sob', text: 'Is there shortness of breath alongside the pain?', type: 'yesno' },
    { id: 'severity_scale', text: 'Pain severity (1–10):', type: 'select', options: ['1–3 (mild)', '4–6 (moderate)', '7–10 (severe)'] },
    { id: 'duration', text: 'How long has the pain been present?', type: 'select', options: ['< 10 minutes', '10–30 minutes', '30 min – 2 hrs', '> 2 hours'] },
  ]},
  stroke: { name: 'Stroke / CVA', baseSeverity: 'DELTA', questions: [
    { id: 'face_droop', text: 'FACE: Is one side of the face drooping?', type: 'yesno', critical: true },
    { id: 'arm_weak', text: 'ARMS: Can the patient raise both arms equally?', type: 'yesno', critical: true },
    { id: 'speech', text: 'SPEECH: Is their speech slurred or confused?', type: 'yesno', critical: true },
    { id: 'symptom_time', text: 'TIME: When did symptoms first appear?', type: 'select', options: ['< 1 hour ago', '1–4 hours ago', '4–24 hours ago', '> 24 hours ago', 'Unknown — woke up with it'] },
    { id: 'conscious', text: 'Is the patient conscious?', type: 'yesno' },
  ]},
  allergic_reaction: { name: 'Allergic Reaction / Anaphylaxis', baseSeverity: 'DELTA', questions: [
    { id: 'throat_swelling', text: 'Is there throat/tongue swelling or difficulty swallowing?', type: 'yesno', critical: true },
    { id: 'wheeze', text: 'Is there wheezing or severe difficulty breathing?', type: 'yesno', critical: true },
    { id: 'rash', text: 'Is there a widespread rash or hives?', type: 'yesno' },
    { id: 'known_trigger', text: 'Was there a known exposure — food, insect, medication?', type: 'yesno' },
    { id: 'epipen', text: 'Does the patient have an EpiPen available?', type: 'yesno' },
  ]},
  hemorrhage: { name: 'Hemorrhage / Laceration', baseSeverity: 'DELTA', questions: [
    { id: 'spurting', text: 'Is blood spurting or pumping from the wound?', type: 'yesno', critical: true },
    { id: 'controllable', text: 'Is direct pressure controlling the bleeding?', type: 'yesno' },
    { id: 'pooling', text: 'Is blood pooling on the floor — more than a cupful?', type: 'yesno', critical: true },
    { id: 'location', text: 'Where is the wound?', type: 'select', options: ['Head/neck', 'Chest', 'Abdomen', 'Arm/hand', 'Leg/foot', 'Multiple sites'] },
    { id: 'pale_sweating', text: 'Is the patient pale, confused, or unconscious?', type: 'yesno' },
  ]},
  rta: { name: 'Okada / Keke / RTA', baseSeverity: 'CHARLIE', questions: [
    { id: 'ejected', text: 'Was anyone ejected from the vehicle?', type: 'yesno', critical: true },
    { id: 'conscious', text: 'Are all patients conscious?', type: 'yesno', critical: true },
    { id: 'mechanism', text: 'Collision mechanism:', type: 'select', options: ['Motorcycle low-speed fall', 'Motorcycle high-speed', 'Keke vs vehicle', 'Vehicle rollover', 'Pedestrian vs vehicle', 'Vehicle vs vehicle'] },
    { id: 'entrapment', text: 'Is anyone trapped / unable to move?', type: 'yesno' },
    { id: 'patient_count', text: 'How many patients?', type: 'select', options: ['1', '2', '3', '4–6 (MCI)', '7+ (MCI)'] },
  ]},
  seizures: { name: 'Convulsions / Seizures', baseSeverity: 'CHARLIE', questions: [
    { id: 'still_seizing', text: 'Is the patient still having a seizure NOW?', type: 'yesno', critical: true },
    { id: 'duration', text: 'How long has the seizure lasted?', type: 'select', options: ['< 2 minutes', '2–5 minutes', '5–10 minutes', '> 10 minutes', 'Multiple seizures'] },
    { id: 'breathing', text: 'Is the patient breathing?', type: 'yesno', critical: true },
    { id: 'known_epilepsy', text: 'Does the patient have known epilepsy?', type: 'yesno' },
    { id: 'post_ictal', text: 'Is the patient waking up slowly after the seizure?', type: 'yesno' },
  ]},
  childbirth: { name: 'Childbirth / Obstetric Emergency', baseSeverity: 'DELTA', questions: [
    { id: 'crowning', text: "Is the baby's head visible / crowning?", type: 'yesno', critical: true },
    { id: 'contractions', text: 'How frequent are contractions?', type: 'select', options: ['Every 1–2 min', 'Every 3–5 min', 'Every 5–10 min', 'Irregular', 'Continuous'] },
    { id: 'bleeding', text: 'Is there heavy vaginal bleeding?', type: 'yesno', critical: true },
    { id: 'weeks', text: 'Weeks of gestation:', type: 'select', options: ['< 28 weeks', '28–36 weeks', '37–40 weeks', '> 40 weeks', 'Unknown'] },
    { id: 'first_birth', text: "Is this the patient's first delivery?", type: 'yesno' },
  ]},
  co_poisoning: { name: 'Generator CO Poisoning', baseSeverity: 'CHARLIE', questions: [
    { id: 'unconscious', text: 'Is anyone unconscious or not responding?', type: 'yesno', critical: true },
    { id: 'out_of_area', text: 'Have all patients been moved away from the generator / outside?', type: 'yesno' },
    { id: 'patient_count', text: 'How many people are affected?', type: 'select', options: ['1', '2', '3', '4–6', '7+'] },
    { id: 'symptoms', text: 'Main symptoms?', type: 'select', options: ['Headache + nausea', 'Confusion + dizziness', 'Vomiting + chest pain', 'Unresponsive', 'Mixed symptoms'] },
    { id: 'duration', text: 'How long was exposure to the generator?', type: 'select', options: ['< 30 minutes', '30 min – 2 hrs', '> 2 hours', 'Unknown'] },
  ]},
  burns: { name: 'Burns / Electrocution', baseSeverity: 'CHARLIE', questions: [
    { id: 'electrocution', text: 'Was this an electrocution injury?', type: 'yesno', critical: true },
    { id: 'breathing', text: 'Is the patient breathing normally?', type: 'yesno' },
    { id: 'burn_area', text: 'Estimated body surface area burned:', type: 'select', options: ['< 5% (palm-sized)', '5–20%', '20–40%', '> 40%', 'Unknown'] },
    { id: 'face_involved', text: 'Is the face, airway, or hands involved?', type: 'yesno', critical: true },
    { id: 'chemical', text: 'Was this a chemical burn?', type: 'yesno' },
  ]},
  falls: { name: 'Falls', baseSeverity: 'BRAVO', questions: [
    { id: 'height', text: 'Estimated fall height:', type: 'select', options: ['< 1 metre (ground level)', '1–3 metres', '> 3 metres', 'Unknown'] },
    { id: 'head_injury', text: 'Did the patient hit their head?', type: 'yesno', critical: true },
    { id: 'conscious', text: 'Is the patient conscious?', type: 'yesno', critical: true },
    { id: 'move_limbs', text: 'Can the patient move all four limbs?', type: 'yesno' },
    { id: 'loc', text: 'Was there any loss of consciousness?', type: 'yesno' },
  ]},
  stab_gsw: { name: 'Stab / Gunshot / Penetrating Trauma', baseSeverity: 'DELTA', questions: [
    { id: 'location', text: 'Wound location:', type: 'select', options: ['Head/neck', 'Chest', 'Abdomen', 'Back', 'Limbs', 'Multiple'] },
    { id: 'breathing', text: 'Is the patient breathing normally?', type: 'yesno', critical: true },
    { id: 'conscious', text: 'Is the patient conscious?', type: 'yesno', critical: true },
    { id: 'active_bleed', text: 'Is there active uncontrolled bleeding?', type: 'yesno', critical: true },
    { id: 'type', text: 'Type of injury:', type: 'select', options: ['Stab wound', 'Gunshot wound', 'Impalement', 'Unknown penetrating'] },
  ]},
  flood_rescue: { name: 'Flood / Water Rescue', baseSeverity: 'DELTA', questions: [
    { id: 'in_water', text: 'Is anyone still in the water?', type: 'yesno', critical: true },
    { id: 'patient_count', text: 'How many people need rescue?', type: 'select', options: ['1', '2–3', '4–6', '7+'] },
    { id: 'conscious', text: 'Are the patients conscious?', type: 'yesno', critical: true },
    { id: 'rescue_capable', text: 'Is there anyone on scene capable of water rescue?', type: 'yesno' },
    { id: 'access', text: 'Can an ambulance access the location?', type: 'yesno' },
  ]},
  building_collapse: { name: 'Industrial / Building Collapse', baseSeverity: 'DELTA', questions: [
    { id: 'trapped', text: 'Are people trapped under debris?', type: 'yesno', critical: true },
    { id: 'count', text: 'How many people are involved?', type: 'select', options: ['1', '2–3', '4–6', '7–20', '20+'] },
    { id: 'still_collapsing', text: 'Is the structure still collapsing or unstable?', type: 'yesno' },
    { id: 'conscious', text: 'Are trapped patients conscious and communicating?', type: 'yesno', critical: true },
    { id: 'fire_service', text: 'Has Fire Service / LASEMA been notified?', type: 'yesno' },
  ]},
  _generic: { name: 'Assessment', baseSeverity: 'BRAVO', questions: [
    { id: 'conscious', text: 'Is the patient conscious and responsive?', type: 'yesno', critical: true },
    { id: 'breathing', text: 'Is the patient breathing normally?', type: 'yesno', critical: true },
    { id: 'worsening', text: 'Is the condition getting worse rapidly?', type: 'yesno' },
    { id: 'severity', text: 'Caller describes severity as:', type: 'select', options: ['Mild — patient seems stable', 'Moderate — patient distressed', 'Severe — condition alarming', 'Critical — life threatening'] },
  ]},
};

const PAI_SCRIPTS: Record<string, string[]> = {
  cardiac_arrest: [
    'Lay the patient flat on their back on a firm surface.',
    'Place the heel of your hand on the centre of their chest, between the nipples.',
    'Push down HARD and FAST — about 5–6 cm deep, 100–120 times per minute.',
    'Count out loud: "One-and-two-and-three…" to keep the right pace.',
    'Do NOT stop until our team arrives or the patient wakes up.',
    'If an AED is nearby, turn it on and follow its instructions immediately.',
  ],
  choking: [
    'If the patient can cough forcefully — encourage them to keep coughing.',
    'If they CANNOT cough or breathe: stand behind them, lean them forward.',
    'Give up to 5 firm blows between the shoulder blades with the heel of your hand.',
    'If that fails: wrap arms around their waist, make a fist just above the navel, thrust sharply inward and upward up to 5 times.',
    'Alternate back blows and abdominal thrusts until the object is cleared or they lose consciousness.',
    'If unconscious: begin CPR and look in their mouth before each breath.',
  ],
  hemorrhage: [
    'Apply FIRM, DIRECT PRESSURE to the wound using a clean cloth or clothing.',
    'Do NOT remove the cloth — add more on top if it soaks through.',
    'Press continuously — do not lift to check. Keep pressing hard.',
    'If the wound is on a limb and bleeding is life-threatening: apply a tourniquet 5–7 cm above the wound. Note the time.',
    'Lay the patient down and elevate the injured limb if possible.',
    'Keep the patient warm and talk to them calmly.',
  ],
  stroke: [
    'Do NOT give the patient anything to eat or drink.',
    'Note the EXACT time symptoms started — this is critical for treatment.',
    'Keep the patient still and calm — do not let them walk around.',
    'If unconscious but breathing: place in the recovery position (on their side).',
    'Do not give aspirin or any medication.',
    'Have someone meet our crew at the entrance to the building.',
  ],
  chest_pain: [
    'Have the patient sit or lie in the most comfortable position — usually sitting up.',
    'Loosen any tight clothing around the chest and neck.',
    'If the patient has prescribed GTN spray or tablets — they may use them now.',
    'Do NOT give aspirin unless instructed by our medical team.',
    'Keep the patient calm and still — no unnecessary movement.',
    'Stay on the line and tell me immediately if they lose consciousness.',
  ],
  breathing_problems: [
    'Help the patient sit upright — leaning forward slightly if it helps.',
    'Loosen any tight clothing.',
    'If they have an inhaler — help them use it now.',
    'Keep the area well-ventilated — open windows if safe.',
    'Stay calm and speak in a slow, reassuring voice.',
    'Call me back immediately if they stop breathing or go silent.',
  ],
  allergic_reaction: [
    'If there is an EpiPen: inject it into the outer thigh NOW — through clothing is fine.',
    'After EpiPen: lay patient flat with legs raised (unless breathing is easier sitting up).',
    'Do NOT let the patient stand or walk — this can cause sudden collapse.',
    'Remove the trigger if still present (food, sting, medication).',
    'A second EpiPen dose can be given after 5 minutes if no improvement.',
    'Even if they seem to improve — they MUST be seen by our team.',
  ],
  seizures: [
    'Clear all hard or sharp objects away from the patient.',
    'Do NOT restrain them or put anything in their mouth.',
    'Time the seizure — if it lasts more than 5 minutes, call us back immediately.',
    'After the seizure ends: roll them onto their side (recovery position).',
    'Stay with them — they may be confused and disoriented for several minutes.',
    'Do NOT give water or food until they are fully alert.',
  ],
  childbirth: [
    'Keep the patient calm and in a comfortable position.',
    'If the baby is crowning: do NOT push the head back. Support it gently as it emerges.',
    'Prepare clean towels or cloths to receive the baby.',
    'Once delivered: keep the baby warm and skin-to-skin with the mother.',
    'Do NOT cut the umbilical cord.',
    'Our crew will manage everything on arrival — just keep both patient and baby warm.',
  ],
  rta: [
    'Do NOT move the patient unless they are in immediate danger (fire, oncoming traffic).',
    'If moving is essential: support the head and neck and move as one unit.',
    'For severe bleeding: apply firm direct pressure with any clean material.',
    'If unconscious but breathing: leave in position found unless airway is blocked.',
    'Warn oncoming traffic — use hazard lights or have bystanders signal.',
    'Do not give anything by mouth.',
  ],
  co_poisoning: [
    'CRITICAL: Get everyone out of the building IMMEDIATELY. Turn off the generator.',
    'Move all patients to fresh air — outside, away from the building.',
    'Do NOT re-enter the building for any reason.',
    'If any patient is unconscious: begin CPR if they are not breathing.',
    'Call Lagos Fire Service if the generator is still running and cannot be safely switched off.',
    'Keep patients still and warm — oxygen is being brought to them.',
  ],
  _default: [
    'Keep the patient as calm and comfortable as possible.',
    'Do not move them unless there is immediate danger.',
    'Loosen any restrictive clothing.',
    'Do not give any food or water.',
    'Stay with the patient and keep them talking if conscious.',
    'Call us back immediately if their condition changes.',
  ],
};

const RESPONSE_TIMES: Record<SeverityCode, Record<ZoneCode, number>> = {
  ECHO:    { URBAN_DENSE: 10, URBAN_STD: 12, OUTER: 18 },
  DELTA:   { URBAN_DENSE: 15, URBAN_STD: 20, OUTER: 30 },
  CHARLIE: { URBAN_DENSE: 25, URBAN_STD: 35, OUTER: 50 },
  BRAVO:   { URBAN_DENSE: 40, URBAN_STD: 60, OUTER: 90 },
  ALPHA:   { URBAN_DENSE: 60, URBAN_STD: 90, OUTER: 120 },
  OMEGA:   { URBAN_DENSE: 0,  URBAN_STD: 0,  OUTER: 0 },
};

const SEVERITY_META: Record<SeverityCode, SeverityMeta> = {
  ECHO:    { color: '#FF3B30', bg: '#3D0A08', desc: 'Cardiac / Respiratory Arrest', resource: 'ALS + Rapid-Response Bike' },
  DELTA:   { color: '#FF9500', bg: '#3D2000', desc: 'Life-threatening, Time-Critical', resource: 'ALS Ambulance' },
  CHARLIE: { color: '#FFD60A', bg: '#332B00', desc: 'Serious, Potentially Life-Threatening', resource: 'BLS / ALS Ambulance' },
  BRAVO:   { color: '#30AAFF', bg: '#001633', desc: 'Urgent, Not Immediately Life-Threatening', resource: 'BLS Ambulance or Ambu-bike' },
  ALPHA:   { color: '#34C759', bg: '#0A2B12', desc: 'Non-Urgent Medical Need', resource: 'Ambu-bike' },
  OMEGA:   { color: '#8E8E93', bg: '#1C1C1E', desc: 'Advice / Referral Only', resource: 'Phone Advice + Self-transport' },
};

const CAPABILITY_LABELS: Record<string, string> = {
  LEVEL_1_TRAUMA: 'Level 1 Trauma',
  STROKE_UNIT: 'Stroke Unit',
  CATH_LAB: 'Cath Lab (PCI)',
  EMONC: 'Obstetric Emergency',
  PICU: 'Paediatric ICU',
  NICU: 'Neonatal ICU',
  BURN_CENTER: 'Burns Centre',
  PSYCH_EMERGENCY: 'Psych Emergency',
  DIALYSIS: 'Dialysis',
  VENOM_ANTIDOTES: 'Antivenom',
};

// ── Triage Engine ──────────────────────────────────────────────────

function escalate(sev: SeverityCode): SeverityCode {
  const order: SeverityCode[] = ['OMEGA', 'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
  const idx = order.indexOf(sev);
  return idx < order.length - 1 ? order[idx + 1] : sev;
}

function applyOverrides(severity: SeverityCode, patient: PatientData | null, complaint: string | null, reasons: string[]): SeverityCode {
  if (!patient) return severity;
  const order: SeverityCode[] = ['OMEGA', 'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
  const max = (a: SeverityCode, b: SeverityCode): SeverityCode => order.indexOf(a) > order.indexOf(b) ? a : b;
  if (patient.age !== '' && Number(patient.age) < 1) {
    severity = max(severity, 'CHARLIE');
    reasons.push('Override: Infant < 1 year — minimum CHARLIE');
  }
  if (patient.age !== '' && Number(patient.age) > 65) {
    if (complaint === 'falls') { severity = escalate(severity); reasons.push('Override: Elderly fall'); }
    if (complaint === 'chest_pain') { severity = 'DELTA'; reasons.push('Override: Elderly + chest pain'); }
  }
  if (patient.pregnant && (patient.gestationalAge === '' || Number(patient.gestationalAge) > 20)) {
    severity = max(severity, 'CHARLIE');
    reasons.push('Override: Pregnancy > 20 weeks — minimum CHARLIE');
    if (['bleeding', 'abdominal_pain', 'rta', 'falls', 'headache'].includes(complaint)) {
      severity = 'DELTA';
      reasons.push('Override: Pregnant + high-risk symptom → DELTA');
    }
  }
  if (patient.knownCardiac && ['chest_pain', 'breathing_problems', 'heart_problems'].includes(complaint)) {
    severity = 'DELTA';
    reasons.push('Override: Known cardiac + cardiac complaint');
  }
  if ((patient.knownDiabetic && patient.consciousness === 'PAIN') || patient.consciousness === 'UNRESPONSIVE') {
    severity = max(severity, 'CHARLIE');
    reasons.push('Override: Diabetic + altered consciousness');
  }
  if (patient.knownSeizure && complaint === 'seizures') {
    reasons.push('Known seizure disorder — compare to baseline');
  }
  return severity;
}

function recommendHospital(severity: SeverityCode, zone: ZoneCode, capabilityFilter: string | null): Hospital {
  let candidates: Hospital[] = HOSPITALS.filter(h => h.status === 'OPEN');
  if (capabilityFilter) {
    const filtered = candidates.filter(h => h.capabilities.includes(capabilityFilter));
    if (filtered.length > 0) candidates = filtered;
  }
  if (severity === 'ECHO' || severity === 'DELTA') {
    candidates = candidates.sort((a, b) => a.etaByZone[zone] - b.etaByZone[zone]);
  } else if (severity === 'CHARLIE' || severity === 'BRAVO') {
    candidates = candidates.sort((a, b) => {
      const scoreA = 0.5 * a.etaByZone[zone] - 0.25 * a.capabilities.length;
      const scoreB = 0.5 * b.etaByZone[zone] - 0.25 * b.capabilities.length;
      return scoreA - scoreB;
    });
  } else {
    candidates = candidates.filter(h => h.type === 'BLS').sort((a, b) => a.etaByZone[zone] - b.etaByZone[zone]);
  }
  return candidates[0] || HOSPITALS[0];
}

function buildResult(severity: SeverityCode, reason: string, incident: Incident, capabilityFilter: string | null = null): TriageResult {
  const zone = incident.zone || 'URBAN_STD';
  const responseTime = RESPONSE_TIMES[severity][zone];
  const hospital = recommendHospital(severity, zone, capabilityFilter);
  const pai = PAI_SCRIPTS[incident.complaint] || PAI_SCRIPTS._default;
  return { severity, escalationReasons: [reason], responseTimeMinutes: responseTime, hospital, pai, capabilityFilter };
}

function runTriage(incident: Incident): TriageResult {
  const { bigSix, complaint, protocolAnswers, patient, sceneSafety } = incident;
  if (sceneSafety === 'UNSAFE') {
    return { severity: 'DELTA', escalationReasons: ['Scene unsafe — police/fire co-response required. EMS stages nearby.'], coResponse: ['LSEMA', 'Nigeria Police Force'] };
  }
  if (bigSix.no_breathing || bigSix.no_pulse || bigSix.agonal_breathing) return buildResult('ECHO', 'Big Six: Cardiac/respiratory arrest — no breathing or no pulse', incident);
  if (bigSix.airway_compromised) return buildResult('ECHO', 'Big Six: Airway compromised', incident);
  if (bigSix.stroke_signs) return buildResult('DELTA', 'Big Six: Stroke signs positive (FAST)', incident, 'STROKE_UNIT');
  if (bigSix.cardiac_features) return buildResult('DELTA', 'Big Six: Chest pain with cardiac features', incident, 'CATH_LAB');
  if (bigSix.severe_hemorrhage) return buildResult('DELTA', 'Big Six: Severe uncontrolled hemorrhage', incident, 'LEVEL_1_TRAUMA');
  if (bigSix.anaphylaxis) return buildResult('DELTA', 'Big Six: Anaphylaxis signs', incident);

  const protocol = COMPLAINT_PROTOCOLS[complaint] || COMPLAINT_PROTOCOLS._generic;
  let severity: SeverityCode = protocol.baseSeverity;
  let reasons: string[] = [`Base severity from complaint: ${protocol.name}`];
  let capabilityFilter: string | null = null;

  if (complaint === 'cardiac_arrest') severity = 'ECHO';
  if (complaint === 'choking' && protocolAnswers.can_breathe === false) { severity = 'ECHO'; reasons.push('Complete airway obstruction'); }
  if (complaint === 'chest_pain') {
    if (protocolAnswers.radiating || protocolAnswers.sweating) { severity = 'DELTA'; capabilityFilter = 'CATH_LAB'; reasons.push('Cardiac features: radiation / diaphoresis'); }
  }
  if (complaint === 'stroke') {
    capabilityFilter = 'STROKE_UNIT';
    if (protocolAnswers.symptom_time === '< 1 hour ago' || protocolAnswers.symptom_time === '1–4 hours ago') reasons.push('Within thrombolysis window — stroke unit priority');
  }
  if (complaint === 'hemorrhage') {
    if (protocolAnswers.spurting || protocolAnswers.pooling) { severity = 'DELTA'; capabilityFilter = 'LEVEL_1_TRAUMA'; reasons.push('Arterial / major hemorrhage'); }
  }
  if (complaint === 'rta') {
    const highMechanism = ['Motorcycle high-speed', 'Keke vs vehicle', 'Vehicle rollover', 'Pedestrian vs vehicle'];
    if (highMechanism.includes(protocolAnswers.mechanism)) { severity = 'DELTA'; capabilityFilter = 'LEVEL_1_TRAUMA'; reasons.push(`High-energy mechanism: ${protocolAnswers.mechanism}`); }
    if (protocolAnswers.ejected) { severity = 'DELTA'; reasons.push('Ejection from vehicle'); }
    if (['4–6 (MCI)', '7+ (MCI)'].includes(protocolAnswers.patient_count)) reasons.push('MASS CASUALTY INCIDENT — trigger MCI protocol');
  }
  if (complaint === 'seizures') {
    const longDuration = ['5–10 minutes', '> 10 minutes', 'Multiple seizures'];
    if (longDuration.includes(protocolAnswers.duration)) { severity = 'DELTA'; reasons.push('Prolonged seizure / status epilepticus risk'); }
  }
  if (complaint === 'burns') {
    if (protocolAnswers.electrocution) { severity = 'DELTA'; reasons.push('Electrocution injury'); }
    if (protocolAnswers.face_involved) { severity = escalate(severity); reasons.push('Burns to face / airway'); }
    if (protocolAnswers.burn_area === '20–40%' || protocolAnswers.burn_area === '> 40%') { severity = 'DELTA'; capabilityFilter = 'BURN_CENTER'; reasons.push('Major burn area > 20%'); }
  }
  if (complaint === 'co_poisoning' && protocolAnswers.unconscious) { severity = 'DELTA'; reasons.push('CO poisoning with unconscious patient'); }
  if (complaint === 'childbirth') {
    if (protocolAnswers.crowning) { severity = 'ECHO'; reasons.push('Imminent delivery — crowning'); }
    if (protocolAnswers.bleeding) { severity = 'DELTA'; capabilityFilter = 'EMONC'; reasons.push('Heavy bleeding in labour'); }
  }
  if (complaint === 'flood_rescue' && protocolAnswers.in_water) { severity = 'DELTA'; reasons.push('Active water rescue required'); }
  if (complaint === 'building_collapse') {
    capabilityFilter = 'LEVEL_1_TRAUMA';
    if (['7–20', '20+'].includes(protocolAnswers.count)) reasons.push('MASS CASUALTY — trigger MCI protocol');
  }

  severity = applyOverrides(severity, patient, complaint, reasons);
  return buildResult(severity, reasons.join(' | '), incident, capabilityFilter);
}

// ── Utility ────────────────────────────────────────────────────────

function cx(...args: (string | false | null | undefined)[]): string { return args.filter(Boolean).join(' '); }

function useTimer(running: boolean): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const STEPS: StepId[] = ['caller', 'safety', 'complaint', 'bigsix', 'protocol', 'patient', 'result'];
const STEP_LABELS: string[] = ['Caller Info', 'Scene Safety', 'Chief Complaint', 'Critical Screen', 'Protocol', 'Patient Details', 'Dispatch'];

const BIG_SIX_QUESTIONS: BigSixQuestion[] = [
  { id: 'no_breathing',      text: 'Is the patient NOT breathing, or breathing abnormally (gasping / agonal)?',    severity: 'ECHO',  tag: 'CARDIAC / RESP ARREST' },
  { id: 'no_pulse',          text: 'Is there NO detectable pulse — checked at neck or wrist?',                     severity: 'ECHO',  tag: 'CARDIAC ARREST' },
  { id: 'agonal_breathing',  text: 'Are there irregular gasping breaths only — agonal pattern?',                   severity: 'ECHO',  tag: 'AGONAL — ARREST' },
  { id: 'airway_compromised',text: 'Is the airway compromised? (Choking, severe throat swelling, drowning)',       severity: 'ECHO',  tag: 'AIRWAY EMERGENCY' },
  { id: 'stroke_signs',      text: 'FAST positive? Face droop, Arm weakness, or Speech difficulty?',               severity: 'DELTA', tag: 'STROKE' },
  { id: 'cardiac_features',  text: 'Chest pain WITH cardiac features? (Radiating, sweating, shortness of breath)', severity: 'DELTA', tag: 'STEMI / ACS' },
  { id: 'severe_hemorrhage', text: "Severe hemorrhage? Spurting blood, bleeding that won't stop, or pooling?",     severity: 'DELTA', tag: 'MAJOR BLEED' },
  { id: 'anaphylaxis',       text: 'Anaphylaxis signs? Throat swelling, wheeze, rash after known trigger?',        severity: 'DELTA', tag: 'ANAPHYLAXIS' },
];

const COMPLAINT_CATEGORIES: string[] = ['Critical', 'Medical', 'Trauma', 'Obstetric', 'Psych'];

// ── Components ─────────────────────────────────────────────────────

function TopBar({ incidentId, timer, step, operatorId }: { incidentId: string; timer: string; step: StepId; operatorId: string }) {
  const stepIdx = STEPS.indexOf(step);
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="brand">LAGOS EMS</div>
        <div className="incident-id">{incidentId}</div>
        <div className="call-active"><span className="pulse-dot" />CALL ACTIVE</div>
      </div>
      <div className="topbar-progress">
        {STEPS.slice(0, -1).map((s, i) => (
          <div key={s} className={cx('progress-pip', i < stepIdx && 'done', i === stepIdx && 'active')} title={STEP_LABELS[i]} />
        ))}
      </div>
      <div className="topbar-right">
        <div className="timer">{timer}</div>
        <div className="operator">{operatorId}</div>
      </div>
    </div>
  );
}

function StepsSidebar({ step, resultSeverity }: { step: StepId; resultSeverity?: SeverityCode }) {
  const stepIdx = STEPS.indexOf(step);
  return (
    <aside className="sidebar">
      <div className="sidebar-label">STEPS</div>
      {STEPS.map((s, i) => {
        const done = i < stepIdx;
        const active = i === stepIdx;
        return (
          <div key={s} className={cx('step-item', done && 'done', active && 'active')}>
            <div className="step-icon">{done ? '✓' : active ? '▶' : String(i + 1)}</div>
            <span>{STEP_LABELS[i]}</span>
          </div>
        );
      })}
      {resultSeverity && (
        <div className="sidebar-severity" style={{ backgroundColor: SEVERITY_META[resultSeverity]?.bg, color: SEVERITY_META[resultSeverity]?.color, borderColor: SEVERITY_META[resultSeverity]?.color }}>
          {resultSeverity}
        </div>
      )}
    </aside>
  );
}

function IncidentSummary({ incident, result }: { incident: Incident; result: TriageResult | null }) {
  const lga = LGAS.find(l => l.id === incident.lgaId);
  const complaint = COMPLAINTS.find(c => c.id === incident.complaint);
  const sev = result?.severity;
  return (
    <aside className="summary">
      <div className="summary-label">INCIDENT SUMMARY</div>
      {incident.address && <div className="summary-row"><span className="s-key">Address</span><span className="s-val">{incident.address}</span></div>}
      {lga && <div className="summary-row"><span className="s-key">LGA</span><span className="s-val">{lga.label} <span className="zone-tag">{lga.zone.replace('_', ' ')}</span></span></div>}
      {incident.callerPhone && <div className="summary-row"><span className="s-key">Caller</span><span className="s-val">{incident.callerPhone}</span></div>}
      {incident.callerRelation && <div className="summary-row"><span className="s-key">Relation</span><span className="s-val">{incident.callerRelation}</span></div>}
      {incident.patientCount > 0 && <div className="summary-row"><span className="s-key">Patients</span><span className="s-val">{incident.patientCount}</span></div>}
      {incident.sceneSafety && <div className="summary-row"><span className="s-key">Scene</span><span className={cx('s-val', incident.sceneSafety === 'UNSAFE' && 'danger')}>{incident.sceneSafety}</span></div>}
      {complaint && <div className="summary-row"><span className="s-key">Complaint</span><span className="s-val">{complaint.label}</span></div>}
      {incident.patient?.age && <div className="summary-row"><span className="s-key">Patient</span><span className="s-val">{incident.patient.age}y {incident.patient.sex}</span></div>}
      {incident.patient?.consciousness && <div className="summary-row"><span className="s-key">AVPU</span><span className="s-val">{incident.patient.consciousness}</span></div>}
      {sev && (
        <div className="summary-severity" style={{ color: SEVERITY_META[sev].color, borderColor: SEVERITY_META[sev].color, backgroundColor: SEVERITY_META[sev].bg }}>
          <div className="sev-code">{sev}</div>
          <div className="sev-desc">{SEVERITY_META[sev].desc}</div>
        </div>
      )}
    </aside>
  );
}

// ── Step Screens ───────────────────────────────────────────────────

function CallerStep({ incident, onChange, onNext }: { incident: Incident; onChange: (updates: Partial<Incident>) => void; onNext: () => void }) {
  const [form, setForm] = useState({
    callerPhone: incident.callerPhone || '',
    callerName: incident.callerName || '',
    callerRelation: incident.callerRelation || '',
    address: incident.address || '',
    lgaId: incident.lgaId || '',
    patientCount: incident.patientCount || 1,
  });
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.callerPhone && form.address && form.lgaId;
  const submit = () => { if (valid) { onChange(form); onNext(); } };
  return (
    <div className="step-content">
      <h2 className="step-title">Caller Information</h2>
      <p className="step-sub">Record the incident location and caller details before proceeding.</p>
      <div className="form-grid">
        <div className="field">
          <label>Caller Phone *</label>
          <input value={form.callerPhone} onChange={e => set('callerPhone', e.target.value)} placeholder="080XXXXXXXX" className="inp" onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
        </div>
        <div className="field">
          <label>Caller Name</label>
          <input value={form.callerName} onChange={e => set('callerName', e.target.value)} placeholder="Full name" className="inp" />
        </div>
        <div className="field">
          <label>Relationship to Patient</label>
          <select value={form.callerRelation} onChange={e => set('callerRelation', e.target.value)} className="inp">
            <option value="">Select…</option>
            {['Patient themselves', 'Bystander', 'Family member', 'Friend', 'Colleague', 'Unknown third party', 'Security / Facility staff'].map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Number of Patients *</label>
          <select value={form.patientCount} onChange={e => set('patientCount', Number(e.target.value))} className="inp">
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}{n >= 4 ? ' (consider MCI)' : ''}</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Incident Address *</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address, landmark" className="inp" />
        </div>
        <div className="field full">
          <label>LGA *</label>
          <select value={form.lgaId} onChange={e => set('lgaId', e.target.value)} className="inp">
            <option value="">Select LGA…</option>
            {LGAS.map(l => <option key={l.id} value={l.id}>{l.label} — {l.zone.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <div className="step-actions">
        <button className="btn-primary" onClick={submit} disabled={!valid}>Continue →</button>
      </div>
    </div>
  );
}

function SafetyStep({ incident, onChange, onNext }: { incident: Incident; onChange: (updates: Partial<Incident>) => void; onNext: () => void }) {
  const [safety, setSafety] = useState<SceneSafety | null>(incident.sceneSafety || null);
  const [hazards, setHazards] = useState<string[]>([]);
  const HAZARDS: string[] = ['Active fire', 'Active shooting / violence', 'Flood water', 'Building collapse risk', 'Electrical hazard', 'Chemical/gas exposure', 'Mob / crowd danger'];
  const toggleHazard = (h: string) => setHazards(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);
  const submit = (val: SceneSafety) => {
    setSafety(val);
    onChange({ sceneSafety: val, hazards: val === 'UNSAFE' ? hazards : [] });
    onNext();
  };
  return (
    <div className="step-content">
      <h2 className="step-title">Scene Safety Assessment</h2>
      <p className="step-sub">Assess scene safety before dispatching. EMS does not enter unsafe scenes.</p>
      <div className="safety-grid">
        {['SAFE', 'UNSAFE', 'UNKNOWN'].map((s: string) => (
          <button key={s} className={cx('safety-btn', s.toLowerCase(), safety === s && 'selected')} onClick={() => submit(s as SceneSafety)}>
            <span className="safety-icon">{s === 'SAFE' ? '✓' : s === 'UNSAFE' ? '⚠' : '?'}</span>
            <span className="safety-label">{s}</span>
            <span className="safety-desc">
              {s === 'SAFE' && 'Scene is secure, no known hazards'}
              {s === 'UNSAFE' && 'Active hazard — EMS stages; co-response required'}
              {s === 'UNKNOWN' && 'Cannot confirm — proceed with caution'}
            </span>
          </button>
        ))}
      </div>
      {safety === 'UNSAFE' && (
        <div className="hazards-section">
          <div className="hazards-label">Active Hazards (select all that apply):</div>
          <div className="hazards-grid">
            {HAZARDS.map(h => (
              <button key={h} className={cx('hazard-chip', hazards.includes(h) && 'active')} onClick={() => toggleHazard(h)}>{h}</button>
            ))}
          </div>
          <div className="unsafe-notice">CO-RESPONSE REQUIRED — Police/Fire notified. EMS stages at safe perimeter.</div>
        </div>
      )}
    </div>
  );
}

function ComplaintStep({ incident, onChange, onNext }: { incident: Incident; onChange: (updates: Partial<Incident>) => void; onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>(incident.complaint || null);
  const [search, setSearch] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const categories = ['All', ...COMPLAINT_CATEGORIES];
  const filtered = COMPLAINTS.filter(c => {
    const matchSearch = c.label.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || c.category === activeCategory;
    return matchSearch && matchCat;
  });
  const submit = (id: string) => {
    setSelected(id);
    onChange({ complaint: id });
    setTimeout(onNext, 180);
  };
  return (
    <div className="step-content">
      <h2 className="step-title">Chief Complaint</h2>
      <p className="step-sub">Select the primary presenting complaint. This determines the interrogation protocol.</p>
      <div className="complaint-controls">
        <input className="inp search-inp" placeholder="Search complaints…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        <div className="cat-tabs">
          {categories.map(c => <button key={c} className={cx('cat-tab', activeCategory === c && 'active')} onClick={() => setActiveCategory(c)}>{c}</button>)}
        </div>
      </div>
      <div className="complaint-grid">
        {filtered.map(c => (
          <button key={c.id} className={cx('complaint-btn', selected === c.id && 'selected', c.category === 'Critical' && 'critical', c.lagosSpecific && 'lagos')} onClick={() => submit(c.id)}>
            <span className="complaint-cat">{c.category}</span>
            <span className="complaint-name">{c.label}</span>
            {c.lagosSpecific && <span className="lagos-badge">LGS</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function BigSixButton({ label, sub, color, onPress, keyBind }: { label: string; sub: string; color: string; onPress: () => void; keyBind: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key.toLowerCase() === keyBind) onPress(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onPress, keyBind]);
  return (
    <button className="bigsix-yn" style={{ '--btn-color': color }} onClick={onPress}>
      <span className="yn-label">{label}</span>
      <span className="yn-sub">{sub}</span>
      <kbd className="yn-key">{keyBind.toUpperCase()}</kbd>
    </button>
  );
}

function BigSixStep({ incident, onChange, onNext, onEarlyDispatch }: {
  incident: Incident;
  onChange: (updates: Partial<Incident>) => void;
  onNext: () => void;
  onEarlyDispatch: (bigSix: Record<string, boolean>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>(incident.bigSix || {});
  const [currentQ, setCurrentQ] = useState<number>(0);
  const answer = (id: string, val: boolean) => {
    const updated = { ...answers, [id]: val };
    setAnswers(updated);
    onChange({ bigSix: updated });
    if (val === true) { onEarlyDispatch(updated); return; }
    if (currentQ < BIG_SIX_QUESTIONS.length - 1) setCurrentQ(i => i + 1);
    else onNext();
  };
  const q = BIG_SIX_QUESTIONS[currentQ];
  const progress = (currentQ / BIG_SIX_QUESTIONS.length) * 100;
  return (
    <div className="step-content bigsix">
      <div className="bigsix-header">
        <h2 className="step-title">Critical Symptom Screen</h2>
        <p className="step-sub">8 rapid YES/NO questions. A YES triggers immediate severity assignment. Press <kbd>Y</kbd> or <kbd>N</kbd>.</p>
        <div className="bigsix-progress-bar"><div style={{ width: `${progress}%` }} /></div>
        <div className="bigsix-counter">{currentQ + 1} of {BIG_SIX_QUESTIONS.length}</div>
      </div>
      <div className="bigsix-card">
        <div className="bigsix-tag" style={{ color: q.severity === 'ECHO' ? '#FF3B30' : '#FF9500' }}>
          {q.severity === 'ECHO' ? '⬛ ECHO TRIGGER' : '🟧 DELTA TRIGGER'} — {q.tag}
        </div>
        <div className="bigsix-question">{q.text}</div>
        <div className="bigsix-actions">
          <BigSixButton label="YES" sub="Patient has this sign" color="#FF3B30" onPress={() => answer(q.id, true)} keyBind="y" />
          <BigSixButton label="NO" sub="Sign not present" color="#34C759" onPress={() => answer(q.id, false)} keyBind="n" />
        </div>
      </div>
      <div className="bigsix-answered">
        {BIG_SIX_QUESTIONS.slice(0, currentQ).map(aq => (
          <div key={aq.id} className="bigsix-done-item">
            <span className="bigsix-done-no">✗ NO</span>{aq.tag}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtocolYN({ label, color, onPress, keyBind }: { label: string; color: string; onPress: () => void; keyBind: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key.toLowerCase() === keyBind) onPress(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onPress, keyBind]);
  return (
    <button className="proto-yn-btn" style={{ '--btn-color': color }} onClick={onPress}>
      {label} <kbd>{keyBind.toUpperCase()}</kbd>
    </button>
  );
}

function ProtocolStep({ incident, onChange, onNext }: { incident: Incident; onChange: (updates: Partial<Incident>) => void; onNext: () => void }) {
  const protocol = COMPLAINT_PROTOCOLS[incident.complaint ?? '_generic'] || COMPLAINT_PROTOCOLS._generic;
  const [answers, setAnswers] = useState<Record<string, boolean | string>>(incident.protocolAnswers || {});
  const [idx, setIdx] = useState<number>(0);
  const questions = protocol.questions;
  const q = questions[idx];
  const setAns = (id: string, val: boolean | string) => {
    const updated = { ...answers, [id]: val };
    setAnswers(updated);
    onChange({ protocolAnswers: updated });
    if (idx < questions.length - 1) setIdx(i => i + 1);
    else onNext();
  };
  return (
    <div className="step-content protocol">
      <h2 className="step-title">{protocol.name}</h2>
      <p className="step-sub">Complaint-specific interrogation — {questions.length} questions. Press <kbd>Y</kbd> / <kbd>N</kbd> for yes/no.</p>
      <div className="proto-progress">
        {questions.map((_, i) => <div key={i} className={cx('proto-pip', i < idx && 'done', i === idx && 'active')} />)}
      </div>
      <div className="proto-card">
        {q.critical && <div className="proto-critical">CRITICAL QUESTION</div>}
        <div className="proto-q-num">Q{idx + 1} / {questions.length}</div>
        <div className="proto-question">{q.text}</div>
        {q.type === 'yesno' ? (
          <div className="proto-yn-row">
            <ProtocolYN label="YES" color="#FF3B30" onPress={() => setAns(q.id, true)} keyBind="y" />
            <ProtocolYN label="NO" color="#34C759" onPress={() => setAns(q.id, false)} keyBind="n" />
          </div>
        ) : (
          <div className="proto-options">
            {q.options.map(opt => (
              <button key={opt} className={cx('proto-opt', answers[q.id] === opt && 'selected')} onClick={() => setAns(q.id, opt)}>{opt}</button>
            ))}
          </div>
        )}
      </div>
      <div className="proto-answered">
        {questions.slice(0, idx).map(aq => (
          <div key={aq.id} className="proto-done-item">
            <span className="proto-done-label">{aq.text}</span>
            <span className="proto-done-val">{String(answers[aq.id]).toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientStep({ incident, onChange, onNext }: { incident: Incident; onChange: (updates: Partial<Incident>) => void; onNext: () => void }) {
  const [form, setForm] = useState<PatientData>(incident.patient || {
    age: '', sex: 'UNKNOWN', pregnant: false, gestationalAge: '',
    consciousness: 'ALERT', breathing: 'NORMAL',
    knownCardiac: false, knownDiabetic: false, knownSeizure: false, comorbidities: '',
  });
  const set = (k: keyof PatientData, v: PatientData[keyof PatientData]) => setForm(f => ({ ...f, [k]: v }));
  const submit = () => { onChange({ patient: form }); onNext(); };
  return (
    <div className="step-content">
      <h2 className="step-title">Patient Details & Risk Factors</h2>
      <p className="step-sub">These factors feed the override matrix and can escalate severity.</p>
      <div className="patient-grid">
        <div className="field">
          <label>Age (years)</label>
          <input type="number" value={form.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 45" className="inp" min={0} max={120} />
        </div>
        <div className="field">
          <label>Sex</label>
          <select value={form.sex} onChange={e => set('sex', e.target.value)} className="inp">
            {['UNKNOWN', 'M', 'F'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Level of Consciousness (AVPU)</label>
          <div className="avpu-row">
            {[['ALERT','A — Alert'],['VOICE','V — Responds to Voice'],['PAIN','P — Responds to Pain'],['UNRESPONSIVE','U — Unresponsive']].map(([val, label]) => (
              <button key={val} className={cx('avpu-btn', form.consciousness === val && 'active')} onClick={() => set('consciousness', val)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="field full">
          <label>Breathing</label>
          <div className="avpu-row">
            {[['NORMAL','Normal'],['LABOURED','Laboured'],['AGONAL','Agonal / Gasping'],['ABSENT','Absent']].map(([val, label]) => (
              <button key={val} className={cx('avpu-btn', form.breathing === val && 'active', (val === 'AGONAL' || val === 'ABSENT') && 'danger-btn')} onClick={() => set('breathing', val)}>{label}</button>
            ))}
          </div>
        </div>
        {form.sex === 'F' && (
          <div className="field pregnant-row">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.pregnant} onChange={e => set('pregnant', e.target.checked)} />
              Patient is pregnant
            </label>
            {form.pregnant && (
              <input type="number" value={form.gestationalAge as number} onChange={e => set('gestationalAge', e.target.value)} placeholder="Gestational age (weeks)" className="inp" min={1} max={42} />
            )}
          </div>
        )}
        <div className="field full">
          <label>Known Comorbidities</label>
          <div className="comorbidity-row">
            {([['knownCardiac','Cardiac disease'],['knownDiabetic','Diabetes'],['knownSeizure','Seizure disorder']] as [keyof PatientData, string][]).map(([key, label]) => (
              <label key={key} className={cx('comorbid-chip', form[key] && 'active')}>
                <input type="checkbox" checked={form[key] as boolean} onChange={e => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="field full">
          <label>Additional Notes</label>
          <input value={form.comorbidities} onChange={e => set('comorbidities', e.target.value)} placeholder="Any other relevant medical history…" className="inp" />
        </div>
      </div>
      <div className="step-actions">
        <button className="btn-primary" onClick={submit}>Calculate Triage →</button>
      </div>
    </div>
  );
}

function ResourceRow({ type, unit, detail, color }: { type: string; unit: string; detail: string; color: string }) {
  return (
    <div className="resource-row">
      <span className="res-type" style={{ color }}>{type}</span>
      <div className="res-info">
        <span className="res-unit">{unit}</span>
        <span className="res-detail">{detail}</span>
      </div>
    </div>
  );
}

function ResultStep({ result, incident, onNewCall }: { result: TriageResult | null; incident: Incident; onNewCall: () => void }) {
  const [paiExpanded, setPaiExpanded] = useState<boolean>(true);
  const [dispatched, setDispatched] = useState<boolean>(false);
  const [dispatchTime, setDispatchTime] = useState<string | null>(null);
  const sev = result?.severity;
  const meta = SEVERITY_META[sev] || {};
  const lga = LGAS.find(l => l.id === incident.lgaId);
  const complaint = COMPLAINTS.find(c => c.id === incident.complaint);
  const hospital = result?.hospital;
  const isMCI = incident.patientCount >= 4;

  const handleDispatch = () => {
    setDispatched(true);
    setDispatchTime(new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  return (
    <div className="step-content result">
      {isMCI && <div className="mci-banner">⚠ MASS CASUALTY INCIDENT — {incident.patientCount} patients. Activate MCI protocol. Request mutual aid.</div>}
      {incident.sceneSafety === 'UNSAFE' && <div className="unsafe-banner">⚠ UNSAFE SCENE — Co-response required. EMS stages at perimeter.</div>}

      <div className="result-top">
        <div className="sev-badge-large" style={{ backgroundColor: meta.bg, borderColor: meta.color, color: meta.color }}>
          <div className="sev-code-large">{sev}</div>
          <div className="sev-desc-large">{meta.desc}</div>
        </div>
        <div className="result-meta">
          <div className="result-meta-row"><span className="rm-key">Complaint</span><span className="rm-val">{complaint?.label}</span></div>
          <div className="result-meta-row"><span className="rm-key">Location</span><span className="rm-val">{incident.address}, {lga?.label}</span></div>
          <div className="result-meta-row"><span className="rm-key">Zone</span><span className="rm-val">{lga?.zone?.replace('_', ' ')}</span></div>
          <div className="result-meta-row"><span className="rm-key">Target Response</span><span className="rm-val response-time" style={{ color: meta.color }}>{result?.responseTimeMinutes} min</span></div>
          <div className="result-meta-row"><span className="rm-key">Resource</span><span className="rm-val">{meta.resource}</span></div>
        </div>
      </div>

      {result?.escalationReasons?.length > 0 && (
        <div className="escalation-reasons">
          <div className="er-label">TRIAGE RATIONALE</div>
          {result.escalationReasons.map((r, i) => <div key={i} className="er-item">{r}</div>)}
        </div>
      )}

      <div className="result-cards">
        <div className="result-card">
          <div className="rc-title">RESOURCE ALLOCATION</div>
          {(sev === 'ECHO' || sev === 'DELTA') && (
            <>
              <ResourceRow type="PRIMARY" unit="ALS Ambulance" detail="Nearest available unit" color={meta.color} />
              {sev === 'ECHO' && <ResourceRow type="CO-RESPONSE" unit="Ambu-bike (CPR first-on-scene)" detail="Arrives ahead of ambulance" color="#FF9500" />}
              {sev === 'DELTA' && <ResourceRow type="CO-RESPONSE" unit="Ambu-bike (if ETA > 10 min)" detail="Bridge until ALS arrives" color="#FF9500" />}
            </>
          )}
          {sev === 'CHARLIE' && <ResourceRow type="PRIMARY" unit="ALS Ambulance (preferred)" detail="BLS acceptable if ALS ETA > 15 min" color={meta.color} />}
          {sev === 'BRAVO'   && <ResourceRow type="PRIMARY" unit="BLS Ambulance" detail="Ambu-bike if non-trauma, single patient, faster ETA" color={meta.color} />}
          {sev === 'ALPHA'   && <ResourceRow type="PRIMARY" unit="Ambu-bike" detail="Optimal for Lagos traffic penetration" color={meta.color} />}
          {sev === 'OMEGA'   && <ResourceRow type="ACTION" unit="Phone Advice + PAI" detail="Schedule 2-hour follow-up call" color={meta.color} />}
        </div>

        {hospital && sev !== 'OMEGA' && (
          <div className="result-card">
            <div className="rc-title">RECOMMENDED HOSPITAL</div>
            <div className="hospital-name">{hospital.name}</div>
            <div className="hospital-full">{hospital.fullName}</div>
            <div className="hospital-location">{hospital.location}</div>
            <div className="hospital-eta">Est. ETA: <strong style={{ color: meta.color }}>{hospital.etaByZone[lga?.zone || 'URBAN_STD']} min</strong></div>
            <div className="hospital-caps">
              {hospital.capabilities.map(cap => (
                <span key={cap} className={cx('cap-tag', result?.capabilityFilter === cap && 'cap-match')}>
                  {CAPABILITY_LABELS[cap] || cap}
                </span>
              ))}
            </div>
            <div className="hospital-status"><span className="status-open">● OPEN — RECEIVING</span></div>
          </div>
        )}
      </div>

      {result?.pai?.length > 0 && (
        <div className="pai-section">
          <button className="pai-toggle" onClick={() => setPaiExpanded(e => !e)}>
            PRE-ARRIVAL INSTRUCTIONS {paiExpanded ? '▲' : '▼'}
          </button>
          {paiExpanded && (
            <div className="pai-list">
              <p className="pai-intro">Read these instructions to the caller while the unit is en route:</p>
              {result.pai.map((item, i) => (
                <div key={i} className="pai-item">
                  <span className="pai-num">{i + 1}</span>
                  <span className="pai-text">{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!dispatched ? (
        <div className="dispatch-row">
          <button className="dispatch-btn" style={{ backgroundColor: meta.color }} onClick={handleDispatch}>
            DISPATCH — {sev}
          </button>
          <button className="new-call-ghost" onClick={onNewCall}>New Call</button>
        </div>
      ) : (
        <div className="dispatched-confirmation" style={{ borderColor: meta.color }}>
          <div className="dispatched-icon" style={{ color: meta.color }}>✓</div>
          <div className="dispatched-text">
            <strong>DISPATCHED at {dispatchTime}</strong>
            <span>Unit assigned — {sev} response. Target: {result?.responseTimeMinutes} min.</span>
          </div>
          <button className="new-call-ghost" onClick={onNewCall}>New Call</button>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────

const SAMPLE_CALLS: SampleCall[] = [
  { id: 'INC-0841', complaint: 'Chest Pain', severity: 'DELTA', location: 'Ikeja', time: '08:12', status: 'EN ROUTE' },
  { id: 'INC-0839', complaint: 'RTA — Motorcycle', severity: 'CHARLIE', location: 'Oshodi', time: '08:05', status: 'ON SCENE' },
  { id: 'INC-0836', complaint: 'Breathing Problems', severity: 'BRAVO', location: 'Surulere', time: '07:58', status: 'HOSPITAL' },
  { id: 'INC-0833', complaint: 'Abdominal Pain', severity: 'ALPHA', location: 'Yaba', time: '07:44', status: 'CLOSED' },
];

function Dashboard({ onNewCall }: { onNewCall: () => void }) {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Lagos State Ambulance Service</h1>
          <p className="dashboard-sub">Emergency Dispatch Console · {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button className="new-call-btn" onClick={onNewCall}>+ NEW CALL</button>
      </div>
      <div className="dashboard-stats">
        {[['4','Active Calls'],['2','Units En Route'],['1','On Scene'],['12','Closed Today']].map(([val, label]) => (
          <div className="stat-card" key={label}><div className="stat-val">{val}</div><div className="stat-label">{label}</div></div>
        ))}
      </div>
      <div className="calls-table-wrap">
        <div className="calls-table-label">ACTIVE & RECENT CALLS</div>
        <table className="calls-table">
          <thead><tr><th>Incident</th><th>Complaint</th><th>Severity</th><th>Location</th><th>Time</th><th>Status</th></tr></thead>
          <tbody>
            {SAMPLE_CALLS.map(c => (
              <tr key={c.id}>
                <td className="call-id">{c.id}</td>
                <td>{c.complaint}</td>
                <td><span className="sev-pill" style={{ color: SEVERITY_META[c.severity]?.color, borderColor: SEVERITY_META[c.severity]?.color }}>{c.severity}</span></td>
                <td>{c.location}</td>
                <td>{c.time}</td>
                <td><span className={cx('status-pill', c.status.toLowerCase().replace(' ', '-'))}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────

function makeIncidentId() {
  return 'INC-' + String(Math.floor(Math.random() * 9000) + 1000);
}

const BLANK_INCIDENT = (): Incident => ({
  callerPhone: '', callerName: '', callerRelation: '', address: '',
  lgaId: '', patientCount: 1, sceneSafety: null, complaint: null,
  bigSix: {}, protocolAnswers: {}, patient: null, zone: 'URBAN_STD',
});

export default function App() {
  const [screen, setScreen] = useState<'dashboard' | 'intake'>('dashboard');
  const [step, setStep] = useState<StepId>('caller');
  const [incidentId] = useState<string>(makeIncidentId);
  const [incident, setIncident] = useState<Incident>(BLANK_INCIDENT);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const timer = useTimer(timerRunning);

  // Inject global CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = globalCSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const updateIncident = useCallback((updates: Partial<Incident>) => {
    setIncident(prev => {
      const next = { ...prev, ...updates };
      if (updates.lgaId) {
        const lga = LGAS.find(l => l.id === updates.lgaId);
        next.zone = lga?.zone || 'URBAN_STD';
      }
      return next;
    });
  }, []);

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const handleNewCall = () => {
    setScreen('intake');
    setStep('caller');
    setResult(null);
    setTimerRunning(true);
    setIncident(BLANK_INCIDENT());
  };

  const handleEarlyDispatch = (bigSix: Record<string, boolean>) => {
    const updatedIncident = { ...incident, bigSix };
    const r = runTriage(updatedIncident);
    setResult(r);
    setStep('result');
  };

  const handlePatientSubmit = (patientData: Partial<Incident>) => {
    const updatedIncident = { ...incident, ...patientData };
    updateIncident(patientData);
    const r = runTriage(updatedIncident);
    setResult(r);
  };

  const handleReturnDashboard = () => {
    setScreen('dashboard');
    setTimerRunning(false);
  };

  const stepComponents: Record<StepId, JSX.Element> = {
    caller:    <CallerStep incident={incident} onChange={updateIncident} onNext={goNext} />,
    safety:    <SafetyStep incident={incident} onChange={updateIncident} onNext={goNext} />,
    complaint: <ComplaintStep incident={incident} onChange={updateIncident} onNext={goNext} />,
    bigsix:    <BigSixStep incident={incident} onChange={updateIncident} onNext={goNext} onEarlyDispatch={handleEarlyDispatch} />,
    protocol:  <ProtocolStep incident={incident} onChange={updateIncident} onNext={goNext} />,
    patient:   <PatientStep incident={incident} onChange={(d) => { updateIncident(d); handlePatientSubmit(d); }} onNext={goNext} />,
    result:    <ResultStep result={result} incident={incident} onNewCall={handleReturnDashboard} />,
  };

  if (screen === 'dashboard') {
    return (
      <div className="app">
        <div className="topbar">
          <div className="topbar-left">
            <div className="brand">LAGOS EMS</div>
            <div className="dashboard-mode">DISPATCH CONSOLE</div>
          </div>
          <div className="topbar-right">
            <div className="operator">OPR-07 · Adaeze Okonkwo</div>
            <div className="timer">{new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <Dashboard onNewCall={handleNewCall} />
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar incidentId={incidentId} timer={timer} step={step} operatorId="OPR-07" />
      <div className="app-body">
        <StepsSidebar step={step} resultSeverity={result?.severity} />
        <main className="main-panel">{stepComponents[step]}</main>
        <IncidentSummary incident={incident} result={result} />
      </div>
    </div>
  );
}