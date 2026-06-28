import { applyResults, knockoutMatches, qualifiedTeams, roundOf32Teams, shuffle } from "./logic.js";

const players = [
  "Nabil", "Stephanie", "Dave", "Kristin", "Dominick", "Ben", "Matthew W", "Kevin",
  "LJ", "Jonathan", "Alyssa", "Nick Schoggins", "Michelle", "Matthew W", "Matt Brown",
  "Michael", "Yegor", "Justin", "Jess", "Caity", "Yvonne", "Yegor", "Stephanie",
  "Shannon", "Christian", "Srikanth", "Haylee", "Nabil", "Nelly", "Daves Nick", "Scott", "Cathy"
];

const stageNames = {
  R32: "Round of 32", R16: "Round of 16", QF: "Quarterfinal", SF: "Semifinal",
  FOURTH: "Fourth place", THIRD: "Third place", FINAL: "Final", RUNNER_UP: "Runner-up",
  CHAMPION: "Champion", OUT: "Eliminated"
};
const stageRank = ["CHAMPION", "RUNNER_UP", "THIRD", "FOURTH", "FINAL", "SF", "QF", "R16", "R32", "OUT"];
const storageKey = "the32-pool";
const syncKey = "the32-last-sync";
const espnUrl = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=2026&limit=200";
const localEntries = JSON.parse(localStorage.getItem(storageKey) || "null");
let entries = players.map((player, index) => ({ number: index + 1, player, team: "", stage: "R32" }));
let qualifiers = [];
let qualifiersLoaded = false;
let tournamentEvents = [];
let isAdmin = false;

const $ = (selector) => document.querySelector(selector);
const drawn = () => entries.every((entry) => entry.team);
const save = async () => {
  if (isAdmin) {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries })
    });
    if (!response.ok) throw new Error((await response.json()).error || "Could not save shared state");
  }
  localStorage.setItem(storageKey, JSON.stringify(entries));
};
const loadSharedEntries = async () => {
  const response = await fetch("/api/state");
  if (!response.ok) return;
  const state = await response.json();
  if (!state.entries) return;
  entries = tournamentEvents.length ? applyResults(state.entries, tournamentEvents).entries : state.entries;
  localStorage.setItem(storageKey, JSON.stringify(entries));
};
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
})[character]);
const formatKickoff = (date) => new Intl.DateTimeFormat([], {
  weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
}).format(new Date(date));
const sameDay = (left, right) => left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

function card(entry) {
  const label = entry.stage === "OUT" ? "Sent home" :
    entry.stage === "CHAMPION" ? "Champion!" :
      ["RUNNER_UP", "THIRD", "FOURTH"].includes(entry.stage) ? stageNames[entry.stage] : "Still alive";
  return `<article class="entry-card ${entry.stage === "OUT" ? "out" : ""}">
    <span class="entry-number">${String(entry.number).padStart(2, "0")}</span>
    <div><b>${escapeHtml(entry.player)}</b><small>${escapeHtml(entry.team || "Team pending")}</small></div>
    <em>${label}</em>
  </article>`;
}

function matchup(match, compact = false) {
  const live = match.state === "in";
  const status = match.completed ? "Full time" : live ? `Live ${match.clock}` : formatKickoff(match.date);
  return `<article class="match-card ${live ? "live" : ""} ${compact ? "compact" : ""}">
    <header><span>${status}</span>${live ? "<b>LIVE</b>" : ""}</header>
    ${match.sides.map((side) => `<div class="match-side ${side.winner ? "winner" : ""}">
      ${side.flag ? `<img src="${escapeHtml(side.flag)}" alt="">` : `<span class="team-tbd">?</span>`}
      <div><b>${escapeHtml(side.entry?.player || "Waiting on winner")}</b>
        <small>${escapeHtml(side.team)}</small></div>
      ${match.state !== "pre" ? `<strong>${escapeHtml(side.score)}</strong>` : ""}
      ${match.completed ? `<em>${side.winner ? "Through!" : "Sent home"}</em>` : ""}
    </div>`).join("")}
  </article>`;
}

function showDrawReveal() {
  const dialog = $("#drawDialog");
  const flags = new Map(qualifiers.map((team) => [team.name, team.flag]));
  let index = 0;
  let timer;
  const reveal = () => {
    const entry = entries[index];
    const panel = $(".draw-reveal");
    panel.classList.remove("pop");
    void panel.offsetWidth;
    panel.classList.add("pop");
    $("#revealCount").textContent = `${index + 1} / ${entries.length}`;
    $("#revealNumber").textContent = String(entry.number).padStart(2, "0");
    $("#revealPlayer").textContent = entry.player;
    $("#revealTeam").textContent = entry.team;
    $("#revealFlag").src = flags.get(entry.team) || "";
    index++;
    if (index === entries.length) {
      clearInterval(timer);
      $("#revealButton").innerHTML = "Enter the bracket <b>→</b>";
    }
  };
  $("#revealButton").innerHTML = "Reveal all now <b>→</b>";
  $("#revealButton").onclick = () => {
    if (index < entries.length) {
      clearInterval(timer);
      while (index < entries.length) reveal();
    } else {
      dialog.close();
    }
  };
  dialog.showModal();
  reveal();
  timer = setInterval(reveal, matchMedia("(prefers-reduced-motion: reduce)").matches ? 30 : 260);
}

function render() {
  const hasDrawn = drawn();
  $("#drawButton").hidden = hasDrawn || !isAdmin;
  $("#drawButton").disabled = !hasDrawn && qualifiers.length !== 32;
  $("#drawButton span").textContent = qualifiers.length === 32
    ? "Run the draw"
    : qualifiersLoaded ? "Draw unlocks when all 32 are in" : "Checking qualified teams…";
  $("#updateButton").disabled = !hasDrawn;
  $("#manualButton").disabled = !hasDrawn;
  $("#manualButton").hidden = !hasDrawn || !isAdmin;
  $("#manualButton").textContent = "Admin edit";
  const lastSync = localStorage.getItem(syncKey);
  $("#drawNote").textContent = hasDrawn
    ? `Draw complete · ${lastSync ? `ESPN synced ${new Date(lastSync).toLocaleString()}` : "ready to sync with ESPN"}`
    : `${qualifiers.length} of 32 teams locked in · no draw until the field is complete.`;
  $(".live-pill").innerHTML = `<span></span> ${hasDrawn ? "Tournament live" : "Draw pending"}`;
  $(".live-pill span").style.background = hasDrawn ? "var(--lime)" : "#ffbe41";

  $("#entriesView").innerHTML = `<div class="entries-grid">${entries.map(card).join("")}</div>`;
  if (!hasDrawn) {
    $("#bracketView").innerHTML = `<div class="qualifier-board">
      <div class="qualifier-heading">
        <div><p class="eyebrow">THE FIELD IS TAKING SHAPE</p>
          <h3>${qualifiers.length ? `${qualifiers.length} teams are in` : "Waiting for the first tickets"}</h3>
          <p>${32 - qualifiers.length} spots remain before the draw.</p>
        </div>
        <strong>${qualifiers.length}<span>/32</span></strong>
      </div>
      <div class="qualifier-progress"><span style="width:${qualifiers.length / 32 * 100}%"></span></div>
      <div class="qualifier-grid">${qualifiers.map((team) =>
        `<div class="qualifier"><img src="${escapeHtml(team.flag)}" alt="" loading="lazy"><b>${escapeHtml(team.name)}</b><i>✓</i></div>`
      ).join("")}${Array.from({ length: 32 - qualifiers.length }, () =>
        `<div class="qualifier pending"><span aria-hidden="true">?</span><b>Still up for grabs</b></div>`
      ).join("")}</div>
    </div>`;
    return;
  }

  const matches = knockoutMatches(entries, tournamentEvents);
  const today = matches.filter((match) => sameDay(new Date(match.date), new Date()));
  const featured = today.length ? today : matches.filter((match) =>
    match.state === "pre" && new Date(match.date) > new Date()
  ).slice(0, 2);
  const rounds = [
    [["round-of-32"], "Round of 32"], [["round-of-16"], "Round of 16"],
    [["quarterfinals"], "Quarterfinals"], [["semifinals"], "Semifinals"],
    [["3rd-place-match", "final"], "Final weekend"]
  ];
  $("#bracketView").innerHTML = `${featured.length ? `<section class="today">
    <header><div><p class="eyebrow">${today.length ? "TODAY'S MATCHES" : "UP NEXT"}</p>
      <h3>${today.length ? "Something on every match" : "The next battles"}</h3></div>
      <span>${today.length ? `${today.length} today` : formatKickoff(featured[0].date)}</span></header>
    <div>${featured.map((match) => matchup(match, true)).join("")}</div>
  </section>` : ""}
  <div class="rounds">${rounds.map(([stages, label]) => {
    const visible = matches.filter((match) => stages.includes(match.stage));
    return `<section class="round"><header class="round-head"><b>${label}</b><span>${visible.length} matches</span></header>
      <div class="round-list">${visible.length ? visible.map((match) => matchup(match)).join("") : `<div class="empty-board"><p>Fixtures coming soon.</p></div>`}</div>
    </section>`;
  }).join("")}</div>`;
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2400);
}

$("#drawButton").addEventListener("click", async () => {
  const button = $("#drawButton");
  button.disabled = true;
  button.querySelector("span").textContent = "Fetching ESPN teams…";
  try {
    const response = await fetch(espnUrl);
    if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
    const events = (await response.json()).events || [];
    tournamentEvents = events;
    qualifiers = qualifiedTeams(events);
    const teams = roundOf32Teams(events);
    if (!teams.length) {
      toast("The Round of 32 is not fully set yet · try again later");
      return;
    }
    const assigned = shuffle(teams);
    entries = entries.map((entry, index) => ({ ...entry, team: assigned[index], stage: "R32" }));
    await save();
    render();
    showDrawReveal();
    toast("ESPN teams fetched · the draw is complete");
  } catch (error) {
    console.error(error);
    await loadSharedEntries();
    toast(error.message || "Could not run the draw");
  } finally {
    qualifiersLoaded = true;
    render();
  }
});

$("#updateButton").addEventListener("click", async () => {
  const button = $("#updateButton");
  button.disabled = true;
  button.textContent = "Syncing…";
  try {
    const response = await fetch(espnUrl);
    if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
    const data = await response.json();
    tournamentEvents = data.events || [];
    const result = applyResults(entries, tournamentEvents);
    entries = result.entries;
    await save();
    localStorage.setItem(syncKey, new Date().toISOString());
    render();
    const warning = result.unmatched.length ? ` · ${result.unmatched.length} unmatched team(s)` : "";
    toast(`${result.matches} completed knockout matches checked · ${result.changes} updates${warning}`);
  } catch (error) {
    console.error(error);
    toast("ESPN sync failed · use manual edit and try again later");
  } finally {
    button.textContent = "Sync ESPN results";
    button.disabled = false;
  }
});

$("#manualButton").addEventListener("click", () => {
  const sorted = [...entries].sort((a, b) => stageRank.indexOf(a.stage) - stageRank.indexOf(b.stage) || a.number - b.number);
  $("#entrySelect").innerHTML = sorted.map((entry) =>
    `<option value="${entry.number}">#${entry.number} · ${escapeHtml(entry.player)} — ${escapeHtml(entry.team)}</option>`
  ).join("");
  $("#stageSelect").value = entries.find((entry) => entry.number === Number($("#entrySelect").value))?.stage || "R32";
  $("#updateDialog").showModal();
});

$("#entrySelect").addEventListener("change", ({ target }) => {
  $("#stageSelect").value = entries.find((entry) => entry.number === Number(target.value)).stage;
});

$("#updateForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const entry = entries.find((item) => item.number === Number($("#entrySelect").value));
  entry.stage = $("#stageSelect").value;
  try {
    await save();
    $("#updateDialog").close();
    render();
    toast(`${entry.team} moved to ${stageNames[entry.stage]}`);
  } catch (error) {
    console.error(error);
    toast("Could not save the admin edit");
  }
});

$("#loginForm .modal-close").addEventListener("click", () => $("#loginDialog").close());

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $("#loginError").textContent = "";
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("#adminPassword").value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    isAdmin = true;
    $("#adminPassword").value = "";
    $("#loginDialog").close();
    render();
    toast("Admin editor unlocked");
  } catch (error) {
    $("#loginError").textContent = error.message || "Could not log in";
  } finally {
    button.disabled = false;
  }
});

$("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/auth", { method: "DELETE" });
  isAdmin = false;
  $("#updateDialog").close();
  history.replaceState({}, "", location.pathname);
  render();
  toast("Signed out");
});

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((item) => {
    item.classList.toggle("active", item === tab);
    item.setAttribute("aria-selected", item === tab);
  });
  $("#bracketView").hidden = tab.dataset.view !== "bracket";
  $("#entriesView").hidden = tab.dataset.view !== "entries";
}));

render();
Promise.all([
  fetch("/api/auth").then((response) => response.ok ? response.json() : { admin: false }),
  fetch("/api/state").then(async (response) =>
    response.ok ? { ...await response.json(), available: true } : { entries: null, available: false }
  )
]).then(([auth, state]) => {
  isAdmin = Boolean(auth.admin);
  if (state.entries) {
    entries = state.entries;
    if (tournamentEvents.length) entries = applyResults(entries, tournamentEvents).entries;
    localStorage.setItem(storageKey, JSON.stringify(entries));
  } else if (!state.available && localEntries) {
    entries = localEntries;
  }
  render();
  if (new URLSearchParams(location.search).get("admin") === "1" && !isAdmin) {
    $("#loginDialog").showModal();
    $("#adminPassword").focus();
  }
}).catch((error) => console.error("Could not load shared pool state", error));

fetch(espnUrl)
  .then((response) => {
    if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
    return response.json();
  })
  .then((data) => {
    tournamentEvents = data.events || [];
    qualifiers = qualifiedTeams(tournamentEvents);
    if (drawn()) {
      entries = applyResults(entries, tournamentEvents).entries;
      localStorage.setItem(storageKey, JSON.stringify(entries));
    }
    qualifiersLoaded = true;
    render();
  })
  .catch((error) => {
    qualifiersLoaded = true;
    render();
    console.error("Could not load qualified teams", error);
  });

setInterval(async () => {
  if (!drawn()) return;
  try {
    const response = await fetch(espnUrl);
    if (!response.ok) return;
    tournamentEvents = (await response.json()).events || [];
    entries = applyResults(entries, tournamentEvents).entries;
    localStorage.setItem(storageKey, JSON.stringify(entries));
    localStorage.setItem(syncKey, new Date().toISOString());
    render();
  } catch (error) {
    console.error("Live refresh failed", error);
  }
}, 60000);
