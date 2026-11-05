const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('newspaper_ad_planner_jev_fixed.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) {
  console.error("FAIL: No script tag found in newspaper_ad_planner_jev_fixed.html");
  process.exit(1);
}

const jsCode = scriptMatch[1];
const mockStorage = {};
const mockElements = {};

function createMockEl(id) {
  return {
    id, value: '', textContent: '', innerHTML: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: { setProperty: () => {}, left: '', top: '', width: '', height: '' },
    addEventListener: () => {}, appendChild: () => {}, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 400 }),
    disabled: false, checked: false, files: []
  };
}

function getMockEl(id) {
  if (!mockElements[id]) mockElements[id] = createMockEl(id);
  return mockElements[id];
}

const sandbox = {
  document: { getElementById: getMockEl, querySelectorAll: () => [], createElement: getMockEl, addEventListener: () => {}, body: getMockEl('body') },
  window: { innerWidth: 1200, innerHeight: 800, addEventListener: () => {}, localStorage: { getItem: k => mockStorage[k] || null, setItem: (k, v) => { mockStorage[k] = v; }, removeItem: k => { delete mockStorage[k]; } } },
  localStorage: { getItem: k => mockStorage[k] || null, setItem: (k, v) => { mockStorage[k] = v; }, removeItem: k => { delete mockStorage[k]; } },
  location: { protocol: 'http:', hostname: '127.0.0.1' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, console,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  confirm: () => true
};

sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.location = sandbox.location;

const script = new vm.Script(jsCode);
const context = vm.createContext(sandbox);
script.runInContext(context);

const pt = sandbox.window.plannerTest;
let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log("  PASS:", msg);
    passed++;
  } else {
    console.error("  FAIL:", msg);
    failed++;
  }
}

// ==========================================
// Test Suite 1: Standard 12-ad packing test
// ==========================================
console.log("Test Suite 1: Standard 12-ad packing test");
const ads12 = `Century 8x25 Noodles (Pg 1)
Namaste 6x15 Bank
Kantipur 2x15 Telecom
Himalayan 5x12 Cement
Everest 3x12 Insurance
Gorkha 4x10 Brewery
Pashupati 4x10 Paints
Lumbini 4x8 Steel
Annapurna 4x8 Travels
Boudha 3x10 Handicrafts
Pokhara 2x10 Hotel
Janakpur 1x10 Mithila Art (Pg 2)`;

const parsed = pt.parse(ads12);
assert(parsed.ads.length === 12, "Parsed 12 ads successfully");
assert(parsed.errors.length === 0, "Zero parse errors for standard ads");

const state = {
  version: 3,
  ads: parsed.ads,
  placements: [],
  pageCount: 4,
  enabled: [1, 2, 3, 4],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: ads12,
  placeAdsByPageTag: true
};

pt.setState(state);
const plan = pt.autoPlan([]);
assert(plan.count === 12, "All 12 standard ads successfully placed");

for (const pg of [1, 2, 3, 4]) {
  const onPg = plan.ps.filter(p => p.page === pg);
  assert(pt.geometryOK(onPg), `Page ${pg} layout has full bottom support with no overlaps`);
}

// ==========================================
// Test Suite 2: 8x50 Exceptional Single Page Ad
// ==========================================
console.log("\nTest Suite 2: 8x50 Exceptional Single Page Advertisement");
const input8x50 = `MegaAd 8x50 National Festival (Pg 1)
Century 8x25 Noodles (Pg 2)
Namaste 6x15 Bank
Everest 2x15 Telecom`;

const parsed50 = pt.parse(input8x50);
assert(parsed50.ads.length === 4, "Parsed 4 ads including 8x50");
assert(parsed50.errors.length === 0, "8x50 ad parsed without error");
assert(parsed50.ads[0].w === 8 && parsed50.ads[0].h === 50, "8x50 ad has w=8, h=50");

const state50 = {
  version: 3,
  ads: parsed50.ads,
  placements: [],
  pageCount: 4,
  enabled: [1, 2, 3, 4],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: input8x50,
  placeAdsByPageTag: true
};

pt.setState(state50);
const plan50 = pt.autoPlan([]);
assert(plan50.count === 4, "All 4 ads placed including 8x50");

const p1Ads = plan50.ps.filter(p => p.page === 1);
assert(p1Ads.length === 1, "Page 1 has exclusively 1 advertisement");
const adP1 = parsed50.ads.find(a => a.id === p1Ads[0].id);
assert(adP1.w === 8 && adP1.h === 50, "Page 1 advertisement is the 8x50 full-page ad");
assert(p1Ads[0].x === 0 && p1Ads[0].y === 0, "8x50 ad positioned at (0, 0)");

pt.setState({ ...state50, placements: plan50.ps });
assert(pt.pageHeight(1) === 50, "Page 1 height readjusted to 50 cm");
assert(pt.pageMaxCC(1) === 400, "Page 1 max capacity readjusted to 400 CC");
assert(pt.pageHeight(2) === 48, "Page 2 height remains 48 cm standard");
assert(pt.pageMaxCC(2) === 384, "Page 2 max capacity remains 384 CC standard");

for (const pg of [1, 2, 3, 4]) {
  const onPg = plan50.ps.filter(p => p.page === pg);
  assert(pt.geometryOK(onPg), `Page ${pg} geometry is 100% valid with full bottom support`);
}

// ==========================================
// Test Suite 3: Manual proposal for 8x50 constraints
// ==========================================
console.log("\nTest Suite 3: Manual Single-Page Constraints for 8x50");
const tryAddOnP1 = pt.manualProposal('a1', 1, 0, 0);
assert(tryAddOnP1 === null, "Manual placement refuses an 8-column ad: the 8x50 fills every column");
const trySmallOnP1 = pt.manualProposal('a3', 1, 7, 0);
assert(trySmallOnP1 === null, "Manual placement refuses any ad: the 8x50 leaves no free columns");

// ==========================================
// Test Suite 4: Non-8-column x 50cm ads (any width x 50 is valid)
// ==========================================
console.log("\nTest Suite 4: Non-8-column x 50cm ads (any width x 50 is valid)");

const widths50 = [1, 2, 3, 4, 5, 6, 7, 8];
for (const w of widths50) {
  const r = pt.parse(`Agency ${w}x50 Client`);
  assert(r.ads.length === 1 && r.errors.length === 0, `${w}x50 parses as valid`);
  assert(r.ads[0].w === w && r.ads[0].h === 50, `${w}x50 has correct dimensions`);
}

for (const w of [1, 4, 8]) {
  const r = pt.parse(`Agency ${w}x49 Client`);
  assert(r.ads.length === 1 && r.errors.length === 0, `${w}x49 parses as valid`);
}

const invalid51 = pt.parse("Agency 8x51 Client");
assert(invalid51.errors.length > 0, "8x51 ad correctly rejected (exceeds 50 cm)");
const invalid51b = pt.parse("Agency 3x51 Client");
assert(invalid51b.errors.length > 0, "3x51 ad correctly rejected (exceeds 50 cm)");

// 4d. Place a 3x50 ad — should be sole ad on page
console.log("\n  Testing 3x50 placement...");
const input3x50 = `SpecialAd 3x50 National Day (Pg 1)
Century 8x25 Noodles (Pg 2)
Namaste 6x15 Bank`;

const parsed3x50 = pt.parse(input3x50);
assert(parsed3x50.ads.length === 3, "Parsed 3 ads including 3x50");
assert(parsed3x50.errors.length === 0, "3x50 parses without error");

const state3x50 = {
  version: 3,
  ads: parsed3x50.ads,
  placements: [],
  pageCount: 4,
  enabled: [1, 2, 3, 4],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: input3x50,
  placeAdsByPageTag: true
};

pt.setState(state3x50);
const plan3x50 = pt.autoPlan([]);
assert(plan3x50.count === 3, "All 3 ads placed including 3x50");

const p1_3x50 = plan3x50.ps.filter(p => p.page === 1);
assert(p1_3x50.length === 1, "Page 1 has exclusively 1 advertisement (3x50)");
const ad3x50 = parsed3x50.ads.find(a => a.id === p1_3x50[0].id);
assert(ad3x50.w === 3 && ad3x50.h === 50, "Page 1 advertisement is the 3x50 ad");
assert(p1_3x50[0].x === 0 && p1_3x50[0].y === 0, "3x50 ad positioned at (0, 0)");

pt.setState({ ...state3x50, placements: plan3x50.ps });
assert(pt.pageHeight(1) === 50, "Page 1 height is 50 cm for 3x50 ad");
assert(pt.pageMaxCC(1) === 400, "Page 1 max CC is 400 for 50cm page");

const tryAdd3x50 = pt.manualProposal('a1', 1, 3, 0);
assert(tryAdd3x50 === null, "Manual placement refuses adding second ad to 3x50 page");

// 4e. Place a 5x50 ad
console.log("\n  Testing 5x50 placement...");
const input5x50 = `BigAd 5x50 Grand Opening (Pg 2)
Namaste 6x15 Bank
Everest 2x15 Telecom`;

const parsed5x50 = pt.parse(input5x50);
assert(parsed5x50.ads.length === 3, "Parsed 3 ads including 5x50");

const state5x50 = {
  version: 3,
  ads: parsed5x50.ads,
  placements: [],
  pageCount: 4,
  enabled: [1, 2, 3, 4],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: input5x50,
  placeAdsByPageTag: true
};

pt.setState(state5x50);
const plan5x50 = pt.autoPlan([]);
assert(plan50.count === 4, "Plan succeeds");
const p2_5x50 = plan5x50.ps.filter(p => p.page === 2);
assert(p2_5x50.length === 1, "Page 2 has exclusively 1 advertisement (5x50)");
const ad5x50 = parsed5x50.ads.find(a => a.id === p2_5x50[0].id);
assert(ad5x50.w === 5 && ad5x50.h === 50, "Page 2 advertisement is the 5x50 ad");

pt.setState({ ...state5x50, placements: plan5x50.ps });
assert(pt.pageHeight(2) === 50, "Page 2 height is 50 cm for 5x50 ad");

// 4f. Multiple 50cm ads on different pages
console.log("\n  Testing multiple 50cm ads on separate pages...");
const inputMulti50 = `SpecialA 3x50 Event A (Pg 1)
SpecialB 5x50 Event B (Pg 2)
SpecialC 8x50 Event C (Pg 3)
Namaste 6x15 Bank`;

const parsedMulti50 = pt.parse(inputMulti50);
assert(parsedMulti50.ads.length === 4, "Parsed 4 ads with multiple 50cm widths");
assert(parsedMulti50.errors.length === 0, "Multiple 50cm ads parse without error");

const stateMulti50 = {
  version: 3,
  ads: parsedMulti50.ads,
  placements: [],
  pageCount: 4,
  enabled: [1, 2, 3, 4],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: inputMulti50,
  placeAdsByPageTag: true
};

pt.setState(stateMulti50);
const planMulti50 = pt.autoPlan([]);
assert(planMulti50.count === 4, "All 4 ads placed (3x50, 5x50, 8x50, and normal)");

for (const pg of [1, 2, 3]) {
  const onPg = planMulti50.ps.filter(p => p.page === pg);
  assert(onPg.length === 1, `Page ${pg} has exactly 1 ad (50cm single-page)`);
  const theAd = parsedMulti50.ads.find(a => a.id === onPg[0].id);
  assert(theAd.h === 50, `Page ${pg} ad is 50cm tall`);
}

const p4normal = planMulti50.ps.filter(p => p.page === 4);
assert(p4normal.length === 1, "Page 4 has the normal ad");
assert(parsedMulti50.ads.find(a => a.id === p4normal[0].id).h === 15, "Page 4 ad is 15cm (normal)");

pt.setState({ ...stateMulti50, placements: planMulti50.ps });
for (const pg of [1, 2, 3, 4]) {
  const onPg = planMulti50.ps.filter(p => p.page === pg);
  assert(pt.geometryOK(onPg), `Page ${pg} geometry valid`);
}

// ==========================================
// Test Suite 5: Multiple ads cannot stack to 50cm height
// ==========================================
console.log("\nTest Suite 5: Multiple ads cannot stack to 50cm height");

const inputStack = `Ad1 8x25 Client1
Ad2 8x24 Client2`;

const parsedStack = pt.parse(inputStack);
assert(parsedStack.ads.length === 2, "Parsed 2 stacking ads");

const stateStack = {
  version: 3,
  ads: parsedStack.ads,
  placements: [],
  pageCount: 1,
  enabled: [1],
  normalCap: 260,
  fullPages: [1],
  today: '2026-11-03',
  input: inputStack,
  placeAdsByPageTag: false
};

pt.setState(stateStack);
const planStack = pt.autoPlan([]);
assert(planStack.count < 2, "Cannot stack two large normal ads to exceed 48cm on one page");

pt.setState({ ...stateStack, placements: planStack.ps });
assert(pt.pageHeight(1) === 48, "Page stays at 48cm even with large normal ads (no 50cm inflation)");

// ==========================================
// Test Suite 6: 1x50 single column exceptional ad shares its page
// ==========================================
console.log("\nTest Suite 6: 1x50 single column exceptional ad shares its page");
const input1x50 = `TinyTall 1x50 VerticalAd (Pg 1)
Namaste 6x15 Bank`;

const parsed1x50 = pt.parse(input1x50);
assert(parsed1x50.ads.length === 2, "Parsed 2 ads including 1x50");
assert(parsed1x50.errors.length === 0, "1x50 parsed without error");
assert(parsed1x50.ads[0].w === 1 && parsed1x50.ads[0].h === 50, "1x50 has correct dimensions");

// Only page 1 is enabled, so the 6x15 must use the free columns beside the 1x50.
const state1x50 = {
  version: 3,
  ads: parsed1x50.ads,
  placements: [],
  pageCount: 1,
  enabled: [1],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: input1x50,
  placeAdsByPageTag: true
};

pt.setState(state1x50);
const plan1x50 = pt.autoPlan([]);
assert(plan1x50.count === 2, "Both ads placed (6x15 shares page 1 beside the 1x50)");

const p1_1x50 = plan1x50.ps.filter(p => p.page === 1);
assert(p1_1x50.length === 2, "Page 1 hosts both the 1x50 and the 6x15");
const tallPos = p1_1x50.find(p => parsed1x50.ads.find(a => a.id === p.id).h === 50);
const sidePos = p1_1x50.find(p => parsed1x50.ads.find(a => a.id === p.id).h === 15);
assert(tallPos && tallPos.x === 0 && tallPos.y === 0, "1x50 stands at column 1 on the floor");
assert(sidePos && sidePos.x === 1 && sidePos.y === 0, "6x15 fills the free columns beside the 1x50");
assert(pt.geometryOK(p1_1x50), "Shared page has full bottom support and no overlaps");

pt.setState({ ...state1x50, placements: plan1x50.ps });
assert(pt.pageHeight(1) === 50, "Page 1 height is 50 cm for 1x50 ad");
assert(pt.pageMaxCC(1) === 400, "Page 1 max CC is 400");
try {
  pt.validate(pt.getState());
  assert(true, "validate() accepts a 50 cm page shared by two ads");
} catch (e) {
  assert(false, "validate() accepts a 50 cm page shared by two ads — " + e.message);
}

// ==========================================
// Test Suite 7: Direct Placement of (Pg n) tagged ads
// ==========================================
console.log("\nTest Suite 7: Direct Placement of (Pg n) tagged ads");
const taggedInput = `Century 8x25 Noodles (Pg 3)
Kathmandu 4x15 Bank (Pg 3)
Himal 4x15 Telecom (Pg 3)
BigBrand 8x50 Exceptional (Pg 4)`;

const parsedTagged = pt.parse(taggedInput);
assert(parsedTagged.ads.length === 4, "Parsed 4 tagged ads");

const stateDirect = {
  version: 3,
  ads: parsedTagged.ads,
  placements: [],
  pageCount: 4,
  enabled: [1, 2, 3, 4],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: taggedInput,
  placeAdsByPageTag: true
};

pt.setState(stateDirect);
const placedCount = pt.placeTaggedAdsDirectly();
assert(placedCount === 4, "All 4 tagged ads directly placed onto their respective pages");

// Verify Page 3 has the 3 normal ads
const p3Placements = pt.getState().placements.filter(p => p.page === 3);
assert(p3Placements.length === 3, "Page 3 has exactly the 3 tagged ads");
assert(pt.geometryOK(p3Placements), "Page 3 placements have 100% valid bottom support");

// Verify Page 4 has exclusively the 8x50 exceptional ad
const p4Placements = pt.getState().placements.filter(p => p.page === 4);
assert(p4Placements.length === 1, "Page 4 has exclusively the 8x50 ad");
assert(pt.getState().ads.find(a => a.id === p4Placements[0].id).h === 50, "Page 4 ad is the 50cm ad");
assert(pt.pageHeight(4) === 50, "Page 4 height is 50 cm");

// Verify Page 1 and 2 are empty
assert(pt.getState().placements.filter(p => p.page === 1).length === 0, "Page 1 is empty as expected");
assert(pt.getState().placements.filter(p => p.page === 2).length === 0, "Page 2 is empty as expected");

// ==========================================
// Test Suite 8: 5x50 ad shares its page with ads in the remaining columns
// ==========================================
console.log("\nTest Suite 8: 5x50 ad shares its page with ads in the remaining columns");

const inputShare = `BigAd 5x50 Grand Opening (Pg 1)
SideAd 3x47 Local Bank`;

const parsedShare = pt.parse(inputShare);
assert(parsedShare.ads.length === 2 && parsedShare.errors.length === 0, "5x50 and 3x47 parsed without error");

const stateShare = {
  version: 3,
  ads: parsedShare.ads,
  placements: [],
  pageCount: 1,
  enabled: [1],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: inputShare,
  placeAdsByPageTag: true
};

// 8a. Automatic placement fills the 3 free columns beside the 5x50
pt.setState(stateShare);
const planShare = pt.autoPlan([]);
assert(planShare.count === 2, "Automatic placement places both the 5x50 and the 3x47");
const p1Share = planShare.ps.filter(p => p.page === 1);
assert(p1Share.length === 2, "Page 1 hosts the 5x50 and the 3x47 together");
const share50 = p1Share.find(p => parsedShare.ads.find(a => a.id === p.id).h === 50);
const shareSide = p1Share.find(p => parsedShare.ads.find(a => a.id === p.id).h === 47);
assert(share50 && share50.x === 0 && share50.y === 0, "5x50 stands on the floor of columns 1-5");
assert(shareSide && shareSide.x === 5 && shareSide.y === 0, "3x47 fills the remaining 3 columns beside it");
assert(pt.geometryOK(p1Share), "Shared page has full bottom support and no overlaps");
pt.setState({ ...stateShare, placements: planShare.ps });
assert(pt.pageHeight(1) === 50 && pt.pageMaxCC(1) === 400, "Shared page is an exceptional 50 cm page (400 CC)");
try {
  pt.validate(pt.getState());
  assert(true, "validate() accepts the shared 50 cm page");
} catch (e) {
  assert(false, "validate() accepts the shared 50 cm page — " + e.message);
}

// 8b. Manual: place the 5x50, then fill the leftover space manually
pt.setState(stateShare);
assert(pt.placeManual(parsedShare.ads[0].id, 1), "Manual placement accepts the 5x50");
assert(pt.placeManual(parsedShare.ads[1].id, 1), "Manual placement accepts the 3x47 in the leftover space");
const manualP1 = pt.getState().placements.filter(p => p.page === 1);
assert(manualP1.length === 2 && pt.geometryOK(manualP1), "Manual shared page is fully supported");
const mSide = manualP1.find(p => p.id === parsedShare.ads[1].id);
assert(mSide && mSide.x === 5 && mSide.y === 0, "Manual 3x47 settles beside the 5x50 at column 6");

// 8c. Manual drop with an explicit column honours a free strip anywhere on the page
pt.setState({ ...stateShare, placements: [] });
assert(pt.placeManual(parsedShare.ads[0].id, 1, 3, 0), "5x50 dropped at column 4 when its strip is free");
assert(pt.getState().placements.some(p => p.id === parsedShare.ads[0].id && p.x === 3 && p.y === 0), "5x50 kept at the dropped column 4");
assert(pt.placeManual(parsedShare.ads[1].id, 1, 0, 0), "3x47 accepted at columns 1-3 beside the right-standing 5x50");
assert(pt.geometryOK(pt.getState().placements.filter(p => p.page === 1)), "Explicit-column shared layout is fully supported");

// 8d. No space left beside the 5x50: further ads are refused
const lateAd = { id: 'a2', agency: 'LateAd', client: 'Late Client', w: 1, h: 10, order: 2, sourceText: 'LateAd 1x10 Late Client' };
pt.setState({ ...stateShare, ads: [...parsedShare.ads, lateAd], placements: planShare.ps });
assert(pt.manualProposal('a2', 1, 7, 0) === null, "Refuses a drop when every column is already filled");
assert(pt.manualProposal('a2', 1) === null, "Strip scan also refuses when the page has no free columns");

// 8e. Companions may stack beside the 50 cm ad up to the 50 cm page height
const parsedStack50 = pt.parse(`BigAd 5x50 Grand Opening
LowAd 3x30 Base Client
TopAd 3x17 Top Client`);
assert(parsedStack50.ads.length === 3 && parsedStack50.errors.length === 0, "Stacking list parsed");
pt.setState({
  version: 3,
  ads: parsedStack50.ads,
  placements: [],
  pageCount: 1,
  enabled: [1],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: 'BigAd 5x50 Grand Opening\nLowAd 3x30 Base Client\nTopAd 3x17 Top Client',
  placeAdsByPageTag: false
});
assert(pt.placeManual(parsedStack50.ads[0].id, 1), "5x50 placed for stacking test");
assert(pt.placeManual(parsedStack50.ads[1].id, 1, 5, 0), "3x30 placed beside the 5x50");
assert(pt.placeManual(parsedStack50.ads[2].id, 1, 5, 30), "3x17 stacked on the 3x30 beside the 5x50 (top 47 of 50 cm)");
const stackP1 = pt.getState().placements.filter(p => p.page === 1);
assert(stackP1.length === 3 && pt.geometryOK(stackP1), "Three ads sharing the 50 cm page are fully supported");
const overTall = pt.parse(`BigAd 5x50 Grand Opening
LowAd 3x30 Base Client
OverAd 3x21 Too Tall Client`);
pt.setState({
  version: 3,
  ads: overTall.ads,
  placements: [],
  pageCount: 1,
  enabled: [1],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: 'BigAd 5x50 Grand Opening\nLowAd 3x30 Base Client\nOverAd 3x21 Too Tall Client',
  placeAdsByPageTag: false
});
pt.placeManual(overTall.ads[0].id, 1);
pt.placeManual(overTall.ads[1].id, 1, 5, 0);
assert(pt.manualProposal(overTall.ads[2].id, 1, 5, 30) === null, "3x21 cannot stack to 51 cm beside the 5x50 (50 cm page limit)");

// 8f. Tagged routing: the 5x50 and a tagged companion share their tagged page
const inputTagShare = `BigAd 5x50 Grand Opening (Pg 2)
SideAd 3x47 Local Bank (Pg 2)`;
const parsedTagShare = pt.parse(inputTagShare);
assert(parsedTagShare.ads.length === 2 && parsedTagShare.errors.length === 0, "Tagged sharing list parsed");
pt.setState({
  version: 3,
  ads: parsedTagShare.ads,
  placements: [],
  pageCount: 3,
  enabled: [1, 2, 3],
  normalCap: 260,
  fullPages: [],
  today: '2026-11-03',
  input: inputTagShare,
  placeAdsByPageTag: true
});
const placedTagShare = pt.placeTaggedAdsDirectly();
assert(placedTagShare === 2, "Tagged 5x50 and tagged 3x47 both placed on their tagged page");
const tagP2 = pt.getState().placements.filter(p => p.page === 2);
assert(tagP2.length === 2 && pt.geometryOK(tagP2), "Tagged page 2 hosts the 5x50 and the 3x47 together");

// ==========================================
// Summary
// ==========================================
console.log(`\nVerification Suite Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
