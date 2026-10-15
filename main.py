from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import math

app = FastAPI()

app.mount("/static", StaticFiles(directory="."), name="static")

state = {
    "scenario": "normal",
    "mapMode": "crowd",
    "selectedZone": "north-gate",
    "optimizedSchedule": False,
    "energyOptimized": False,
    "tick": 0,
}

zones = [
    {"id": "north-gate", "name": "North Gate", "type": "Gate", "baseDensity": 74, "wait": 11, "x": 40, "y": 5, "action": "Open lane N2 and redirect arrivals to East Plaza"},
    {"id": "east-plaza", "name": "East Plaza", "type": "Concourse", "baseDensity": 58, "wait": 7, "x": 76, "y": 36, "action": "Move two stewards from South Gate to kiosk row E"},
    {"id": "south-gate", "name": "South Gate", "type": "Gate", "baseDensity": 42, "wait": 5, "x": 42, "y": 78, "action": "Keep standard flow and reserve overflow lane S1"},
    {"id": "west-stand", "name": "West Stand", "type": "Seating", "baseDensity": 65, "wait": 8, "x": 5, "y": 39, "action": "Send mobile vendors to section W14 before halftime"},
    {"id": "family-zone", "name": "Family Zone", "type": "Seating", "baseDensity": 38, "wait": 4, "x": 10, "y": 12, "action": "Recommend Family Gate for late arrivals with children"},
    {"id": "parking-p3", "name": "Parking P3", "type": "Parking", "baseDensity": 81, "wait": 15, "x": 76, "y": 7, "action": "Route incoming cars to P5 and start shuttle loop"},
    {"id": "vendor-row", "name": "Vendor Row", "type": "Food", "baseDensity": 69, "wait": 9, "x": 72, "y": 70, "action": "Increase fryer output and open express beverage queue"},
    {"id": "medical-bay", "name": "Medical Bay", "type": "Safety", "baseDensity": 21, "wait": 2, "x": 12, "y": 70, "action": "Keep clear path from West Stand and check AED station"},
]

scenarioEffects = {
    "normal": {"attendance": 48260, "risk": "Medium", "banner": "North Gate queue rising. Open overflow lane N2 and guide fans through East Plaza.", "density": {}},
    "gates": {"attendance": 50340, "risk": "Medium", "banner": "Gate scanners predict 18 minute peak at North Gate. Activate N2 and family fast lane.", "density": {"north-gate": 18, "parking-p3": 11, "south-gate": 8}},
    "halftime": {"attendance": 51210, "risk": "Medium", "banner": "Halftime demand spike detected. Shift staff to Vendor Row and restrooms near West Stand.", "density": {"vendor-row": 20, "west-stand": 12, "east-plaza": 10}},
    "weather": {"attendance": 47180, "risk": "High", "banner": "Rain cell arriving in 22 minutes. Delay outdoor activations and move fans through covered East Plaza.", "density": {"east-plaza": 18, "parking-p3": -7, "north-gate": 9}},
    "security": {"attendance": 48990, "risk": "High", "banner": "Suspicious object alert near West Stand service door. Create 30 meter buffer and route fans through South Gate.", "density": {"west-stand": 18, "medical-bay": 7, "south-gate": 12}},
}

alertsByScenario = {
    "normal": [["medium", "Camera N04", "Queue compression detected at North Gate lane N1."], ["low", "Sensor E12", "East Plaza flow stable with 26 percent spare capacity."], ["medium", "POS V07", "Vendor Row beverage demand running above model."]],
    "gates": [["high", "Gate N2", "Scanner throughput below target for three consecutive minutes."], ["medium", "Parking P3", "Occupancy at 91 percent. Shuttle loop recommended."], ["low", "Gate S1", "South Gate has available capacity for redirected arrivals."]],
    "halftime": [["medium", "Vendor Row", "Food queue wait projected to exceed 14 minutes."], ["medium", "Restroom W3", "Density rising after halftime whistle."], ["low", "Stand E", "Seat bowl flow normal."]],
    "weather": [["high", "Weather API", "Lightning risk increasing after 20:10 local time."], ["medium", "East Plaza", "Covered area density trending upward."], ["medium", "Ops", "Outdoor merchandise kiosks should close in 12 minutes."]],
    "security": [["critical", "Vision W08", "Unattended object near West Stand service door."], ["high", "Access C2", "Restricted corridor movement detected."], ["medium", "Medical Bay", "Medical response team staged and available."]],
}

forecasts = [
    ["Attendance", "51.2k peak attendance expected by kickoff", 86],
    ["Parking", "P3 reaches full capacity first; P5 has 42 percent reserve", 78],
    ["Food", "Beverage demand 19 percent above baseline during halftime", 72],
    ["Merchandise", "Home-team scarf stock will sell out near section E8", 64],
]

optimizerBase = [
    ["Crowd staff", "Move 6 stewards to North Gate until 19:10."],
    ["Inventory", "Send 180 extra beverage units to Vendor Row."],
    ["Parking", "Open P5 shuttle loop and update roadside signs."],
    ["Security", "Assign camera operator to West Stand service corridor."],
]

seats = [
    {"id": "A1", "tier": "premium", "price": 240, "tags": ["view"], "taken": False},
    {"id": "A2", "tier": "premium", "price": 240, "tags": ["view"], "taken": True},
    {"id": "A3", "tier": "premium", "price": 220, "tags": ["view"], "taken": False},
    {"id": "A4", "tier": "premium", "price": 220, "tags": ["view"], "taken": False},
    {"id": "B1", "tier": "standard", "price": 140, "tags": ["family"], "taken": False},
    {"id": "B2", "tier": "standard", "price": 140, "tags": ["family"], "taken": False},
    {"id": "B3", "tier": "standard", "price": 130, "tags": ["accessible"], "taken": False},
    {"id": "B4", "tier": "standard", "price": 130, "tags": ["accessible"], "taken": True},
    {"id": "C1", "tier": "budget", "price": 80, "tags": ["budget"], "taken": False},
    {"id": "C2", "tier": "budget", "price": 75, "tags": ["budget"], "taken": False},
    {"id": "C3", "tier": "budget", "price": 70, "tags": ["budget"], "taken": True},
    {"id": "C4", "tier": "budget", "price": 65, "tags": ["budget"], "taken": False},
    {"id": "D1", "tier": "standard", "price": 110, "tags": ["family", "budget"], "taken": False},
    {"id": "D2", "tier": "standard", "price": 110, "tags": ["family"], "taken": False},
    {"id": "D3", "tier": "standard", "price": 125, "tags": ["accessible"], "taken": False},
    {"id": "D4", "tier": "standard", "price": 125, "tags": ["accessible"], "taken": False},
]

ticketQueue = [
    ["CITY-FINAL-A12-8841", "Valid", "Section A12, scanner confidence 98 percent"],
    ["CITY-FINAL-B07-1290", "Duplicate", "Already scanned at Gate E3"],
    ["CITY-RESALE-X99-7001", "Review", "Unusual resale path and device mismatch"],
]

schedule = [
    {"match": "Semi-final A", "teams": "Coastal FC vs North City", "time": "16:00", "venue": "City Arena", "note": "High attendance, clear weather window"},
    {"match": "Semi-final B", "teams": "Metro United vs Highland SC", "time": "19:45", "venue": "City Arena", "note": "Travel buffer is tight for Highland SC"},
    {"match": "Final", "teams": "Winner A vs Winner B", "time": "20:00", "venue": "City Arena", "note": "Broadcast priority and maximum security staffing"},
    {"match": "Youth Showcase", "teams": "Academy Select vs Regional XI", "time": "13:00", "venue": "Training Pitch", "note": "Move if rain probability crosses 60 percent"},
]

fanRecommendations = [
    ["Fastest entry", "Use South Gate now. It is 6 minutes faster than North Gate."],
    ["Food", "Order from East Plaza kiosk E4 for the shortest pickup window."],
    ["Merchandise", "Scarf stock is strongest near section B10."],
    ["Facility", "Closest low-wait restroom from West Stand is W2."],
]

def clamp(value, min_val, max_val):
    return max(min_val, min(max_val, value))

def get_density_for(zone):
    effect = scenarioEffects[state["scenario"]]["density"].get(zone["id"], 0)
    wave = round(math.sin((state["tick"] + zone["baseDensity"]) / 2) * 3)
    return clamp(zone["baseDensity"] + effect + wave, 5, 99)

def get_wait_lift():
    if state["scenario"] == "gates": return 4
    if state["scenario"] == "halftime": return 3
    if state["scenario"] == "weather": return 2
    if state["scenario"] == "security": return 5
    return 0

@app.get("/")
def read_root():
    with open("index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read(), status_code=200)

@app.get("/api/state")
def get_state():
    current_zones = []
    wait_lift = get_wait_lift()
    for z in zones:
        density = get_density_for(z)
        if density >= 90: band = "critical"
        elif density >= 76: band = "high"
        elif density >= 52: band = "medium"
        else: band = "low"
        
        current_zones.append({
            **z,
            "currentDensity": density,
            "currentWait": z["wait"] + wait_lift,
            "band": band
        })
    
    avg_wait = round(sum(z["currentWait"] for z in current_zones) / len(current_zones))
    revenue = 318000 + state["tick"] * 9500 + (84000 if state["scenario"] == "halftime" else 0)
    
    selected_zone = next((z for z in current_zones if z["id"] == state["selectedZone"]), current_zones[0])
    
    scenario_info = scenarioEffects[state["scenario"]]
    
    alerts = alertsByScenario[state["scenario"]]
    
    scenario_line = []
    if state["scenario"] == "security":
        scenario_line = ["Emergency routing", "Close West Stand service corridor and publish alternate route."]
    elif state["scenario"] == "weather":
        scenario_line = ["Weather response", "Move exposed kiosks indoors and prepare covered concourses."]
    else:
        scenario_line = ["Fan flow", "Publish route notification to app users in sections N and E."]
    
    optimizer = [scenario_line] + optimizerBase
    
    optimized_times = ["15:30", "18:50", "20:15", "12:15"]
    current_schedule = []
    for idx, item in enumerate(schedule):
        time = optimized_times[idx] if state["optimizedSchedule"] else item["time"]
        if state["optimizedSchedule"]:
            if idx == 1: tag = "Travel buffer fixed"
            elif idx == 3: tag = "Rain-safe slot"
            else: tag = "Optimized"
        else:
            tag = "Current"
        current_schedule.append({**item, "time": time, "tag": tag})

    report = "AI post-match and operations brief\n\n"
    report += f"Current state: {state['scenario'].upper()} scenario with {scenario_info['risk'].lower()} operational risk.\n\n"
    report += "Crowd: North Gate and Parking P3 remain the main pressure points. Suggested action is to open overflow lanes and publish app reroutes.\n\n"
    report += "Security: Vision and access-control signals are being prioritized by severity. Human supervisors should confirm high-risk alerts before enforcement.\n\n"
    report += "Commercial: Food and beverage demand is above baseline. Move mobile vendors toward high-density concourses before halftime.\n\n"
    report += "Scheduling: Semi-final B moved earlier to restore team recovery and broadcast buffer.\n\n" if state["optimizedSchedule"] else "Scheduling: Current fixture plan is viable, but Semi-final B has a tight travel buffer.\n\n"
    report += "Next action: dispatch staff, refresh signage, and update fan assistant recommendations."
    
    energy = []
    if state["energyOptimized"]:
        energy = [
            ["Bowl lighting", "82 percent", "Dimmed non-broadcast zones while keeping pitch lighting stable."],
            ["HVAC", "68 percent", "Adjusted concourse cooling based on live density and weather."],
            ["Solar draw", "21 percent", "Battery discharge delayed until post-match peak."],
            ["Projected savings", "14.8 MWh", "Lower load without affecting safety or broadcast needs."],
        ]
    else:
        energy = [
            ["Bowl lighting", "96 percent", "Broadcast and seating zones running at event preset."],
            ["HVAC", "84 percent", "Concourse cooling follows standard occupancy plan."],
            ["Solar draw", "17 percent", "Battery discharge starts during halftime demand peak."],
            ["Projected savings", "7.1 MWh", "Optimization available for low-density concourses."],
        ]

    waste = [
        ["Smart bins", "North Gate bins at 74 percent. Dispatch cleaning in 18 minutes."],
        ["Recycling", "Projected diversion rate is 61 percent with current signage."],
        ["Carbon", "Event footprint forecast is 74 tCO2e, down 9 percent from baseline."],
        ["Water", "Restroom flow suggests 11 percent lower water use than comparable event."],
    ]

    return JSONResponse({
        "state": state,
        "zones": current_zones,
        "metrics": {
            "attendance": scenario_info["attendance"],
            "attendanceTrend": "-3 percent vs forecast" if state["scenario"] == "weather" else "+8 percent vs forecast",
            "averageWait": avg_wait,
            "waitTrend": f"{selected_zone['name']} selected",
            "risk": scenario_info["risk"],
            "riskTrend": f"{len(alerts)} active alerts",
            "revenue": revenue,
            "revenueTrend": "Food demand up 24 percent" if state["scenario"] == "halftime" else "Food demand up 14 percent"
        },
        "selectedZoneInfo": {
            "name": selected_zone["name"],
            "action": selected_zone["action"]
        },
        "alerts": alerts,
        "forecasts": forecasts,
        "optimizer": optimizer,
        "schedule": current_schedule,
        "report": report,
        "banner": scenario_info["banner"],
        "energy": energy,
        "waste": waste,
        "fanRecommendations": fanRecommendations,
        "ticketQueue": ticketQueue,
    })

class ActionModel(BaseModel):
    action: str
    payload: dict = {}

@app.post("/api/action")
def perform_action(req: ActionModel):
    action = req.action
    if action == "tick":
        state["tick"] += 1
    elif action == "set_scenario":
        state["scenario"] = req.payload.get("scenario", "normal")
        state["tick"] += 1
    elif action == "set_zone":
        state["selectedZone"] = req.payload.get("zone", "north-gate")
    elif action == "optimize_schedule":
        state["optimizedSchedule"] = True
    elif action == "optimize_energy":
        state["energyOptimized"] = True
    
    return JSONResponse({"status": "success"})

@app.get("/api/chat")
def get_chat_reply(message: str):
    query = message.lower()
    reply = "Best current advice: use South Gate, preorder from East Plaza E4, and watch for route notifications if North Gate density rises."
    if "gate" in query or "entry" in query:
        reply = "Use South Gate right now. North Gate is congested and the dashboard recommends routing arrivals through East Plaza."
    elif "food" in query or "drink" in query or "order" in query:
        reply = "East Plaza kiosk E4 has the shortest pickup window. Vendor Row is busy, so preorder pickup is better than walk-up."
    elif "seat" in query or "section" in query:
        reply = "For a balanced view and lower crowding, section B12 is the best current recommendation."
    elif "restroom" in query or "toilet" in query:
        reply = "Restroom W2 has the lowest wait near West Stand. Avoid W3 during halftime."
    elif "merch" in query or "scarf" in query or "shop" in query:
        reply = "The merchandise kiosk near B10 has strong stock and lighter queueing than the main store."
    elif "match" in query or "score" in query or "time" in query:
        reply = "Kickoff is scheduled for 20:00. If weather changes, the tournament ops panel will publish the revised time."
    elif "emergency" in query or "exit" in query:
        reply = "Follow the nearest green exit signs. If you are near West Stand, route toward South Gate and avoid the service corridor."
    
    return JSONResponse({"reply": reply})

@app.get("/api/recommend-seats")
def recommend_seats(priority: str, groupSize: int, budget: float):
    available = [s for s in seats if not s["taken"] and s["price"] <= budget]
    scored = []
    for s in available:
        score = 100 - abs(s["price"] - budget) / 4
        if priority in s["tags"]: score += 60
        if priority == "view" and s["tier"] == "premium": score += 45
        if priority == "budget" and s["price"] < 100: score += 40
        scored.append({"seat": s, "score": score})
    
    scored.sort(key=lambda x: x["score"], reverse=True)
    best = [x["seat"]["id"] for x in scored[:groupSize]]
    
    if not best:
        best = ["C1"]
        
    return JSONResponse({"seats": seats, "best": best})

@app.get("/api/ticket-scan")
def scan_ticket(code: str):
    import re
    input_code = code.strip().upper()
    status = "Valid ticket"
    detail = "Ticket pattern, gate history, and device fingerprint look consistent."
    className = "valid"

    if not re.match(r"^CITY-(FINAL|RESALE)-[A-Z][0-9]{2}-[0-9]{4}$", input_code):
        status = "Invalid format"
        detail = "The code does not match this tournament's signed ticket pattern."
        className = "danger"
    elif "B07" in input_code or input_code.endswith("1290"):
        status = "Duplicate ticket"
        detail = "This ticket was already scanned at Gate E3. Hold for supervisor review."
        className = "danger"
    elif "RESALE" in input_code or "X99" in input_code:
        status = "Review required"
        detail = "Resale chain and device fingerprint produce a medium fraud score."
        className = "warning"

    return JSONResponse({"status": status, "detail": detail, "className": className})

