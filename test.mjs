import assert from "node:assert/strict";
import { applyResults, knockoutMatches, normalizeTeam, qualifiedTeams, roundOf32Teams, shuffle } from "./logic.js";
import { isAdmin, sameOrigin, sessionCookie, validPassword } from "./api/_auth.js";
import { validEntries } from "./api/state.js";

process.env.ADMIN_PASSWORD = "test-password";
assert.equal(validPassword("test-password"), true);
assert.equal(validPassword("wrong-password"), false);
const cookie = sessionCookie();
assert.equal(isAdmin({ headers: { cookie } }), true);
assert.equal(isAdmin({ headers: { cookie: "wcbracket_admin=wrong" } }), false);
assert.equal(sameOrigin({ headers: { origin: "https://pool.example", host: "pool.example" } }), true);
assert.equal(sameOrigin({ headers: { origin: "https://evil.example", host: "pool.example" } }), false);

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

const validState = Array.from({ length: 32 }, (_, index) => ({
  number: index + 1, player: `Player ${index + 1}`, team: "", stage: "R32"
}));
assert.equal(validEntries(validState), true);
assert.equal(validEntries(validState.map((entry, index) => ({ ...entry, number: index ? entry.number : 2 }))), false);
assert.equal(validEntries(validState.map((entry, index) => ({ ...entry, stage: index ? entry.stage : "HACKED" }))), false);
console.log("Draw logic passed");
