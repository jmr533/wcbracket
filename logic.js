export function parseTeams(value) {
  const teams = value.split("\n").map((team) => team.trim()).filter(Boolean);
  if (teams.length !== 32) return { teams, error: "Exactly 32 required" };
  if (new Set(teams.map((team) => team.toLocaleLowerCase())).size !== 32) {
    return { teams, error: "Team names must be unique" };
  }
  return { teams, error: "" };
}

export function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const target = Math.floor(random[0] / (2 ** 32) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

const aliases = {
  usa: "unitedstates",
  us: "unitedstates",
  korearepublic: "southkorea",
  czechrepublic: "czechia",
  ivorycoast: "cotedivoire",
  democraticrepublicofcongo: "congodr",
  drcongo: "congodr"
};

export function normalizeTeam(value = "") {
  const normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
  return aliases[normalized] || normalized;
}

export function applyResults(entries, events) {
  const updated = entries.map((entry) => ({ ...entry }));
  const unmatched = new Set();
  let matches = 0;
  let changes = 0;
  const nextStage = {
    "round-of-32": "R16",
    "round-of-16": "QF",
    quarterfinals: "SF",
    semifinals: "FINAL",
    "3rd-place-match": "THIRD",
    final: "CHAMPION"
  };
  const loserStage = { "3rd-place-match": "FOURTH", final: "RUNNER_UP" };

  const findEntry = (competitor) => {
    const team = competitor.team;
    const names = [team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation]
      .map(normalizeTeam);
    return updated.find((entry) => names.includes(normalizeTeam(entry.team)));
  };

  [...events].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((event) => {
    const slug = event.season?.slug;
    const competition = event.competitions?.[0];
    if (!nextStage[slug] || !competition?.status?.type?.completed) return;
    const winner = competition.competitors.find((team) => team.winner);
    const loser = competition.competitors.find((team) => !team.winner);
    if (!winner || !loser) return;
    matches++;

    [[winner, nextStage[slug]], [loser, loserStage[slug] || (slug === "semifinals" ? "SF" : "OUT")]]
      .forEach(([competitor, stage]) => {
        const entry = findEntry(competitor);
        if (!entry) {
          unmatched.add(competitor.team.displayName);
        } else if (entry.stage !== stage) {
          entry.stage = stage;
          changes++;
        }
      });
  });

  return { entries: updated, matches, changes, unmatched: [...unmatched] };
}
