const {
  useState,
  useMemo,
  useRef,
  useEffect
} = React;

// ── Constants ──────────────────────────────────────────────────────────────
const G_IN = 386.09;
const RHO_STEEL = 0.2836;
const RHO_RPVC = 0.052;
const END_COM_FR_END = 6;
const PIPE_DATA = [{
  label: '2"',
  OD: 2.375,
  ID: 2.067,
  ballDia: 2.000
}, {
  label: '3"',
  OD: 3.500,
  ID: 3.068,
  ballDia: 3.000
}];
const DEFAULTS = {
  pumpFlowLpm: 15,
  vacKpa: 53,
  ppFactor: 1.4,
  pumpWattsEach: 9.6,
  num18650: 7,
  cellV: 3.7,
  cellAh: 3.0,
  endMassLbEach: 1.5,
  endLenIn: 11,
  shellThickIn: 0.007,
  shellDensLbIn3: 0.042,
  gaugePsi: 3.5,
  Cr: 0.025
};

// ── Physics ────────────────────────────────────────────────────────────────
function usePhysics(pipeIdx, pipeLenIn, a) {
  return useMemo(() => {
    const shellDiamIn = pipeLenIn;
    const pipe = PIPE_DATA[pipeIdx];
    const {
      OD,
      ID,
      ballDia
    } = pipe;
    const R_ID = ID / 2,
      R_OD = OD / 2,
      R_ball = ballDia / 2;
    const R_shell = shellDiamIn / 2;
    const traverseIn = pipeLenIn - 2 * a.endLenIn;
    const valid = traverseIn > 0;
    const W_pipe = Math.PI / 4 * (OD * OD - ID * ID) * pipeLenIn * RHO_RPVC;
    const W_ball = 4 / 3 * Math.PI * R_ball ** 3 * RHO_STEEL;
    const W_ends = 2 * a.endMassLbEach;
    const W_shell = 4 * Math.PI * R_shell ** 2 * a.shellThickIn * a.shellDensLbIn3;
    const W_total = W_pipe + W_ball + W_ends + W_shell;
    const ppPsi = a.vacKpa * 0.14504 * a.ppFactor;
    const A_tube = Math.PI * R_ID ** 2;
    const F_pump_max = ppPsi * A_tube;
    const v_max = a.pumpFlowLpm * 61.0237 / 60 / A_tube;
    const packWh = a.num18650 * a.cellV * a.cellAh;
    const contactRadIn = a.gaugePsi > 0 ? Math.sqrt(W_total / (Math.PI * a.gaugePsi)) : 0.01;
    const tau_startup = W_total * contactRadIn;
    const tau_max = valid ? W_ball * (traverseIn / 2) : 0;
    const m_ball_sl = W_ball / G_IN;
    const m_shell_sl = W_shell / G_IN;
    const m_pipe_sl = W_pipe / G_IN;
    const m_end_sl = a.endMassLbEach / G_IN;
    const I_shell = 2 / 3 * m_shell_sl * R_shell ** 2;
    const I_pipe = m_pipe_sl * ((R_OD ** 2 + R_ID ** 2) / 4 + pipeLenIn ** 2 / 12);
    const endDist = pipeLenIn / 2 - END_COM_FR_END;
    const I_ends = 2 * m_end_sl * endDist ** 2;
    const I_fixed = I_shell + I_pipe + I_ends;
    const I_total_fn = x => I_fixed + m_ball_sl * (x * x + 0.4 * R_ball * R_ball);
    return {
      pipe,
      valid,
      traverseIn,
      R_shell,
      shellDiamIn,
      W_pipe,
      W_ball,
      W_ends,
      W_shell,
      W_total,
      ppPsi,
      A_tube,
      F_pump_max,
      v_max,
      packWh,
      contactRadIn,
      tau_startup,
      tau_max,
      m_ball_sl,
      I_total_fn
    };
  }, [pipeIdx, pipeLenIn, a]);
}

// ── Rotary Knob ───────────────────────────────────────────────────────────
function Knob({
  value,
  min,
  max,
  onChange,
  onRelease,
  lines = [],
  size = 108,
  bidirectional = false
}) {
  const dragRef = useRef(null);
  const f = n => n.toFixed(2);
  const pct = (value - min) / (max - min);
  const MIN_ANG = 135,
    SWEEP = 270;
  const rawAng = MIN_ANG + pct * SWEEP;
  const curAng = (rawAng % 360 + 360) % 360;
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.33;
  const tk = Math.max(3, size * 0.068);
  const ptXY = (deg, rad) => ({
    x: cx + rad * Math.cos(deg * Math.PI / 180),
    y: cy + rad * Math.sin(deg * Math.PI / 180)
  });
  const ts = ptXY(MIN_ANG, r),
    te = ptXY(45, r);
  const trackPath = `M ${f(ts.x)} ${f(ts.y)} A ${r} ${r} 0 1 1 ${f(te.x)} ${f(te.y)}`;
  let valPath = "",
    valColor = "#4dffaa";
  if (bidirectional) {
    valColor = value > 0 ? "#4dffaa" : value < 0 ? "#ff5040" : "#334";
    const cAng = ((MIN_ANG + 0.5 * SWEEP) % 360 + 360) % 360;
    const cp = ptXY(cAng, r),
      ep = ptXY(curAng, r);
    if (Math.abs(pct - 0.5) > 0.012) {
      if (pct > 0.5) {
        const sw = (curAng - cAng + 360) % 360;
        valPath = `M ${f(cp.x)} ${f(cp.y)} A ${r} ${r} 0 ${sw > 180 ? 1 : 0} 1 ${f(ep.x)} ${f(ep.y)}`;
      } else {
        const sw = (cAng - curAng + 360) % 360;
        valPath = `M ${f(cp.x)} ${f(cp.y)} A ${r} ${r} 0 ${sw > 180 ? 1 : 0} 0 ${f(ep.x)} ${f(ep.y)}`;
      }
    }
  } else {
    const sw = pct * SWEEP;
    if (sw > 0.5) {
      const ep = ptXY(curAng, r);
      valPath = `M ${f(ts.x)} ${f(ts.y)} A ${r} ${r} 0 ${sw > 180 ? 1 : 0} 1 ${f(ep.x)} ${f(ep.y)}`;
    }
  }
  const pEnd = ptXY(curAng, r * 0.72);
  const pSt = ptXY(curAng, r * 0.18);
  const onPD = e => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      y0: e.clientY,
      v0: value
    };
  };
  const onPM = e => {
    if (!dragRef.current) return;
    const dy = dragRef.current.y0 - e.clientY;
    onChange(Math.max(min, Math.min(max, dragRef.current.v0 + dy / 155 * (max - min))));
  };
  const onPU = () => {
    dragRef.current = null;
    if (onRelease) onRelease();
  };
  const fz = [13, 9, 9];
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      cursor: "ns-resize",
      touchAction: "none",
      userSelect: "none",
      display: "block"
    },
    onPointerDown: onPD,
    onPointerMove: onPM,
    onPointerUp: onPU,
    onPointerCancel: onPU
  }, /*#__PURE__*/React.createElement("path", {
    d: trackPath,
    fill: "none",
    stroke: "#162a1c",
    strokeWidth: tk,
    strokeLinecap: "round"
  }), valPath && /*#__PURE__*/React.createElement("path", {
    d: valPath,
    fill: "none",
    stroke: valColor,
    strokeWidth: tk,
    strokeLinecap: "round",
    strokeOpacity: "0.92"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r * 0.77,
    fill: "#0b1a10",
    stroke: "#1e3822",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: f(pSt.x),
    y1: f(pSt.y),
    x2: f(pEnd.x),
    y2: f(pEnd.y),
    stroke: valColor,
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }), lines.map((ln, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: cx,
    y: cy + (i - (lines.length - 1) / 2) * 13,
    textAnchor: "middle",
    dominantBaseline: "middle",
    fill: i === 0 ? valColor : "#2a5838",
    fontSize: fz[i] || 9,
    fontFamily: "monospace",
    fontWeight: i === 0 ? "bold" : "normal"
  }, ln)));
}

// ── Human Silhouette ──────────────────────────────────────────────────────
function HumanFigure({
  x,
  yFeet,
  sc
}) {
  const headR = 4.5 * sc,
    neckH = 3 * sc,
    torsoH = 20 * sc;
  const ulegH = 18 * sc,
    llegH = 16 * sc;
  const sw = 7 * sc,
    hw = 4.5 * sc,
    lw = 3.2 * sc,
    aw = 2.2 * sc;
  const headCY = yFeet - (neckH + torsoH + ulegH + llegH + headR * 2) + headR;
  const neckY = headCY + headR,
    sY = neckY + neckH;
  const hipY = sY + torsoH,
    kneeY = hipY + ulegH;
  const c = "#4dffaa";
  return /*#__PURE__*/React.createElement("g", {
    opacity: 0.36
  }, /*#__PURE__*/React.createElement("ellipse", {
    cx: x,
    cy: headCY,
    rx: headR * 0.84,
    ry: headR,
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: x - 1.5 * sc,
    y: neckY,
    width: 3 * sc,
    height: neckH,
    fill: c
  }), /*#__PURE__*/React.createElement("polygon", {
    points: `${x - sw},${sY} ${x + sw},${sY} ${x + hw},${hipY} ${x - hw},${hipY}`,
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: x - sw - aw,
    y: sY + sc,
    width: aw,
    height: torsoH * 0.86,
    rx: aw * 0.42,
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: x + sw,
    y: sY + sc,
    width: aw,
    height: torsoH * 0.86,
    rx: aw * 0.42,
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: x - hw - lw * 0.25,
    y: hipY,
    width: lw,
    height: ulegH,
    rx: lw * 0.38,
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: x + hw - lw * 0.75,
    y: hipY,
    width: lw,
    height: ulegH,
    rx: lw * 0.38,
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: x - hw - lw * 0.2,
    y: kneeY,
    width: lw * 0.88,
    height: llegH - 2 * sc,
    rx: lw * 0.33,
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: x + hw - lw * 0.7,
    y: kneeY,
    width: lw * 0.88,
    height: llegH - 2 * sc,
    rx: lw * 0.33,
    fill: c
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: x - hw + lw * 0.2,
    cy: yFeet - sc,
    rx: lw * 0.95,
    ry: 1.6 * sc,
    fill: c
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: x + hw - lw * 0.2,
    cy: yFeet - sc,
    rx: lw * 0.95,
    ry: 1.6 * sc,
    fill: c
  }));
}

// ── Assumption input ──────────────────────────────────────────────────────
function AInput({
  label,
  value,
  onChange,
  unit,
  step = 0.1
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "9px",
      color: "#2a5a3a",
      fontFamily: "monospace",
      marginBottom: "3px"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "4px"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    step: step,
    onChange: e => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v)) onChange(v);
    },
    style: {
      width: "72px",
      background: "#0d1f14",
      border: "1px solid #2a5a35",
      color: "#4dffaa",
      fontFamily: "monospace",
      fontSize: "12px",
      padding: "3px 5px",
      borderRadius: "2px",
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "9px",
      color: "#2a4a38"
    }
  }, unit)));
}

// ── Main Component ────────────────────────────────────────────────────────
function BallBotPhysics() {
  const [pipeIdx, setPipeIdx] = useState(1);
  const [pipeLenIn, setPipeLenIn] = useState(36);
  const [pumpV, setPumpV] = useState(0);
  const [a, setA] = useState(DEFAULTS);
  const [showAssump, setShowAssump] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const setK = k => v => setA(prev => ({
    ...prev,
    [k]: v
  }));
  const p = usePhysics(pipeIdx, pipeLenIn, a);
  const pip = PIPE_DATA[pipeIdx];
  const simRef = useRef({
    ballPos: 0,
    ballVel: 0,
    phi: 0,
    omega: 0
  });
  const pRef = useRef(p);
  const aRef = useRef(a);
  const pvRef = useRef(0);
  const lastRef = useRef(null);
  const [disp, setDisp] = useState({
    ballPos: 0,
    phi: 0,
    omega: 0
  });
  useEffect(() => {
    aRef.current = a;
  }, [a]);
  useEffect(() => {
    pvRef.current = pumpV;
  }, [pumpV]);
  useEffect(() => {
    pRef.current = p;
    if (p.valid) {
      simRef.current.ballPos = p.traverseIn / 2;
      simRef.current.ballVel = 0;
    }
  }, [p]);
  useEffect(() => {
    const snap = () => setPumpV(0);
    window.addEventListener("mouseup", snap);
    window.addEventListener("touchend", snap);
    return () => {
      window.removeEventListener("mouseup", snap);
      window.removeEventListener("touchend", snap);
    };
  }, []);
  const unstick = () => {
    const trav = pRef.current.valid ? pRef.current.traverseIn / 2 : 7;
    simRef.current = {
      ballPos: trav,
      ballVel: 0,
      phi: 0,
      omega: 0
    };
    setDisp({
      ballPos: trav,
      phi: 0,
      omega: 0
    });
    setPumpV(0);
  };
  useEffect(() => {
    let alive = true;
    const loop = ts => {
      if (!alive) return;
      if (lastRef.current !== null) {
        const dt = Math.min((ts - lastRef.current) / 1000, 0.05);
        const pr = pRef.current,
          Cr = aRef.current.Cr,
          pV = pvRef.current;
        if (pr.valid) {
          const s = simRef.current;
          const xc = s.ballPos - pr.traverseIn / 2;
          const F_pump = pr.F_pump_max * (pV / 12);
          const F_grav = -pr.W_ball * Math.sin(s.phi);
          let bVel = s.ballVel + (F_pump + F_grav) / pr.m_ball_sl * dt;
          bVel = Math.max(-pr.v_max, Math.min(pr.v_max, bVel));
          let bPos = s.ballPos + bVel * dt;
          if (bPos <= 0) {
            bPos = 0;
            bVel = 0;
          }
          if (bPos >= pr.traverseIn) {
            bPos = pr.traverseIn;
            bVel = 0;
          }
          const tau_d = -pr.W_ball * xc * Math.cos(s.phi);
          const spd = Math.abs(s.omega);
          const tau_r = spd > 5e-4 ? -Cr * pr.W_total * pr.R_shell * Math.sign(s.omega) : 0;
          const I = pr.I_total_fn(xc);
          let omega = s.omega;
          if (spd > 5e-4 || Math.abs(tau_d) > pr.tau_startup) {
            omega = s.omega + (tau_d + tau_r) / I * dt;
          }
          const phi = s.phi + omega * dt;
          simRef.current = {
            ballPos: bPos,
            ballVel: bVel,
            phi,
            omega
          };
          setDisp({
            ballPos: bPos,
            phi,
            omega
          });
        }
      }
      lastRef.current = ts;
      requestAnimationFrame(loop);
    };
    const id = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
      lastRef.current = null;
    };
  }, []);
  const traverseIn = p.valid ? p.traverseIn : 0;
  const xc = disp.ballPos - traverseIn / 2;
  const tau_live = p.valid ? Math.abs(-p.W_ball * xc * Math.cos(disp.phi)) : 0;
  const tau_applied = tau_live - p.tau_startup;
  const power_W = Math.abs(pumpV) > 0 ? 2 * a.pumpWattsEach * Math.abs(pumpV / 12) : 0;
  const SVG_W = 860,
    SVG_H = 310,
    FLOOR_Y = 290;
  const sc = Math.min(220 / 66, (SVG_H - 74) / p.shellDiamIn);
  const R_sp = p.shellDiamIn / 2 * sc;
  const bCX = 295,
    bCY = FLOOR_Y - R_sp;
  const hpLpx = pipeLenIn / 2 * sc;
  const rODpx = pip.OD / 2 * sc;
  const rIDpx = pip.ID / 2 * sc;
  const sBRpx = pip.ballDia / 2 * sc;
  const sBOff = xc * sc;
  const phiDeg = disp.phi * 180 / Math.PI;
  const cRpx = p.contactRadIn * sc;
  const endPx = a.endLenIn * sc;
  const barPct = p.tau_startup > 0 ? Math.min(100, Math.max(0, tau_live / (p.tau_startup * 2) * 100)) : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "#080f0b",
      color: "#e0ffe8",
      fontFamily: "'Courier Prime', monospace"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0a1a10",
      borderBottom: "1px solid #4dffaa18",
      padding: "7px 18px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: "20px",
      color: "#4dffaa",
      letterSpacing: "0.12em"
    }
  }, "BallBot Physics Explorer")), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    style: {
      width: "100%",
      display: "block",
      background: "#060c08",
      borderBottom: "1px solid #182820"
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
    id: "csg2"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#4dffaa",
    stopOpacity: "0.09"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#060c08",
    stopOpacity: "0.6"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: "stg2",
    cx: "33%",
    cy: "28%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#d4e0ff",
    stopOpacity: "0.95"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#1a1a50",
    stopOpacity: "0.88"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "hatch",
    patternUnits: "userSpaceOnUse",
    width: "5",
    height: "5",
    patternTransform: "rotate(45)"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "5",
    stroke: "#ff9030",
    strokeWidth: "1.2",
    strokeOpacity: "0.35"
  }))), /*#__PURE__*/React.createElement("line", {
    x1: "10",
    y1: FLOOR_Y,
    x2: SVG_W - 10,
    y2: FLOOR_Y,
    stroke: "#1a3622",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: bCX,
    cy: FLOOR_Y,
    rx: Math.max(cRpx, 2),
    ry: Math.max(cRpx * 0.12, 1.5),
    fill: "#ff503c",
    fillOpacity: "0.28",
    stroke: "#ff503c",
    strokeWidth: "0.7"
  }), /*#__PURE__*/React.createElement("text", {
    x: bCX,
    y: FLOOR_Y + 14,
    textAnchor: "middle",
    fill: "#cc3a28",
    fontSize: "9",
    fontFamily: "monospace"
  }, "footprint ", (p.contactRadIn * 2).toFixed(3), "\""), /*#__PURE__*/React.createElement("circle", {
    cx: bCX,
    cy: bCY,
    r: R_sp,
    fill: "url(#csg2)",
    stroke: "#4dffaa",
    strokeWidth: "1.0",
    strokeOpacity: "0.38"
  }), /*#__PURE__*/React.createElement("g", {
    transform: `rotate(${-phiDeg}, ${bCX}, ${bCY})`
  }, /*#__PURE__*/React.createElement("line", {
    x1: bCX - hpLpx,
    y1: bCY - rODpx - 5,
    x2: bCX + hpLpx,
    y2: bCY - rODpx - 5,
    stroke: "#4dffaa",
    strokeWidth: "1.5",
    strokeDasharray: "4,4",
    strokeOpacity: "0.16"
  }), /*#__PURE__*/React.createElement("text", {
    x: bCX,
    y: bCY - rODpx - 8,
    textAnchor: "middle",
    fill: "#1e4830",
    fontSize: "7",
    fontFamily: "monospace"
  }, "½\" recirc"), /*#__PURE__*/React.createElement("rect", {
    x: bCX - hpLpx,
    y: bCY - rODpx,
    width: hpLpx * 2,
    height: rODpx * 2,
    fill: "#09150d",
    stroke: "#4dffaa",
    strokeWidth: "0.7",
    strokeOpacity: "0.25",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: bCX - hpLpx,
    y: bCY - rODpx,
    width: endPx,
    height: rODpx * 2,
    fill: "url(#hatch)",
    stroke: "#ff9030",
    strokeWidth: "0.8",
    strokeOpacity: "0.55"
  }), /*#__PURE__*/React.createElement("rect", {
    x: bCX + hpLpx - endPx,
    y: bCY - rODpx,
    width: endPx,
    height: rODpx * 2,
    fill: "url(#hatch)",
    stroke: "#ff9030",
    strokeWidth: "0.8",
    strokeOpacity: "0.55"
  }), /*#__PURE__*/React.createElement("text", {
    x: bCX - hpLpx + endPx / 2,
    y: bCY + rODpx + 9,
    textAnchor: "middle",
    fill: "#b05820",
    fontSize: "7",
    fontFamily: "monospace"
  }, "BATT·PUMP"), /*#__PURE__*/React.createElement("text", {
    x: bCX + hpLpx - endPx / 2,
    y: bCY + rODpx + 9,
    textAnchor: "middle",
    fill: "#b05820",
    fontSize: "7",
    fontFamily: "monospace"
  }, "BATT·PUMP"), p.valid && [bCX - hpLpx + endPx, bCX + hpLpx - endPx].map((tx, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: tx,
    y1: bCY - rIDpx * 1.3,
    x2: tx,
    y2: bCY + rIDpx * 1.3,
    stroke: "#4dffaa",
    strokeWidth: "0.8",
    strokeOpacity: "0.5",
    strokeDasharray: "2,2"
  })), /*#__PURE__*/React.createElement("rect", {
    x: bCX - hpLpx,
    y: bCY - rIDpx,
    width: hpLpx * 2,
    height: rIDpx * 2,
    fill: "#060c08",
    stroke: "#4dffaa",
    strokeWidth: "0.3",
    strokeOpacity: "0.10"
  }), p.valid && /*#__PURE__*/React.createElement("circle", {
    cx: bCX + sBOff,
    cy: bCY,
    r: sBRpx,
    fill: "url(#stg2)",
    stroke: "#5858a8",
    strokeWidth: "0.9"
  })), /*#__PURE__*/React.createElement("text", {
    x: bCX,
    y: bCY - R_sp - 18,
    textAnchor: "middle",
    fill: "#4dffaa",
    fontSize: "12",
    fontFamily: "monospace",
    fontWeight: "bold"
  }, "BallBot dia ", p.shellDiamIn, "\" · ", p.W_total.toFixed(2), " lb"), Math.abs(disp.omega) > 5e-3 ? /*#__PURE__*/React.createElement("text", {
    x: bCX - R_sp - 10,
    y: bCY,
    textAnchor: "end",
    fill: "#ffcc44",
    fontSize: "9",
    fontFamily: "monospace",
    dominantBaseline: "middle"
  }, disp.omega > 0 ? "◄ CCW" : "CW ►", " ", Math.abs(disp.omega).toFixed(3), " r/s") : /*#__PURE__*/React.createElement("text", {
    x: bCX - R_sp - 10,
    y: bCY,
    textAnchor: "end",
    fill: "#1e3e28",
    fontSize: "9",
    fontFamily: "monospace",
    dominantBaseline: "middle"
  }, "static"), /*#__PURE__*/React.createElement(HumanFigure, {
    x: 808,
    yFeet: FLOOR_Y,
    sc: sc
  }), /*#__PURE__*/React.createElement("text", {
    x: 808,
    y: FLOOR_Y + 14,
    textAnchor: "middle",
    fill: "#1a3820",
    fontSize: "8",
    fontFamily: "monospace"
  }, "5' 6\"")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "5px 10px",
      background: "#090e0c",
      borderBottom: "1px solid #182820",
      gap: "12px",
      flexWrap: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "1px"
    }
  }, /*#__PURE__*/React.createElement(Knob, {
    value: pumpV,
    min: -12,
    max: 12,
    size: 72,
    bidirectional: true,
    onChange: v => setPumpV(parseFloat(v.toFixed(1))),
    onRelease: () => setPumpV(0),
    lines: [`${pumpV >= 0 ? "+" : ""}${pumpV.toFixed(1)} V`, power_W > 0 ? `${power_W.toFixed(1)} W` : "idle"]
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "8px",
      color: "#2a5030",
      letterSpacing: "0.07em",
      fontFamily: "monospace"
    }
  }, "PUMP · ↑+ ↓− · rel=0")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "3px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "8px",
      color: "#2a5030",
      letterSpacing: "0.1em",
      fontFamily: "monospace"
    }
  }, "PIPE SIZE · SCH 40 PVC"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "4px"
    }
  }, PIPE_DATA.map((pd, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setPipeIdx(i),
    style: {
      padding: "5px 10px",
      background: pipeIdx === i ? "#4dffaa" : "#0c1e12",
      color: pipeIdx === i ? "#080f0b" : "#4dffaa",
      border: `1px solid ${pipeIdx === i ? "#4dffaa" : "#2a5a35"}`,
      borderRadius: "3px",
      cursor: "pointer",
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: "16px"
    }
  }, pd.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "8px",
      color: "#1e4028",
      fontFamily: "monospace",
      textAlign: "center",
      lineHeight: "1.6"
    }
  }, "OD ", pip.OD, "\" · ID ", pip.ID, "\" · Ø", pip.ballDia, "\" · F ", p.F_pump_max.toFixed(1), " lb")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "1px"
    }
  }, /*#__PURE__*/React.createElement(Knob, {
    value: pipeLenIn,
    min: 24,
    max: 80,
    size: 72,
    onChange: v => setPipeLenIn(Math.round(v)),
    lines: [`${pipeLenIn}"`, p.valid ? `trav ${p.traverseIn}"` : "short", `arm ±${p.valid ? (p.traverseIn / 2).toFixed(1) : "—"}"`]
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "8px",
      color: "#2a5030",
      letterSpacing: "0.07em",
      fontFamily: "monospace"
    }
  }, "PIPE LEN = BALL DIA")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: unstick,
    style: {
      padding: "9px 13px",
      background: "#1a0a04",
      color: "#ff8040",
      border: "1px solid #ff6020",
      borderRadius: "3px",
      cursor: "pointer",
      fontFamily: "monospace",
      fontSize: "11px",
      letterSpacing: "0.05em"
    },
    onMouseEnter: e => e.currentTarget.style.background = "#2a1008",
    onMouseLeave: e => e.currentTarget.style.background = "#1a0a04"
  }, "⟲ UNSTICK"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "8px",
      color: "#5a3018",
      fontFamily: "monospace",
      textAlign: "center"
    }
  }, "reset to horizontal"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "9px 20px",
      background: "#080c0a",
      borderBottom: "1px solid #182820"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "9px",
      color: "#2a5838",
      fontFamily: "monospace",
      letterSpacing: "0.12em",
      minWidth: "52px"
    }
  }, "TORQUE"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#6adfaa"
    }
  }, "gen ", tau_live.toFixed(2)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#1e3e28",
      fontSize: "11px"
    }
  }, "−"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#cc7030"
    }
  }, "startup ", p.tau_startup.toFixed(2)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#1e3e28",
      fontSize: "11px"
    }
  }, "="), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "monospace",
      fontSize: "13px",
      fontWeight: "bold",
      minWidth: "80px",
      color: tau_applied > 0 ? "#4dffaa" : "#ff503c"
    }
  }, tau_applied >= 0 ? "+" : "", tau_applied.toFixed(2), " lb·in"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 120px",
      height: "7px",
      background: "#0d1a10",
      borderRadius: "4px",
      overflow: "hidden",
      minWidth: "60px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${barPct}%`,
      height: "100%",
      background: tau_applied > 0 ? "#4dffaa" : "#ff503c",
      borderRadius: "4px",
      transition: "width 0.05s"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "9px",
      color: "#1e3e28",
      fontFamily: "monospace",
      whiteSpace: "nowrap"
    }
  }, "max ", p.tau_max.toFixed(2), " lb·in"))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid #182820"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAssump(!showAssump),
    style: {
      width: "100%",
      padding: "8px 20px",
      background: "#090e0c",
      border: "none",
      cursor: "pointer",
      color: "#2a5838",
      fontFamily: "monospace",
      fontSize: "10px",
      letterSpacing: "0.1em",
      textAlign: "left",
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, "EDITABLE ASSUMPTIONS"), /*#__PURE__*/React.createElement("span", null, showAssump ? "▲" : "▼")), showAssump && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 20px",
      background: "#070c08",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(155px,1fr))",
      gap: "14px"
    }
  }, [{
    k: "pumpFlowLpm",
    l: "Pump flow",
    u: "L/min",
    s: 1
  }, {
    k: "vacKpa",
    l: "Pump vacuum",
    u: "kPa",
    s: 1
  }, {
    k: "ppFactor",
    l: "Push-pull mult",
    u: "×",
    s: 0.05
  }, {
    k: "pumpWattsEach",
    l: "Pump watts each",
    u: "W",
    s: 0.1
  }, {
    k: "num18650",
    l: "18650 count",
    u: "cells",
    s: 1
  }, {
    k: "cellV",
    l: "Cell voltage",
    u: "V",
    s: 0.05
  }, {
    k: "cellAh",
    l: "Cell capacity",
    u: "Ah",
    s: 0.1
  }, {
    k: "endMassLbEach",
    l: "End assy mass each",
    u: "lb",
    s: 0.1
  }, {
    k: "endLenIn",
    l: "End axial len each",
    u: "in",
    s: 0.5
  }, {
    k: "shellThickIn",
    l: "Shell wall thick",
    u: "in",
    s: 0.001
  }, {
    k: "shellDensLbIn3",
    l: "Shell density",
    u: "lb/in³",
    s: 0.001
  }, {
    k: "gaugePsi",
    l: "Inflation pressure",
    u: "PSI",
    s: 0.1
  }, {
    k: "Cr",
    l: "Rolling resist Cr",
    u: "",
    s: 0.001
  }].map(({
    k,
    l,
    u,
    s
  }) => /*#__PURE__*/React.createElement(AInput, {
    key: k,
    label: l,
    value: a[k],
    onChange: setK(k),
    unit: u,
    step: s
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowEq(!showEq),
    style: {
      width: "100%",
      padding: "8px 20px",
      background: "#090e0c",
      border: "none",
      cursor: "pointer",
      color: "#2a5838",
      fontFamily: "monospace",
      fontSize: "10px",
      letterSpacing: "0.1em",
      textAlign: "left",
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, "METHOD OF CALCULATION"), /*#__PURE__*/React.createElement("span", null, showEq ? "▲" : "▼")), showEq && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 22px 40px",
      background: "#070c08",
      fontSize: "11px",
      fontFamily: "monospace",
      lineHeight: "2.0",
      maxWidth: "860px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#1a4228",
      marginBottom: "12px"
    }
  }, "All-inch unit system · lbf · slinch (lbf·s²/in) · g = 386.09 in/s² · Euler integration ~60 fps"), [{
    t: "COUPLING",
    e: "shellDiamIn = pipeLenIn  (pipe spans pole-to-pole)",
    v: `${pipeLenIn}" pipe → ${p.shellDiamIn}" ball dia · traverse = pipe − 2×end = ${p.valid ? p.traverseIn : "—"}"`
  }, {
    t: "SHELL MASS",
    e: "W = 4πR² · t · ρ",
    v: `4π·${(p.shellDiamIn / 2).toFixed(1)}² · ${a.shellThickIn} · ${a.shellDensLbIn3} = ${p.W_shell.toFixed(3)} lb`,
    n: "Thin spherical shell"
  }, {
    t: "FOOTPRINT  (contact patch)",
    e: "a = √(W_total / π·P_gauge)",
    v: `√(${p.W_total.toFixed(2)} / π·${a.gaugePsi}) = ${p.contactRadIn.toFixed(4)}" radius → dia ${(p.contactRadIn * 2).toFixed(4)}"`,
    n: "Inflated membrane model — lower pressure = wider footprint"
  }, {
    t: "STARTUP TORQUE THRESHOLD",
    e: "τ_start = W_total · a",
    v: `${p.W_total.toFixed(2)} · ${p.contactRadIn.toFixed(4)} = ${p.tau_startup.toFixed(3)} lb·in`,
    n: "Torque to tip the ball over the edge of its contact flat-spot"
  }, {
    t: "MAX DRIVE TORQUE  (horizontal pipe, ball at traverse end)",
    e: "τ_max = W_ball · (traverse/2)",
    v: `${p.W_ball.toFixed(3)} · ${p.valid ? (p.traverseIn / 2).toFixed(1) : "—"} = ${p.tau_max.toFixed(2)} lb·in`,
    n: "End assemblies symmetric → their torques cancel exactly"
  }, {
    t: "LIVE DRIVE TORQUE",
    e: "τ = W_ball · |xc · cos(φ)|",
    v: `${p.W_ball.toFixed(3)} · |${xc.toFixed(2)} · cos(${(disp.phi * 180 / Math.PI).toFixed(1)}°)| = ${tau_live.toFixed(3)} lb·in`,
    n: "φ = pipe angle from horizontal. Zero at vertical (singularity)"
  }, {
    t: "PUMP EFFECTIVE PRESSURE  (push-pull dual pump)",
    e: "P_pp = (vacKpa · 0.14504) · ppFactor",
    v: `(${a.vacKpa}·0.14504)·${a.ppFactor} = ${p.ppPsi.toFixed(2)} PSI`,
    n: "Recirculation pipe routes displaced air with minimal resistance"
  }, {
    t: "PUMP FORCE ON STEEL BALL",
    e: "F = P_pp · π·(ID/2)²",
    v: `${p.ppPsi.toFixed(2)} · π·${(pip.ID / 2).toFixed(4)}² = ${p.F_pump_max.toFixed(1)} lb  (${(p.F_pump_max / p.W_ball).toFixed(0)}× ball weight)`
  }, {
    t: "BALL VELOCITY LIMIT  (flow-rate bound)",
    e: "v_max = Q_pump / A_tube   [Q = flowLpm·61.024/60]",
    v: `${(a.pumpFlowLpm * 61.0237 / 60).toFixed(2)} in³/s ÷ ${p.A_tube.toFixed(3)} in² = ${p.v_max.toFixed(2)} in/s`,
    n: "Pump rated flow is the binding constraint; gravity negligible vs pump force"
  }, {
    t: "ROLLING RESISTANCE",
    e: "τ_r = Cr · W_total · R_shell  (opposes ω)",
    v: `${a.Cr} · ${p.W_total.toFixed(2)} · ${(p.shellDiamIn / 2).toFixed(1)} = ${(a.Cr * p.W_total * p.shellDiamIn / 2).toFixed(2)} lb·in`,
    n: "Hard inflated PVC on concrete: Cr ≈ 0.02–0.03. Zero when static."
  }, {
    t: "ROTATIONAL INERTIA  (varies with ball position)",
    e: "I = I_shell + I_pipe + I_ends + m_ball·(xc² + 0.4·r_ball²)",
    v: `at xc=${xc.toFixed(1)}": I = ${p.I_total_fn(xc).toFixed(4)} slinch·in²`,
    n: "Lowest when ball centred; highest at traverse limits"
  }, {
    t: "ELECTRICAL POWER",
    e: "P = 2 · W_each · |V/12|",
    v: `2 · ${a.pumpWattsEach} · ${Math.abs(pumpV / 12).toFixed(2)} = ${power_W.toFixed(1)} W`,
    n: "Linear scaling assumed. Real pump efficiency varies with back-pressure."
  }, {
    t: "BATTERY PACK",
    e: "E = n · V · Ah",
    v: `${a.num18650} · ${a.cellV} · ${a.cellAh} = ${(a.num18650 * a.cellV * a.cellAh).toFixed(1)} Wh`,
    n: "Gravity PE partially recovered on return stroke"
  }].map(({
    t,
    e,
    v,
    n
  }) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      marginBottom: "12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#2a6840",
      fontSize: "9px",
      letterSpacing: "0.1em"
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#5ad890",
      paddingLeft: "12px"
    }
  }, e), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#226040",
      paddingLeft: "12px"
    }
  }, "= ", v), n && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#143a20",
      paddingLeft: "12px",
      fontSize: "9px"
    }
  }, n))))));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(BallBotPhysics, null));