// DOM Elements
const bitWidthEl = document.getElementById('bitWidth');
const multiplicandEl = document.getElementById('multiplicand');
const multiplierEl = document.getElementById('multiplier');
const rangeHintM = document.getElementById('rangeHintM');
const rangeHintQ = document.getElementById('rangeHintQ');
const speedRangeEl = document.getElementById('speedRange');
const speedLabelEl = document.getElementById('speedLabel');
const errorBannerEl = document.getElementById('errorBanner');

const initBtn = document.getElementById('initBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const autoBtn = document.getElementById('autoBtn');
const exportBtn = document.getElementById('exportBtn');

const regMEl = document.getElementById('regM');
const decMEl = document.getElementById('decM');
const regNegMEl = document.getElementById('regNegM');
const decNegMEl = document.getElementById('decNegM');
const regSCEl = document.getElementById('regSC');

const bitsAEl = document.getElementById('bitsA');
const bitsQEl = document.getElementById('bitsQ');
const bitsQ1El = document.getElementById('bitsQ1');
const decisionPillEl = document.getElementById('decisionPill');

const resultBannerEl = document.getElementById('resultBanner');
const finalBinaryEl = document.getElementById('finalBinary');
const finalDecimalEl = document.getElementById('finalDecimal');
const finalFormulaEl = document.getElementById('finalFormula');

const traceBodyEl = document.getElementById('traceBody');
const cycleCounterEl = document.getElementById('cycleCounter');

// Simulation State
let traceSteps = [];
let currentStepIndex = 0;
let autoPlayTimer = null;
let simMeta = { n: 4, mDec: 0, qDec: 0, mBin: '', negMBin: '' };

// Two's Complement Conversion Helpers
function toTwosComplement(num, bits) {
  const mask = (1 << bits) - 1;
  let val = num < 0 ? ((1 << bits) + num) : num;
  // Handle 16-bit properly in JS bitwise
  if (bits === 16) {
    val = num < 0 ? (65536 + num) : num;
    return val.toString(2).padStart(16, '0').slice(-16);
  }
  return (val & mask).toString(2).padStart(bits, '0');
}

function fromTwosComplement(binStr) {
  const bits = binStr.length;
  const unsigned = parseInt(binStr, 2);
  const signBit = 1 << (bits - 1);
  if (bits === 32) {
    return unsigned | 0;
  }
  return (unsigned & signBit) ? unsigned - Math.pow(2, bits) : unsigned;
}

function binaryAdd(binA, binB) {
  const n = binA.length;
  let carry = 0;
  let res = '';
  for (let i = n - 1; i >= 0; i--) {
    const sum = Number(binA[i]) + Number(binB[i]) + carry;
    res = (sum % 2) + res;
    carry = Math.floor(sum / 2);
  }
  return res;
}

function arithmeticRightShift(A, Q, Q1) {
  const msbA = A[0];
  const lsbA = A[A.length - 1];
  const lsbQ = Q[Q.length - 1];

  const newA = msbA + A.slice(0, -1);
  const newQ = lsbA + Q.slice(0, -1);
  const newQ1 = lsbQ;

  return { A: newA, Q: newQ, Q1: newQ1 };
}

// Update Input Hints when Bit-Width Changes
function updateRangeHints() {
  const n = parseInt(bitWidthEl.value, 10);
  const minVal = -Math.pow(2, n - 1);
  const maxVal = Math.pow(2, n - 1) - 1;
  rangeHintM.textContent = `Range: ${minVal} to ${maxVal}`;
  rangeHintQ.textContent = `Range: ${minVal} to ${maxVal}`;
}

// Precompute Complete Simulation Trace
function generateTrace(n, mDec, qDec) {
  const mBin = toTwosComplement(mDec, n);
  const negMBin = toTwosComplement(-mDec, n);

  let A = '0'.repeat(n);
  let Q = toTwosComplement(qDec, n);
  let Q1 = '0';
  let SC = n;

  const steps = [];
  steps.push({
    cycle: 0,
    pair: `${Q[n - 1]}${Q1}`,
    opType: 'init',
    opText: 'Initialize Registers (A ← 0, Q ← Multiplier, Q₋₁ ← 0)',
    A,
    Q,
    Q1,
    SC
  });

  for (let cycle = 1; cycle <= n; cycle++) {
    const q0 = Q[n - 1];
    const pair = `${q0}${Q1}`;
    let opType = 'shift';
    let opText = '';

    if (pair === '01') {
      A = binaryAdd(A, mBin);
      opType = 'add';
      opText = 'Q₀Q₋₁ = 01 → A ← A + M, then ASHR';
    } else if (pair === '10') {
      A = binaryAdd(A, negMBin);
      opType = 'sub';
      opText = 'Q₀Q₋₁ = 10 → A ← A - M, then ASHR';
    } else {
      opType = 'shift';
      opText = `Q₀Q₋₁ = ${pair} → No arithmetic op, ASHR only`;
    }

    const shifted = arithmeticRightShift(A, Q, Q1);
    A = shifted.A;
    Q = shifted.Q;
    Q1 = shifted.Q1;
    SC--;

    steps.push({
      cycle,
      pair: cycle < n ? `${Q[n - 1]}${Q1}` : '—',
      executedPair: pair,
      opType,
      opText,
      A,
      Q,
      Q1,
      SC
    });
  }

  simMeta = { n, mDec, qDec, mBin, negMBin };
  return steps;
}

// Render Bit Cells inside Register Bus
function renderBitCells(container, bitStr, highlightLast = false, pairClass = '') {
  container.innerHTML = '';
  for (let i = 0; i < bitStr.length; i++) {
    const cell = document.createElement('div');
    cell.className = 'bit-cell';
    if (container === bitsAEl && i === 0) {
      cell.classList.add('sign-bit');
    }
    if (highlightLast && i === bitStr.length - 1 && pairClass) {
      cell.classList.add(pairClass);
    }
    cell.textContent = bitStr[i];
    container.appendChild(cell);
  }
}

// Render Current Step to UI
function renderStep(index) {
  const step = traceSteps[index];
  if (!step) return;

  // Constant registers
  regMEl.textContent = simMeta.mBin;
  decMEl.textContent = `Decimal: ${simMeta.mDec}`;
  regNegMEl.textContent = simMeta.negMBin;
  decNegMEl.textContent = `Decimal: ${-simMeta.mDec}`;
  regSCEl.textContent = step.SC;

  // Determine upcoming bit-pair highlight for current state
  const isComplete = index === traceSteps.length - 1;
  let pairClass = '';
  if (!isComplete) {
    if (step.pair === '01') pairClass = 'pair-add';
    else if (step.pair === '10') pairClass = 'pair-sub';
    else pairClass = 'pair-shift';
  }

  renderBitCells(bitsAEl, step.A);
  renderBitCells(bitsQEl, step.Q, !isComplete, pairClass);
  renderBitCells(bitsQ1El, step.Q1, !isComplete, pairClass);

  // Decision Pill
  decisionPillEl.className = 'decision-pill';
  if (isComplete) {
    decisionPillEl.classList.add('add');
    decisionPillEl.textContent = 'SC = 0 • Multiplication Complete';
  } else if (step.pair === '01') {
    decisionPillEl.classList.add('add');
    decisionPillEl.textContent = `Next: Q₀Q₋₁ = 01 → Add M & Shift`;
  } else if (step.pair === '10') {
    decisionPillEl.classList.add('sub');
    decisionPillEl.textContent = `Next: Q₀Q₋₁ = 10 → Subtract M & Shift`;
  } else {
    decisionPillEl.classList.add('shift');
    decisionPillEl.textContent = `Next: Q₀Q₋₁ = ${step.pair} → Shift Only`;
  }

  // Update Table Rows up to current step
  traceBodyEl.innerHTML = '';
  for (let i = 0; i <= index; i++) {
    const s = traceSteps[i];
    const tr = document.createElement('tr');
    if (i === index) tr.classList.add('active-row');

    const shownPair = i === 0 ? s.pair : s.executedPair;
    tr.innerHTML = `
      <td>${s.cycle}</td>
      <td><strong>${shownPair}</strong></td>
      <td><span class="op-tag op-${s.opType}">${s.opText}</span></td>
      <td>${s.A}</td>
      <td>${s.Q}</td>
      <td>${s.Q1}</td>
      <td>${s.SC}</td>
    `;
    traceBodyEl.appendChild(tr);
  }

  cycleCounterEl.textContent = `Cycle: ${step.cycle} / ${simMeta.n}`;

  // Button States
  prevBtn.disabled = index === 0;
  nextBtn.disabled = isComplete;
  autoBtn.disabled = isComplete;

  // Final Result Banner
  if (isComplete) {
    stopAutoPlay();
    const combinedBin = step.A + step.Q;
    const finalDec = fromTwosComplement(combinedBin);
    finalBinaryEl.textContent = `${step.A} ${step.Q}`;
    finalDecimalEl.textContent = finalDec;
    finalFormulaEl.textContent = `${simMeta.mDec} × ${simMeta.qDec} = ${finalDec}`;
    resultBannerEl.classList.remove('hidden');
  } else {
    resultBannerEl.classList.add('hidden');
  }
}

// Auto-Play Controls
function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
  autoBtn.textContent = '▶ Auto-Play';
}

function toggleAutoPlay() {
  if (autoPlayTimer) {
    stopAutoPlay();
    return;
  }
  autoBtn.textContent = '⏸ Pause';
  const delay = parseInt(speedRangeEl.value, 10);
  autoPlayTimer = setInterval(() => {
    if (currentStepIndex < traceSteps.length - 1) {
      currentStepIndex++;
      renderStep(currentStepIndex);
    } else {
      stopAutoPlay();
    }
  }, delay);
}

// Initialize Simulation
function initializeSimulation() {
  stopAutoPlay();
  errorBannerEl.classList.add('hidden');

  const n = parseInt(bitWidthEl.value, 10);
  const mDec = parseInt(multiplicandEl.value, 10);
  const qDec = parseInt(multiplierEl.value, 10);

  const minVal = -Math.pow(2, n - 1);
  const maxVal = Math.pow(2, n - 1) - 1;

  if (isNaN(mDec) || isNaN(qDec)) {
    errorBannerEl.textContent = 'Please enter valid integer values for both M and Q.';
    errorBannerEl.classList.remove('hidden');
    return;
  }

  if (mDec < minVal || mDec > maxVal || qDec < minVal || qDec > maxVal) {
    errorBannerEl.textContent = `Out of bounds for ${n}-bit two's complement! Allowed range: ${minVal} to ${maxVal}.`;
    errorBannerEl.classList.remove('hidden');
    return;
  }

  traceSteps = generateTrace(n, mDec, qDec);
  currentStepIndex = 0;
  exportBtn.disabled = false;
  renderStep(currentStepIndex);
}

// Export Trace to CSV
function exportCSV() {
  if (!traceSteps.length) return;
  const headers = ['Cycle', 'Q0_Q-1', 'Operation', 'Accumulator_A', 'Multiplier_Q', 'Q_-1', 'SC'];
  const rows = traceSteps.map((s, idx) => [
    s.cycle,
    `"${idx === 0 ? s.pair : s.executedPair}"`,
    `"${s.opText}"`,
    `"${s.A}"`,
    `"${s.Q}"`,
    `"${s.Q1}"`,
    s.SC
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `booths_trace_${simMeta.mDec}x${simMeta.qDec}_${simMeta.n}bit.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Event Listeners
bitWidthEl.addEventListener('change', () => {
  updateRangeHints();
  initializeSimulation();
});

speedRangeEl.addEventListener('input', () => {
  speedLabelEl.textContent = `${speedRangeEl.value}ms`;
  if (autoPlayTimer) {
    stopAutoPlay();
    toggleAutoPlay();
  }
});

initBtn.addEventListener('click', initializeSimulation);

prevBtn.addEventListener('click', () => {
  stopAutoPlay();
  if (currentStepIndex > 0) {
    currentStepIndex--;
    renderStep(currentStepIndex);
  }
});

nextBtn.addEventListener('click', () => {
  stopAutoPlay();
  if (currentStepIndex < traceSteps.length - 1) {
    currentStepIndex++;
    renderStep(currentStepIndex);
  }
});

autoBtn.addEventListener('click', toggleAutoPlay);
exportBtn.addEventListener('click', exportCSV);

// Boot with default values (-6 x 5 in 4-bit)
updateRangeHints();
initializeSimulation();