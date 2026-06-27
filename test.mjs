import assert from "node:assert/strict";
import { applyResults, normalizeTeam, parseTeams, shuffle } from "./logic.js";

const teams = Array.from({ length: 32 }, (_, index) => `Team ${index + 1}`);
assert.equal(parseTeams(teams.join("\n")).error, "");
assert.equal(parseTeams([...teams.slice(0, 31), "TEAM 1"].join("\n")).error, "Team names must be unique");
assert.deepEqual(shuffle(teams).toSorted(), teams.toSorted());
assert.equal(normalizeTeam("U.S.A."), "unitedstates");

const result = applyResults(
  [
    { number: 1, player: "Nabil", team: "Mexico", stage: "R32" },
    { number: 2, player: "Stephanie", team: "South Africa", stage: "R32" }
  ],
  [{
    date: "2026-06-29T00:00Z",
    season: { slug: "round-of-32" },
    competitions: [{
      status: { type: { completed: true } },
      competitors: [
        { winner: true, team: { displayName: "Mexico", abbreviation: "MEX" } },
        { winner: false, team: { displayName: "South Africa", abbreviation: "RSA" } }
      ]
    }]
  }]
);
assert.deepEqual(result.entries.map(({ stage }) => stage), ["R16", "OUT"]);
console.log("Draw logic passed");
