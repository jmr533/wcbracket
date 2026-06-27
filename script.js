import { parseTeams, shuffle } from "./logic.js";

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
let entries = JSON.parse(localStorage.getItem(storageKey) || "null") ||
  players.map((player, index) => ({ number: index + 1, player, team: "", stage: "R32" }));

const $ = (selector) => document.querySelector(selector);
const drawn = () => entries.every((entry) => entry.team);
const save = () => localStorage.setItem(storageKey, JSON.stringify(entries));
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
})[character]);

function card(entry) {
  return `<article class="entry-card ${entry.stage === "OUT" ? "out" : ""}">
    <span class="entry-number">${String(entry.number).padStart(2, "0")}</span>
    <div><b>${escapeHtml(entry.player)}</b><small>${escapeHtml(entry.team || "Team pending")}</small></div>
    <span class="status-dot" title="${stageNames[entry.stage]}"></span>
  </article>`;
}

function render() {
  const hasDrawn = drawn();
  $("#drawButton").hidden = hasDrawn;
  $("#updateButton").disabled = !hasDrawn;
  $("#drawNote").textContent = hasDrawn ? "Draw complete · standings saved on this device" : "One draw. 32 teams. No do-overs.";
  $(".live-pill").innerHTML = `<span></span> ${hasDrawn ? "Tournament live" : "Draw pending"}`;
  $(".live-pill span").style.background = hasDrawn ? "var(--lime)" : "#ffbe41";

  $("#entriesView").innerHTML = `<div class="entries-grid">${entries.map(card).join("")}</div>`;
  if (!hasDrawn) {
    $("#bracketView").innerHTML = `<div class="empty-board"><div>
      <span class="empty-icon">⌁</span><h3>The bracket is waiting</h3>
      <p>Once all 32 knockout teams qualify, run the draw to reveal every friend’s team here.</p>
    </div></div>`;
    return;
  }

  const rounds = [
    ["R32", "Round of 32"], ["R16", "Round of 16"], ["QF", "Quarterfinals"],
    ["SF", "Semifinals"], ["FINAL", "Final four"]
  ];
  $("#bracketView").innerHTML = `<div class="rounds">${rounds.map(([stage, label]) => {
    const visible = entries.filter((entry) => stage === "FINAL"
      ? ["FINAL", "CHAMPION", "RUNNER_UP", "THIRD", "FOURTH"].includes(entry.stage)
      : entry.stage === stage);
    return `<section class="round"><header class="round-head"><b>${label}</b><span>${visible.length}</span></header>
      <div class="round-list">${visible.length ? visible.map(card).join("") : `<div class="empty-board"><p>No teams here yet.</p></div>`}</div>
    </section>`;
  }).join("")}</div>`;
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2400);
}

$("#drawButton").addEventListener("click", () => $("#drawDialog").showModal());
$("#teamsInput").addEventListener("input", ({ target }) => {
  const count = target.value.split("\n").filter((team) => team.trim()).length;
  $("#teamCount").textContent = `${count} / 32 teams`;
  $("#drawError").textContent = "";
});

$("#drawForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const { teams, error } = parseTeams($("#teamsInput").value);
  if (error) {
    $("#drawError").textContent = error;
    return;
  }
  const assigned = shuffle(teams);
  entries = entries.map((entry, index) => ({ ...entry, team: assigned[index], stage: "R32" }));
  save();
  $("#drawDialog").close();
  render();
  toast("The draw is complete");
});

$("#updateButton").addEventListener("click", () => {
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

$("#updateForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const entry = entries.find((item) => item.number === Number($("#entrySelect").value));
  entry.stage = $("#stageSelect").value;
  save();
  $("#updateDialog").close();
  render();
  toast(`${entry.team} moved to ${stageNames[entry.stage]}`);
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
