import assert from "node:assert/strict";
import { applyResults, knockoutMatches, normalizeTeam, qualifiedTeams, roundOf32Teams, shuffle } from "./logic.js";

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
assert.deepEqual(qualifiedTeams(roundOf32)[0], { name: "Team 2", flag: "" });
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
assert.deepEqual(knockoutMatches(result.entries, [{
  id: "1",
  date: "2026-06-29T00:00Z",
  season: { slug: "round-of-32" },
  competitions: [{
    status: { type: { state: "post", completed: true, shortDetail: "Final" } },
    competitors: [
      { score: "2", winner: true, team: { displayName: "Mexico", isActive: true, logo: "mex.png" } },
      { score: "1", winner: false, team: { displayName: "South Africa", isActive: true, logo: "rsa.png" } }
    ]
  }]
}])[0].sides.map(({ entry, winner }) => [entry.player, winner]), [["Nabil", true], ["Stephanie", false]]);
console.log("Draw logic passed");
