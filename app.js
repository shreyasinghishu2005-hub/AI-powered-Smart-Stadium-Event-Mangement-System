// ========== STATE & DATA ==========
let appData = {};
let chartInstance = null;

// ========== UTILITY FUNCTIONS ==========
function currency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = { success: "check-circle", error: "times-circle", warning: "exclamation-triangle", info: "info-circle" };
  toast.innerHTML = `<i class="fas fa-${icons[type]}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(100px)"; setTimeout(() => toast.remove(), 300); }, 4000);
}

function showModal(title, bodyHTML) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHTML;
  document.getElementById("modalOverlay").classList.add("active");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
}

// ========== API CALLS ==========
async function fetchState() {
  try {
    const res = await fetch("/api/state");
    appData = await res.json();
    renderAll();
  } catch (e) { console.error("Failed to fetch state:", e); }
}

async function postAction(action, payload = {}) {
  try {
    await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
    await fetchState();
  } catch (e) { console.error("Action failed:", e); }
}

// ========== RENDER FUNCTIONS ==========
function renderClock() {
  if (!appData.state) return;
  const minutes = 45 + appData.state.tick * 3;
  const hour = 18 + Math.floor(minutes / 60);
  const minute = minutes % 60;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const el = document.getElementById("systemClock");
  if (el) el.textContent = `Match day ${timeStr}`;
  const timeDisp = document.getElementById("timeDisplay");
  if (timeDisp) timeDisp.textContent = timeStr;

  // Update greeting based on hour
  const greeting = document.getElementById("greetingText");
  if (greeting) {
    let greet = "Good Evening";
    if (hour < 12) greet = "Good Morning";
    else if (hour < 17) greet = "Good Afternoon";
    greeting.innerHTML = `<span class="wave-emoji">👋</span> ${greet}, Shivam`;
  }

  // Update date
  const dateDisp = document.getElementById("dateDisplay");
  if (dateDisp) {
    const now = new Date();
    dateDisp.textContent = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
}

function renderMetrics() {
  if (!appData.metrics) return;
  const m = appData.metrics;
  const el = (id) => document.getElementById(id);

  el("attendanceMetric").textContent = m.attendance.toLocaleString("en-IN");
  el("attendanceTrend").innerHTML = `<i class="fas fa-arrow-up"></i> +12% vs. last event`;
  el("waitMetric").textContent = `${m.averageWait} min`;
  el("waitTrend").innerHTML = `<i class="fas fa-arrow-down"></i> -45% vs. last event`;
  el("riskMetric").textContent = m.risk;
  el("riskTrend").innerHTML = `<i class="fas fa-arrow-down"></i> -32% vs. last event`;
  el("revenueMetric").textContent = `₹${(m.revenue).toLocaleString("en-IN")}`;
  el("revenueTrend").innerHTML = `<i class="fas fa-arrow-up"></i> +18% vs. last hour`;
}

function renderStadiumMap() {
  if (!appData.zones) return;
  const board = document.getElementById("stadiumBoard");
  // Keep the background image, clear markers
  const img = board.querySelector(".stadium-bg-img");
  board.innerHTML = "";
  if (img) board.appendChild(img);
  else board.innerHTML = '<img src="static/stadium_bg.png" alt="Stadium" class="stadium-bg-img" />';

  appData.zones.forEach((zone) => {
    const marker = document.createElement("div");
    marker.className = "zone-marker";
    if (zone.id === appData.state.selectedZone) marker.classList.add("selected");

    let dotClass = "low";
    if (zone.currentDensity >= 90) dotClass = "critical";
    else if (zone.currentDensity >= 76) dotClass = "high";
    else if (zone.currentDensity >= 52) dotClass = "moderate";

    marker.style.left = `${zone.x}%`;
    marker.style.top = `${zone.y}%`;
    marker.innerHTML = `
      <span class="zm-name"><span class="zm-dot ${dotClass}"></span>${zone.name}</span>
      <span class="zm-info">${zone.type}: ${zone.currentDensity}% density</span>
      <span class="zm-wait">Wait: ${zone.currentWait} min</span>
    `;
    marker.addEventListener("click", () => {
      postAction("set_zone", { zone: zone.id });
      showToast(`Zone selected: ${zone.name}`, "info");
    });
    board.appendChild(marker);
  });
}

function renderSelectedZone() {
  if (!appData.selectedZoneInfo) return;
  document.getElementById("selectedZoneName").textContent = appData.selectedZoneInfo.name;
  document.getElementById("selectedZoneAction").textContent = appData.selectedZoneInfo.action;
  document.getElementById("focusZone").textContent = appData.selectedZoneInfo.name;
}

function renderAlerts() {
  if (!appData.alerts) return;
  const feed = document.getElementById("alertFeed");
  const times = ["19:32", "19:28", "19:20", "19:15", "19:10"];

  feed.innerHTML = appData.alerts.map(([level, source, text], i) => `
    <div class="alert-item" onclick="showModal('Alert: ${source}', '<p><strong>Severity:</strong> ${level.toUpperCase()}</p><p><strong>Source:</strong> ${source}</p><p><strong>Details:</strong> ${text}</p><p><strong>Time:</strong> ${times[i] || "19:00"}</p><p><strong>Status:</strong> Under review</p>')">
      <span class="alert-severity ${level}">${level.toUpperCase()}</span>
      <div class="alert-content">
        <strong>${source}</strong>
        <span>${text}</span>
      </div>
      <div class="alert-meta">
        <i class="fas fa-chevron-right alert-chevron"></i>
      </div>
    </div>
  `).join("");

  const badge = document.getElementById("alertCountBadge");
  if (badge) badge.textContent = appData.alerts.length;
  const navBadge = document.getElementById("alertBadge");
  if (navBadge) navBadge.textContent = appData.alerts.length;

  // Full alerts list
  const fullList = document.getElementById("alertsFullList");
  if (fullList) {
    fullList.innerHTML = appData.alerts.map(([level, source, text], i) => `
      <div class="alert-item">
        <span class="alert-severity ${level}">${level.toUpperCase()}</span>
        <div class="alert-content">
          <strong>${source}</strong>
          <span>${text}</span>
        </div>
        <div class="alert-meta">
          <span style="font-size:12px;color:var(--text-muted)">${times[i] || "19:00"}</span>
          <i class="fas fa-chevron-right alert-chevron"></i>
        </div>
      </div>
    `).join("");
  }
}

function renderAnalyticsCards() {
  if (!appData.forecasts) return;
  const cards = document.getElementById("analyticsCards");
  const data = [
    { label: "Attendance Forecast", value: "51.2K", sub: "+6%", subClass: "green", icon: "fa-arrow-right" },
    { label: "Parking Demand", value: "P3: 92%", sub: "High", subClass: "red", icon: "fa-arrow-right" },
    { label: "Food & Beverage", value: "78%", sub: "Normal", subClass: "green", icon: "fa-arrow-right" },
    { label: "Merchandise Sales", value: "32%", sub: "+15%", subClass: "green", icon: "fa-arrow-right" },
  ];

  cards.innerHTML = data.map(d => `
    <div class="analytics-card">
      <div class="ac-label">${d.label} <i class="fas ${d.icon}" style="font-size:12px"></i></div>
      <div class="ac-value">${d.value}</div>
      <span class="ac-sub ${d.subClass}">${d.sub}</span>
    </div>
  `).join("");
}

function renderChart() {
  const canvas = document.getElementById("demandChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (chartInstance) chartInstance = null;

  const w = canvas.width = canvas.parentElement.clientWidth - 32;
  const h = canvas.height = 160;
  ctx.clearRect(0, 0, w, h);

  const actual = [20, 28, 22, 35, 42, 48, 52, 45, 50, 40];
  const forecast = [18, 25, 20, 30, 38, 44, 50, 48, 52, 42];
  const labels = ["12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM"];
  const maxVal = 60;

  const padLeft = 40, padBottom = 25, padRight = 20, padTop = 10;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padTop + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "11px Inter";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(maxVal - (maxVal / 3) * i)}K`, padLeft - 6, y + 4);
  }

  // X labels
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "center";
  labels.forEach((l, i) => {
    const x = padLeft + (chartW / (labels.length - 1)) * i;
    ctx.fillText(l, x, h - 5);
  });

  // Draw actual (filled area)
  const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  gradient.addColorStop(0, "rgba(59,130,246,0.3)");
  gradient.addColorStop(1, "rgba(59,130,246,0)");

  ctx.beginPath();
  actual.forEach((v, i) => {
    const x = padLeft + (chartW / (actual.length - 1)) * i;
    const y = padTop + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(padLeft + chartW, padTop + chartH);
  ctx.lineTo(padLeft, padTop + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Actual line
  ctx.beginPath();
  actual.forEach((v, i) => {
    const x = padLeft + (chartW / (actual.length - 1)) * i;
    const y = padTop + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Forecast line (dashed)
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  forecast.forEach((v, i) => {
    const x = padLeft + (chartW / (forecast.length - 1)) * i;
    const y = padTop + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
}

function renderResources() {
  const list = document.getElementById("resourceList");
  if (!list) return;

  const resources = [
    { name: "Fan Flow", status: "On track", statusClass: "on-track", icon: "fa-users", iconClass: "blue", value: 87, change: "+2%", barColor: "#3b82f6" },
    { name: "Crowd Staff", status: "On track", statusClass: "on-track", icon: "fa-user-shield", iconClass: "green", value: 76, change: "+1%", barColor: "#10b981" },
    { name: "Inventory", status: "On track", statusClass: "on-track", icon: "fa-boxes", iconClass: "orange", value: 63, change: "+3%", barColor: "#f59e0b" },
    { name: "Parking", status: "High demand", statusClass: "high-demand", icon: "fa-car", iconClass: "red", value: 91, change: "+4%", barColor: "#ef4444" },
    { name: "Security", status: "On track", statusClass: "on-track", icon: "fa-shield-alt", iconClass: "purple", value: 94, change: "+1%", barColor: "#8b5cf6" },
  ];

  list.innerHTML = resources.map(r => `
    <div class="resource-item" onclick="showToast('${r.name}: ${r.value}% capacity', '${r.statusClass === "high-demand" ? "warning" : "info"}')">
      <div class="resource-icon ${r.iconClass}"><i class="fas ${r.icon}"></i></div>
      <div class="resource-info">
        <strong>${r.name}</strong>
        <span class="resource-status ${r.statusClass}">${r.status}</span>
      </div>
      <div class="resource-bar">
        <div class="resource-bar-fill" style="width:${r.value}%;background:${r.barColor}"></div>
      </div>
      <div class="resource-values">
        <strong>${r.value}%</strong>
        <span class="rv-change green">${r.change}</span>
      </div>
      <i class="fas fa-chevron-right resource-chevron"></i>
    </div>
  `).join("");
}

function renderActivity() {
  const list = document.getElementById("activityList");
  if (!list) return;

  const activities = [
    { text: "Gate N2 opened (extra lane)", time: "5 min ago", color: "var(--accent-green)" },
    { text: "Food staff 3 restocked", time: "12 min ago", color: "var(--accent-blue)" },
    { text: "Security sweep completed (East Plaza)", time: "18 min ago", color: "var(--accent-purple)" },
    { text: "Parking P3 at 92% capacity", time: "22 min ago", color: "var(--accent-orange)" },
  ];

  list.innerHTML = activities.map(a => `
    <div class="activity-item">
      <span class="ai-dot" style="background:${a.color}"></span>
      <span class="ai-text">${a.text}</span>
      <span class="ai-time">${a.time}</span>
    </div>
  `).join("");
}

function renderForecasts() {
  if (!appData.forecasts) return;
  const list = document.getElementById("forecastList");
  if (!list) return;
  list.innerHTML = appData.forecasts.map(([name, desc, val]) => `
    <div class="forecast-item">
      <strong>${name}</strong>
      <p>${desc}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${val}%"></div></div>
    </div>
  `).join("");
}

function renderFanScore() {
  const breakdown = document.getElementById("fanScoreBreakdown");
  if (!breakdown) return;
  const items = [
    { label: "Entry Speed", score: 92 },
    { label: "Food Quality", score: 78 },
    { label: "Comfort", score: 85 },
    { label: "Safety", score: 95 },
    { label: "Navigation", score: 88 },
  ];
  breakdown.innerHTML = items.map(it => `
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="width:100px;font-size:13px;color:var(--text-secondary)">${it.label}</span>
      <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${it.score}%;background:linear-gradient(90deg,var(--accent-green),var(--accent-cyan));border-radius:3px"></div>
      </div>
      <span style="font-weight:700;font-size:13px;min-width:30px;text-align:right">${it.score}</span>
    </div>
  `).join("");
}

function renderTicketing() {
  if (!appData.ticketQueue) return;
  const queue = document.getElementById("ticketQueue");
  if (!queue) return;
  queue.innerHTML = appData.ticketQueue.map(([code, status, detail]) => `
    <div class="ticket-row">
      <div><strong>${code}</strong><p>${detail}</p></div>
      <span style="color:${status === 'Valid' ? 'var(--accent-green)' : status === 'Duplicate' ? 'var(--accent-red)' : 'var(--accent-orange)'};font-weight:700;font-size:13px">${status}</span>
    </div>
  `).join("");
}

function renderSchedule() {
  if (!appData.schedule) return;
  const list = document.getElementById("scheduleList");
  if (!list) return;
  list.innerHTML = appData.schedule.map(item => `
    <div class="schedule-item">
      <div><strong>${item.match} — ${item.teams}</strong><p>${item.time} at ${item.venue}. ${item.note}</p></div>
      <span class="schedule-tag">${item.tag}</span>
    </div>
  `).join("");
}

function renderReport() {
  if (!appData.report) return;
  const el = document.getElementById("opsReport");
  if (el) el.textContent = appData.report;
}

function renderFanAssistant() {
  if (!appData.fanRecommendations) return;
  const picks = document.getElementById("fanPicks");
  if (!picks) return;
  picks.innerHTML = appData.fanRecommendations.map(([title, detail]) => `
    <div class="pick-item"><strong>${title}</strong><p>${detail}</p></div>
  `).join("");

  const chat = document.getElementById("chatWindow");
  if (chat && !chat.dataset.ready) {
    addMessage("bot", "Hi! I'm your Smart Stadium Assistant. I can help with gates, seats, food, restrooms, merchandise, match timing, and route guidance. What do you need?");
    chat.dataset.ready = "true";
  }
}

function addMessage(role, text) {
  const chat = document.getElementById("chatWindow");
  if (!chat) return;
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.textContent = text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function renderSustainability() {
  if (!appData.energy || !appData.waste) return;
  const eg = document.getElementById("energyGrid");
  if (eg) {
    eg.innerHTML = appData.energy.map(([name, val, detail]) => `
      <div class="energy-item"><strong>${name}</strong><p>${val}</p><p>${detail}</p></div>
    `).join("");
  }
  const sl = document.getElementById("sustainabilityList");
  if (sl) {
    sl.innerHTML = appData.waste.map(([name, detail]) => `
      <div class="sustainability-item"><strong>${name}</strong><p>${detail}</p></div>
    `).join("");
  }
}

function renderCameras() {
  const grid = document.getElementById("cameraGrid");
  if (!grid) return;
  const cams = [
    { name: "North Gate - Cam 01", status: "Active", icon: "fa-video" },
    { name: "East Plaza - Cam 04", status: "Active", icon: "fa-video" },
    { name: "South Gate - Cam 07", status: "Active", icon: "fa-video" },
    { name: "West Stand - Cam 10", status: "Active", icon: "fa-video" },
    { name: "Parking P3 - Cam 14", status: "Active", icon: "fa-video" },
    { name: "Vendor Row - Cam 18", status: "Active", icon: "fa-video" },
  ];
  grid.innerHTML = cams.map(c => `
    <div class="camera-card">
      <div class="camera-feed"><i class="fas ${c.icon}"></i></div>
      <div class="camera-info"><strong>${c.name}</strong><span>${c.status}</span></div>
    </div>
  `).join("");
}

async function recommendSeats() {
  const priority = document.getElementById("seatPriority")?.value || "view";
  const groupSize = Number(document.getElementById("groupSize")?.value || 2);
  const budget = Number(document.getElementById("seatBudget")?.value || 140);

  try {
    const res = await fetch(`/api/recommend-seats?priority=${priority}&groupSize=${groupSize}&budget=${budget}`);
    const data = await res.json();
    const seatMap = document.getElementById("seatMap");
    if (!seatMap) return;
    seatMap.innerHTML = data.seats.map(s => {
      const cls = ["seat"];
      if (s.taken) cls.push("taken");
      if (s.tier === "premium") cls.push("premium");
      if (data.best.includes(s.id)) cls.push("best");
      return `<div class="${cls.join(" ")}" title="${currency(s.price)}">${s.id}</div>`;
    }).join("");

    showToast(`Best seats found: ${data.best.join(", ")}`, "success");
  } catch (e) { console.error(e); }
}

async function scanTicket() {
  const code = document.getElementById("ticketCode")?.value.trim().toUpperCase();
  if (!code) return;
  try {
    const res = await fetch(`/api/ticket-scan?code=${code}`);
    const data = await res.json();
    const result = document.getElementById("scanResult");
    if (result) {
      result.className = `scan-result ${data.className}`;
      result.innerHTML = `<strong>${data.status}</strong><span>${data.detail}</span>`;
    }
    showToast(`Scan: ${data.status}`, data.className === "valid" ? "success" : data.className === "warning" ? "warning" : "error");
  } catch (e) { console.error(e); }
}

// ========== RENDER ALL ==========
function renderAll() {
  renderClock();
  renderMetrics();
  renderStadiumMap();
  renderSelectedZone();
  renderAlerts();
  renderAnalyticsCards();
  renderChart();
  renderResources();
  renderActivity();
  renderForecasts();
  renderFanScore();
  renderTicketing();
  renderSchedule();
  renderReport();
  renderFanAssistant();
  renderSustainability();
  renderCameras();
}

// ========== EVENT BINDING ==========
function bindEvents() {
  // Navigation
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      const viewId = btn.dataset.view + "-view";
      const view = document.getElementById(viewId);
      if (view) view.classList.add("active");
    });
  });

  // Scenario select (Settings)
  const scenarioSelect = document.getElementById("scenarioSelect");
  if (scenarioSelect) {
    scenarioSelect.addEventListener("change", (e) => {
      postAction("set_scenario", { scenario: e.target.value });
      showToast(`Scenario changed to: ${e.target.value}`, "info");
    });
  }

  // Tick button
  const tickBtn = document.getElementById("tickButton");
  if (tickBtn) tickBtn.addEventListener("click", () => { postAction("tick"); showToast("Simulation advanced", "info"); });

  // Map mode tabs
  document.querySelectorAll("#mapTabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#mapTabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showToast(`Map mode: ${btn.textContent}`, "info");
    });
  });

  // View toggle (2D/3D)
  document.getElementById("view2D")?.addEventListener("click", function() {
    this.classList.add("active"); document.getElementById("view3D")?.classList.remove("active");
  });
  document.getElementById("view3D")?.addEventListener("click", function() {
    this.classList.add("active"); document.getElementById("view2D")?.classList.remove("active");
  });

  // Fullscreen map
  document.getElementById("fullscreenMap")?.addEventListener("click", () => {
    const board = document.getElementById("stadiumBoard");
    if (board) { if (document.fullscreenElement) document.exitFullscreen(); else board.requestFullscreen?.(); }
  });

  // Security tabs
  document.querySelectorAll(".sec-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sec-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // View Details
  document.getElementById("viewDetailsBtn")?.addEventListener("click", () => {
    if (appData.selectedZoneInfo) {
      showModal(`Zone: ${appData.selectedZoneInfo.name}`, `
        <p style="margin-bottom:12px"><strong>AI Recommended Action:</strong></p>
        <p style="color:var(--text-secondary);margin-bottom:16px">${appData.selectedZoneInfo.action}</p>
        <p><strong>Current Status:</strong> Active monitoring</p>
        <p style="color:var(--text-secondary);margin-top:8px">Sensors are reporting real-time density data. AI model is analyzing crowd patterns and predicting next 15-minute flow.</p>
      `);
    }
  });

  // View All Alerts
  document.getElementById("viewAllAlerts")?.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.getElementById("nav-alerts")?.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("alerts-view")?.classList.add("active");
  });

  // Quick Actions
  document.getElementById("qaOpenLane")?.addEventListener("click", () => {
    postAction("tick");
    showToast("Extra lane opened at North Gate", "success");
  });
  document.getElementById("qaSendAlert")?.addEventListener("click", () => {
    showToast("Emergency alert sent to all teams", "error");
  });
  document.getElementById("qaMessageTeam")?.addEventListener("click", () => {
    showModal("Message Team", `
      <textarea style="width:100%;min-height:120px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);color:var(--text-primary);padding:12px;font-family:var(--font);margin-bottom:12px" placeholder="Type your message to the operations team..."></textarea>
      <button onclick="showToast('Message sent to team', 'success'); closeModal();" style="padding:10px 20px;border-radius:var(--radius);background:linear-gradient(135deg,var(--accent-blue),var(--accent-cyan));color:#fff;font-weight:600;border:0;cursor:pointer">Send Message</button>
    `);
  });
  document.getElementById("qaGenerateReport")?.addEventListener("click", () => {
    showToast("Report generated successfully! Check Reports section.", "success");
  });

  // Auto-Optimize
  document.getElementById("autoOptimize")?.addEventListener("click", () => {
    showToast("Auto-optimization applied to all resources", "success");
    postAction("tick");
  });

  // View Detailed Report
  document.getElementById("viewDetailedReport")?.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.getElementById("nav-analytics")?.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("analytics-view")?.classList.add("active");
  });

  // View Live Feed
  document.getElementById("viewLiveFeed")?.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.getElementById("nav-monitoring")?.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("monitoring-view")?.classList.add("active");
  });

  // Budget readout
  document.getElementById("seatBudget")?.addEventListener("input", (e) => {
    document.getElementById("budgetReadout").textContent = `$${e.target.value}`;
  });

  // Seat recommend
  document.getElementById("recommendSeat")?.addEventListener("click", recommendSeats);

  // Ticket scan
  document.getElementById("scanTicket")?.addEventListener("click", scanTicket);

  // Optimize Schedule
  document.getElementById("optimizeSchedule")?.addEventListener("click", () => {
    postAction("optimize_schedule");
    showToast("Schedule optimized by AI", "success");
  });

  // Optimize Energy
  document.getElementById("optimizeEnergy")?.addEventListener("click", () => {
    postAction("optimize_energy");
    showToast("Energy optimization applied", "success");
  });

  // Chat form
  document.getElementById("chatForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;
    addMessage("user", text);
    input.value = "";
    try {
      const res = await fetch(`/api/chat?message=${encodeURIComponent(text)}`);
      const data = await res.json();
      setTimeout(() => addMessage("bot", data.reply), 300);
    } catch (err) { addMessage("bot", "Sorry, I couldn't process that request."); }
  });

  // Modal close
  document.getElementById("modalClose")?.addEventListener("click", closeModal);
  document.getElementById("modalOverlay")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("modalOverlay")) closeModal();
  });

  // Notification button
  document.getElementById("notifBtn")?.addEventListener("click", () => {
    showModal("Notifications", `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="alert-item"><span class="alert-severity high">HIGH</span><div class="alert-content"><strong>Security Alert</strong><span>Unattended object detected at West Stand</span></div></div>
        <div class="alert-item"><span class="alert-severity medium">MEDIUM</span><div class="alert-content"><strong>Crowd Alert</strong><span>North Gate queue rising above threshold</span></div></div>
        <div class="alert-item"><span class="alert-severity info">INFO</span><div class="alert-content"><strong>System Update</strong><span>Camera 14 firmware updated successfully</span></div></div>
      </div>
    `);
  });

  // Report card buttons
  document.querySelectorAll(".report-card .btn-primary-sm").forEach(btn => {
    btn.addEventListener("click", () => showToast("Report generation started...", "info"));
  });

  // Dark mode toggle
  document.getElementById("darkModeToggle")?.addEventListener("click", () => {
    showToast("Dark mode is always on for the command center!", "info");
  });

  // Window resize for chart
  window.addEventListener("resize", () => { setTimeout(renderChart, 200); });
}

// ========== INIT ==========
bindEvents();
fetchState();

// Auto-refresh every 30 seconds
setInterval(fetchState, 30000);
