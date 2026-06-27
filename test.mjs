import assert from "node:assert/strict";
import { applyResults, normalizeTeam, qualifiedTeams, roundOf32Teams, shuffle } from "./logic.js";

const teams = Array.from({ length: 32 }, (_, index) => `Team ${index + 1}`);
assert.deepEqual(shuffle(teams).toSorted(), teams.toSorted());
assert.equal(normalizeTeam("U.S.A."), "unitedstates");

const roundOf32 = Array.from({ length: 16 }, (_, match) => ({
  season: { slug: "round-of-32" },
  competitions: [{
    competitors: [match * 2 + 1, match * 2 + 2].map((team) => ({
      team: { displayName: `Team ${team}`, isActive: true }
    }))
  }]
}));
assert.equal(roundOf32Teams(roundOf32).length, 32);
roundOf32[0].competitions[0].competitors[0].team.isActive = false;
assert.equal(qualifiedTeams(roundOf32).length, 31);
assert.deepEqual(roundOf32Teams(roundOf32), []);

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
