import assert from "node:assert/strict";
import { parseTeams, shuffle } from "./logic.js";

const teams = Array.from({ length: 32 }, (_, index) => `Team ${index + 1}`);
assert.equal(parseTeams(teams.join("\n")).error, "");
assert.equal(parseTeams([...teams.slice(0, 31), "TEAM 1"].join("\n")).error, "Team names must be unique");
assert.deepEqual(shuffle(teams).toSorted(), teams.toSorted());
console.log("Draw logic passed");
